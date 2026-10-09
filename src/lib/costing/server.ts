import type { AtomicWrite } from "@/lib/masters/firestore";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { COSTING_COLLECTIONS } from "@/lib/costing/collections";
import {
  actorStamp,
  auditCosting,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueCostingNumber,
  listByField,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  searchIndex,
  text,
  workflowFail,
  writeOf,
} from "@/lib/costing/helpers";
import {
  assembleBatchCostBreakdown,
  allocateManufacturingOverhead,
  calculateCostVariances,
  calculateProductStandardCost,
  calculateYieldMetrics,
  detectDuplicateSourceLines,
  resolveOutputQuantity,
  validateCostingCompleteness,
  calculateLineCost,
} from "@/lib/costing/calculate";
import { isPackagingMaterial, loadApprovedBom, loadManufacturingOrderContext, resolveMaterialUnitCost } from "@/lib/costing/valuation";
import { BATCH_COSTING_TRANSITIONS, STANDARD_TRANSITIONS, canTransition, isFinalizedLocked } from "@/lib/costing/status";
import { addMoney, money } from "@/lib/finance/money";
import {
  allocationRuleSchema,
  batchCostingCreateSchema,
  productStandardSchema,
  rateCardSchema,
  varianceInvestigationSchema,
  costingSettingsSchema,
} from "@/lib/validation/costing";
import type { SessionPayload } from "@/types/auth";
import type { CostLineResult } from "@/types/costing";

async function loadSettings(idToken: string) {
  const rows = await queryMasterDocuments(COSTING_COLLECTIONS.settings, idToken, { limit: 1 });
  return rows[0] || {
    methodology: "actual",
    methodologyVersion: "1.0",
    currency: "INR",
    materialValuationSource: "purchase_order",
    laborRateSource: "rate_card",
    machineRateSource: "rate_card",
    overheadAllocationBasis: "direct_material_cost",
    outputQuantityPolicy: "saleable",
    varianceThresholdPercent: 5,
    yieldTolerancePercent: 2,
    allowEstimatedWhenMissing: false,
    requireLabor: false,
    requireMachine: false,
    requireOverhead: false,
    requireVarianceExplanation: true,
    approvalRequired: true,
  };
}

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

export async function saveCostingSettings(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costing:update");
  const data = parseOrFail(costingSettingsSchema, options.payload);
  const existing = await queryMasterDocuments(COSTING_COLLECTIONS.settings, options.idToken, { limit: 1 });
  const id = existing[0] ? String(existing[0].id) : "default";
  const record = {
    settingsId: id,
    ...data,
    previousMethodologyVersion: text(existing[0]?.methodologyVersion),
    ...actorStamp(options.session, existing[0]),
  };
  await commitWrites(
    [writeOf(COSTING_COLLECTIONS.settings, id, record, { exists: existing[0] ? undefined : false })],
    options.idToken
  );
  await auditCosting(options.idToken, options.session, {
    action: "SETTINGS_SAVED",
    resource: COSTING_COLLECTIONS.settings,
    resourceId: id,
    description: "Updated costing settings. Historical records retain their methodology version.",
  });
  return { id, record };
}

export async function createRateCard(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costing:update");
  const data = parseOrFail(rateCardSchema, options.payload);
  const numbered = await issueCostingNumber("RATE", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    rateCardId: id,
    rateCardNumber: numbered.documentNumber,
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.name, data.referenceId),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COSTING_COLLECTIONS.rateCards, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createAllocationRule(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costing:update");
  const data = parseOrFail(allocationRuleSchema, options.payload);
  const numbered = await issueCostingNumber("RULE", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    ruleId: id,
    ruleNumber: numbered.documentNumber,
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.name),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COSTING_COLLECTIONS.allocationRules, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function calculateProductStandardCostRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costingStandard:create");
  const data = parseOrFail(productStandardSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  const bomPack = await loadApprovedBom(data.bomId, options.idToken);
  if (!bomPack) fail("BOM was not found.");
  if (!["approved", "active"].includes(text(bomPack.bom.status))) {
    fail("Only approved or active BOM versions can be used for standard costing.");
  }
  if (text(bomPack.bom.productId) !== data.productId) {
    fail("BOM product does not match the selected product.");
  }

  const settings = await loadSettings(options.idToken);
  const materialLines = [];
  for (const item of bomPack.items) {
    const materialId = text(item.materialId);
    const valuation = await resolveMaterialUnitCost(materialId, options.idToken, {
      preferStandard: text(settings.materialValuationSource) === "standard_rate",
    });
    const material = materialId ? await readMasterDocument("materials", materialId, options.idToken) : null;
    materialLines.push({
      quantity: money(item.quantity),
      unitCost: valuation.unitCost,
      isPackaging: isPackagingMaterial(item.materialStage, material?.category || material?.materialType),
      materialId,
      valuation,
      uom: text(item.uom),
    });
  }

  const calc = calculateProductStandardCost({
    materialLines,
    laborHours: data.laborHours,
    laborRate: data.laborRate,
    machineHours: data.machineHours,
    machineRate: data.machineRate,
    overheadAmount: data.overheadAmount,
    qualityAmount: data.qualityAmount,
    standardBatchSize: data.standardBatchSize || bomPack.bom.batchSize,
    standardYieldPercent: data.standardYieldPercent,
  });

  const missing = materialLines.filter((line) => line.valuation.dataQuality === "missing").map((line) => line.materialId);
  const numbered = await issueCostingNumber("STD", options.session, options.idToken);
  const id = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const record = {
    standardId: id,
    standardNumber: numbered.documentNumber,
    productId: data.productId,
    bomId: data.bomId,
    bomVersion: text(bomPack.bom.version),
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo || "",
    currency: data.currency,
    methodologyVersion: data.methodologyVersion || text(settings.methodologyVersion) || "1.0",
    status: "calculated",
    ...calc,
    missingMaterialCosts: missing,
    dataQuality: missing.length ? "provisional" : "standard",
    notes: data.notes || "",
    currentVersionId: versionId,
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.bomId),
    ...actorStamp(options.session),
  };

  const version = {
    versionId,
    standardId: id,
    versionNumber: 1,
    snapshot: record,
    ...actorStamp(options.session),
  };

  const writes: AtomicWrite[] = [
    writeOf(COSTING_COLLECTIONS.productStandards, id, record, { exists: false }),
    writeOf(COSTING_COLLECTIONS.standardVersions, versionId, version, { exists: false }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditCosting(options.idToken, options.session, {
    action: "STANDARD_CREATED",
    resource: COSTING_COLLECTIONS.productStandards,
    resourceId: id,
    description: `Created product standard cost ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function transitionProductStandard(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "finalize" | "reopen";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(COSTING_COLLECTIONS.productStandards, options.id, options.idToken, "Product standard");
  const map: Record<string, { next: string; permission: Parameters<typeof ensurePermission>[1] }> = {
    submit: { next: "validation", permission: "costingStandard:create" },
    approve: { next: "approved", permission: "costingStandard:approve" },
    reject: { next: "rejected", permission: "costingStandard:approve" },
    finalize: { next: "finalized", permission: "costing:complete" },
    reopen: { next: "draft", permission: "costing:reopen" },
  };
  const step = map[options.action];
  if (!step) fail("Unsupported action.");
  ensurePermission(options.session, step.permission);
  if (options.action === "reopen") {
    if (!isFinalizedLocked(text(current.status)) && text(current.status) !== "approved") {
      fail("Only approved or finalized standards can be reopened.");
    }
  } else {
    assertTransition(STANDARD_TRANSITIONS, text(current.status), step.next, options.action);
  }
  const next = {
    ...current,
    status: options.action === "reopen" ? "draft" : step.next,
    lastActionComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(COSTING_COLLECTIONS.productStandards, options.id, next)], options.idToken);
  await auditCosting(options.idToken, options.session, {
    action: `STANDARD_${options.action.toUpperCase()}`,
    resource: COSTING_COLLECTIONS.productStandards,
    resourceId: options.id,
    description: `Product standard ${text(current.standardNumber)} → ${next.status}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

async function buildActualBatchLines(
  manufacturingOrderId: string,
  idToken: string,
  settings: Record<string, unknown>
): Promise<{ lines: CostLineResult[]; missing: string[]; context: NonNullable<Awaited<ReturnType<typeof loadManufacturingOrderContext>>> }> {
  const context = await loadManufacturingOrderContext(manufacturingOrderId, idToken);
  if (!context) fail("Manufacturing order was not found.");

  const lines: CostLineResult[] = [];
  const missing: string[] = [];
  const consumption = new Map<string, { qty: number; uom: string; sourceCollection: string; sourceId: string }>();

  for (const item of context.issueItems) {
    const materialId = text(item.materialId);
    if (!materialId) continue;
    const qty = money(item.quantity);
    const prev = consumption.get(materialId);
    consumption.set(materialId, {
      qty: addMoney(prev?.qty, qty),
      uom: text(item.uom) || prev?.uom || "",
        sourceCollection: "stockIssueItems", // INVENTORY_COLLECTIONS.issueItems
      sourceId: String(item.id),
    });
  }

  if (!consumption.size) {
    for (const item of context.dispensingItems) {
      const materialId = text(item.materialId);
      const qty = money(item.dispensedQuantity || item.allocatedQuantity || item.requiredQuantity);
      if (!materialId || qty <= 0) continue;
      const prev = consumption.get(materialId);
      consumption.set(materialId, {
        qty: addMoney(prev?.qty, qty),
        uom: text(item.uom) || prev?.uom || "",
        sourceCollection: PRODUCTION_COLLECTIONS.dispensingItems,
        sourceId: String(item.id),
      });
    }
  }

  for (const recon of context.reconciliations) {
    const materialId = text(recon.materialId);
    const qty = money(recon.consumed || recon.actual);
    if (!materialId || qty <= 0) continue;
    if (!consumption.has(materialId)) {
      consumption.set(materialId, {
        qty,
        uom: text(recon.uom) || "",
        sourceCollection: PRODUCTION_COLLECTIONS.reconciliations,
        sourceId: String(recon.id),
      });
    }
  }

  for (const [materialId, use] of consumption.entries()) {
    const valuation = await resolveMaterialUnitCost(materialId, idToken, {
      preferStandard: text(settings.materialValuationSource) === "standard_rate",
    });
    if (valuation.dataQuality === "missing") missing.push(`material:${materialId}`);
    const material = await readMasterDocument("materials", materialId, idToken);
    const packaging = isPackagingMaterial(material?.category || material?.materialType, material?.materialType);
    lines.push(
      calculateLineCost({
        quantity: use.qty,
        unitCost: valuation.unitCost,
        componentType: packaging ? "packaging" : "raw_material",
        description: packaging ? `Packaging ${materialId}` : `Material ${materialId}`,
        uom: use.uom,
        materialId,
        sourceCollection: use.sourceCollection,
        sourceId: use.sourceId,
        valuationBasis: valuation.valuationBasis,
        dataQuality: valuation.dataQuality,
        currency: valuation.currency,
      })
    );
  }

  for (const waste of context.wastage) {
    const qty = money(waste.quantity);
    if (qty <= 0) continue;
    const materialId = text(waste.materialId);
    const valuation = materialId
      ? await resolveMaterialUnitCost(materialId, idToken)
      : { unitCost: 0, valuationBasis: "unavailable", dataQuality: "missing" as const, currency: "INR" };
    if (valuation.dataQuality === "missing") missing.push("wastage_valuation");
    lines.push(
      calculateLineCost({
        quantity: qty,
        unitCost: valuation.unitCost,
        componentType: "wastage",
        description: `Wastage ${text(waste.reason) || materialId || "batch"}`,
        uom: text(waste.uom),
        materialId,
        sourceCollection: PRODUCTION_COLLECTIONS.wastage,
        sourceId: String(waste.id),
        valuationBasis: valuation.valuationBasis,
        dataQuality: valuation.dataQuality,
        currency: valuation.currency || "INR",
      })
    );
  }

  // Labor / machine from rate cards only when hours exist on BMR/equipment assignments
  const laborAssignments = await queryMasterDocuments(PRODUCTION_COLLECTIONS.operatorAssignments, idToken, {
    filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
    limit: 50,
  }).catch(() => []);
  let laborHours = 0;
  for (const row of laborAssignments) {
    laborHours = addMoney(laborHours, row.hours || row.durationHours);
  }
  if (laborHours > 0) {
    const rates = await queryMasterDocuments(COSTING_COLLECTIONS.rateCards, idToken, {
      filters: [
        { field: "rateType", value: "labor" },
        { field: "status", value: "active" },
      ],
      limit: 1,
    });
    if (rates[0]) {
      lines.push(
        calculateLineCost({
          quantity: laborHours,
          unitCost: money(rates[0].rate),
          componentType: "labor",
          description: "Direct labor",
          uom: "hour",
          sourceCollection: PRODUCTION_COLLECTIONS.operatorAssignments,
          sourceId: String(laborAssignments[0]?.id || ""),
          valuationBasis: "rate_card",
          dataQuality: "actual",
        })
      );
    } else {
      missing.push("labor_rate");
    }
  } else if (settings.requireLabor) {
    missing.push("labor_hours");
  }

  const equipment = await queryMasterDocuments(PRODUCTION_COLLECTIONS.equipmentAssignments, idToken, {
    filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
    limit: 50,
  }).catch(() => []);
  let machineHours = 0;
  for (const row of equipment) {
    machineHours = addMoney(machineHours, row.hours || row.durationHours);
  }
  if (machineHours > 0) {
    const rates = await queryMasterDocuments(COSTING_COLLECTIONS.rateCards, idToken, {
      filters: [
        { field: "rateType", value: "machine" },
        { field: "status", value: "active" },
      ],
      limit: 1,
    });
    if (rates[0]) {
      lines.push(
        calculateLineCost({
          quantity: machineHours,
          unitCost: money(rates[0].rate),
          componentType: "machine",
          description: "Machine / equipment",
          uom: "hour",
          sourceCollection: PRODUCTION_COLLECTIONS.equipmentAssignments,
          sourceId: String(equipment[0]?.id || ""),
          valuationBasis: "rate_card",
          dataQuality: "actual",
        })
      );
    } else {
      missing.push("machine_rate");
    }
  } else if (settings.requireMachine) {
    missing.push("machine_hours");
  }

  const rules = await queryMasterDocuments(COSTING_COLLECTIONS.allocationRules, idToken, {
    filters: [{ field: "status", value: "active" }],
    limit: 5,
  });
  const materialCost = lines
    .filter((line) => ["raw_material", "packaging"].includes(line.componentType))
    .reduce((sum, line) => addMoney(sum, line.totalCost), 0);
  if (rules[0] && materialCost > 0) {
    const allocation = allocateManufacturingOverhead({
      poolAmount: rules[0].costPoolAmount,
      basisQuantity: materialCost,
      totalBasisQuantity: rules[0].totalBasisQuantity || materialCost,
    });
    lines.push(
      calculateLineCost({
        quantity: 1,
        unitCost: allocation.allocatedAmount,
        componentType: "overhead",
        description: `Overhead: ${text(rules[0].name)}`,
        uom: "allocation",
        sourceCollection: COSTING_COLLECTIONS.allocationRules,
        sourceId: String(rules[0].id),
        valuationBasis: text(rules[0].allocationBasis),
        dataQuality: "actual",
      })
    );
  } else if (settings.requireOverhead) {
    missing.push("overhead_allocation");
  }

  detectDuplicateSourceLines(lines);
  return { lines, missing, context };
}

export async function createBatchCostingRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costingBatch:create");
  const data = parseOrFail(batchCostingCreateSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  const existing = await queryMasterDocuments(COSTING_COLLECTIONS.batchRecords, options.idToken, {
    filters: [{ field: "manufacturingOrderId", value: data.manufacturingOrderId }],
    limit: 10,
  });
  if (existing.some((row) => !["cancelled", "superseded", "rejected"].includes(text(row.status)))) {
    fail("An active costing record already exists for this manufacturing order.");
  }

  const settings = await loadSettings(options.idToken);
  const built = await buildActualBatchLines(data.manufacturingOrderId, options.idToken, settings);
  const order = built.context.order;
  const latestYield = built.context.yields[0];
  const produced = money(latestYield?.actualQuantity ?? order.plannedQuantity);
  const rejected = built.context.wastage
    .filter((row) => text(row.reason).toLowerCase().includes("reject"))
    .reduce((sum, row) => addMoney(sum, row.quantity), 0);
  const outputQuantity = resolveOutputQuantity({
    producedQuantity: produced,
    releasedQuantity: produced,
    rejectedQuantity: rejected,
    policy: (text(settings.outputQuantityPolicy) as "produced" | "released" | "saleable") || "saleable",
  });

  const completeness = validateCostingCompleteness({
    hasMaterial: built.lines.some((line) => ["raw_material", "packaging"].includes(line.componentType)),
    hasOutput: outputQuantity > 0,
    hasLabor: built.lines.some((line) => line.componentType === "labor"),
    hasMachine: built.lines.some((line) => line.componentType === "machine"),
    hasOverhead: built.lines.some((line) => line.componentType === "overhead"),
    requireLabor: Boolean(settings.requireLabor),
    requireMachine: Boolean(settings.requireMachine),
    requireOverhead: Boolean(settings.requireOverhead),
  });

  const breakdown = assembleBatchCostBreakdown({
    lines: built.lines,
    outputQuantity,
    missingComponents: [...built.missing, ...completeness.missingComponents],
  });

  let standard: Record<string, unknown> | null = null;
  if (data.productStandardId) {
    standard = await requireRecord(
      COSTING_COLLECTIONS.productStandards,
      data.productStandardId,
      options.idToken,
      "Product standard"
    );
  } else {
    const standards = await queryMasterDocuments(COSTING_COLLECTIONS.productStandards, options.idToken, {
      filters: [
        { field: "productId", value: text(order.productId) },
        { field: "status", value: "finalized" },
      ],
      limit: 1,
    });
    standard = standards[0] || null;
    if (!standard) {
      const approved = await queryMasterDocuments(COSTING_COLLECTIONS.productStandards, options.idToken, {
        filters: [
          { field: "productId", value: text(order.productId) },
          { field: "status", value: "approved" },
        ],
        limit: 1,
      });
      standard = approved[0] || null;
    }
  }

  const yieldMetrics = calculateYieldMetrics({
    plannedQuantity: order.plannedQuantity || order.batchSize,
    actualQuantity: produced,
    standardYieldPercent: standard?.standardYieldPercent,
    actualWastageQuantity: built.context.wastage.reduce((sum, row) => addMoney(sum, row.quantity), 0),
  });

  const variances = standard
    ? calculateCostVariances({
        actualMaterialQty: breakdown.lines
          .filter((l) => l.componentType === "raw_material")
          .reduce((s, l) => addMoney(s, l.quantity), 0),
        actualMaterialPrice:
          breakdown.materialCost /
          Math.max(
            1,
            breakdown.lines.filter((l) => l.componentType === "raw_material").reduce((s, l) => addMoney(s, l.quantity), 0)
          ),
        standardMaterialQty: money(standard.standardBatchSize),
        standardMaterialPrice:
          money(standard.materialCost) / Math.max(1, money(standard.standardBatchSize)),
        actualPackQty: breakdown.lines
          .filter((l) => l.componentType === "packaging")
          .reduce((s, l) => addMoney(s, l.quantity), 0),
        actualPackPrice:
          breakdown.packagingCost /
          Math.max(
            1,
            breakdown.lines.filter((l) => l.componentType === "packaging").reduce((s, l) => addMoney(s, l.quantity), 0)
          ),
        standardPackQty: money(standard.standardBatchSize),
        standardPackPrice: money(standard.packagingCost) / Math.max(1, money(standard.standardBatchSize)),
        actualLaborHours: breakdown.lines.filter((l) => l.componentType === "labor").reduce((s, l) => addMoney(s, l.quantity), 0),
        actualLaborRate: money(standard.laborRate),
        standardLaborHours: money(standard.laborHours),
        standardLaborRate: money(standard.laborRate),
        actualMachineHours: breakdown.lines
          .filter((l) => l.componentType === "machine")
          .reduce((s, l) => addMoney(s, l.quantity), 0),
        actualMachineRate: money(standard.machineRate),
        standardMachineHours: money(standard.machineHours),
        standardMachineRate: money(standard.machineRate),
        actualOverhead: breakdown.overheadCost,
        absorbedOverhead: money(standard.overheadCost),
        actualTotal: breakdown.totalBatchCost,
        standardTotal: money(standard.totalBatchCost),
        actualUnitCost: breakdown.costPerUnit,
        standardUnitCost: money(standard.costPerUnit),
        yieldVarianceCost: multiplySafe(yieldMetrics.yieldVarianceQuantity, breakdown.costPerUnit),
        wastageVarianceCost: breakdown.wastageCost,
        reworkCost: breakdown.reworkCost,
      })
    : null;

  const numbered = await issueCostingNumber("BAT", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    batchCostingId: id,
    batchCostingNumber: numbered.documentNumber,
    manufacturingOrderId: data.manufacturingOrderId,
    productId: text(order.productId),
    batchNumber: text(order.batchNumber),
    bomId: text(order.bomId),
    productStandardId: standard ? String(standard.id) : data.productStandardId || "",
    customerId: data.customerId || text(order.customerId),
    costCenterId: data.costCenterId || "",
    siteId: data.siteId || "",
    departmentId: data.departmentId || "",
    currency: text(settings.currency) || "INR",
    methodology: text(settings.methodology) || "actual",
    methodologyVersion: text(settings.methodologyVersion) || "1.0",
    status: "calculated",
    calculationTimestamp: new Date().toISOString(),
    ...breakdown,
    materialCostPercent: percentOf(breakdown.materialCost, breakdown.totalBatchCost),
    packagingCostPercent: percentOf(breakdown.packagingCost, breakdown.totalBatchCost),
    laborCostPercent: percentOf(breakdown.laborCost, breakdown.totalBatchCost),
    overheadPercent: percentOf(breakdown.overheadCost, breakdown.totalBatchCost),
    completenessStatus: completeness.statusLabel,
    yieldMetrics,
    varianceSummary: variances
      ? {
          totalFavorable: variances.totalFavorable,
          totalUnfavorable: variances.totalUnfavorable,
          totalVariance: money(breakdown.totalBatchCost - money(standard?.totalBatchCost)),
        }
      : null,
    notes: data.notes || "",
    searchIndex: searchIndex(numbered.documentNumber, order.batchNumber, order.productId, data.manufacturingOrderId),
    ...actorStamp(options.session),
  };

  const writes: AtomicWrite[] = [writeOf(COSTING_COLLECTIONS.batchRecords, id, record, { exists: false })];
  for (const line of breakdown.lines) {
    const lineId = crypto.randomUUID();
    writes.push(
      writeOf(
        COSTING_COLLECTIONS.batchLines,
        lineId,
        {
          lineId,
          batchCostingId: id,
          ...line,
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  if (variances) {
    const varianceId = crypto.randomUUID();
    writes.push(
      writeOf(
        COSTING_COLLECTIONS.varianceAnalyses,
        varianceId,
        {
          varianceId,
          batchCostingId: id,
          rows: variances.rows,
          totalFavorable: variances.totalFavorable,
          totalUnfavorable: variances.totalUnfavorable,
          thresholdPercent: money(settings.varianceThresholdPercent),
          exceedsThreshold:
            Math.abs(money(record.varianceSummary?.totalVariance)) >
            (money(standard?.totalBatchCost) * money(settings.varianceThresholdPercent)) / 100,
          status: "open",
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditCosting(options.idToken, options.session, {
    action: "BATCH_COSTING_CREATED",
    resource: COSTING_COLLECTIONS.batchRecords,
    resourceId: id,
    description: `Calculated batch costing ${numbered.documentNumber} for MO ${data.manufacturingOrderId}.`,
  });
  return { id, record, lines: breakdown.lines, variances };
}

function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return money((part / whole) * 100);
}

function multiplySafe(a: unknown, b: unknown) {
  return money(money(a) * money(b));
}

export async function recalculateBatchCosting(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costingBatch:execute");
  const current = await requireRecord(COSTING_COLLECTIONS.batchRecords, options.id, options.idToken, "Batch costing");
  if (isFinalizedLocked(text(current.status))) {
    fail("Finalized costing cannot be silently overwritten. Reopen with authorization or create a new version.");
  }
  // Release the active MO lock before creating the replacement version.
  await commitWrites(
    [
      writeOf(COSTING_COLLECTIONS.batchRecords, options.id, {
        ...current,
        status: "superseded",
        supersededReason: "recalculation_pending",
        ...actorStamp(options.session, current),
      }),
    ],
    options.idToken
  );
  const created = await createBatchCostingRecord({
    payload: {
      manufacturingOrderId: text(current.manufacturingOrderId),
      productStandardId: text(current.productStandardId),
      costCenterId: text(current.costCenterId),
      customerId: text(current.customerId),
      siteId: text(current.siteId),
      departmentId: text(current.departmentId),
      notes: `Recalculation of ${text(current.batchCostingNumber)}`,
      idempotencyKey: `recalc-${options.id}-${Date.now()}`,
    },
    session: options.session,
    idToken: options.idToken,
  });
  await commitWrites(
    [
      writeOf(COSTING_COLLECTIONS.batchRecords, options.id, {
        ...current,
        status: "superseded",
        supersededBy: created.id,
        ...actorStamp(options.session, current),
      }),
    ],
    options.idToken
  );
  return created;
}

export async function transitionBatchCosting(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "finalize" | "reconcile" | "reopen";
  comment?: string;
  varianceExplanation?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(COSTING_COLLECTIONS.batchRecords, options.id, options.idToken, "Batch costing");
  const settings = await loadSettings(options.idToken);
  const map: Record<string, { next: string; permission: Parameters<typeof ensurePermission>[1] }> = {
    submit: { next: "validation", permission: "costingBatch:create" },
    approve: { next: "approved", permission: "costing:approve" },
    reject: { next: "rejected", permission: "costing:approve" },
    finalize: { next: "finalized", permission: "costing:complete" },
    reconcile: { next: "reconciled", permission: "costing:reconcile" },
    reopen: { next: "draft", permission: "costing:reopen" },
  };
  const step = map[options.action];
  if (!step) fail("Unsupported action.");
  ensurePermission(options.session, step.permission);

  if (options.action === "finalize" || options.action === "approve") {
    const varianceSummary = (current.varianceSummary || {}) as Record<string, unknown>;
    if (settings.requireVarianceExplanation && money(varianceSummary.totalUnfavorable) > 0) {
      if (!text(options.varianceExplanation || options.comment)) {
        fail("Variance explanation is required before approval/finalization.");
      }
    }
    if (text(current.completenessStatus) === "incomplete" && !settings.allowEstimatedWhenMissing) {
      fail("Incomplete cost records cannot be finalized while estimated costs are disabled.");
    }
  }

  if (options.action === "reopen") {
    if (!isFinalizedLocked(text(current.status)) && text(current.status) !== "approved") {
      fail("Only approved, finalized, or reconciled records can be reopened.");
    }
  } else {
    assertTransition(BATCH_COSTING_TRANSITIONS, text(current.status), step.next, options.action);
  }

  const next = {
    ...current,
    status: options.action === "reopen" ? "draft" : step.next,
    varianceExplanation: options.varianceExplanation || current.varianceExplanation || "",
    lastActionComment: options.comment || "",
    finalizedAt: options.action === "finalize" ? new Date().toISOString() : current.finalizedAt || "",
    finalizedBy: options.action === "finalize" ? options.session.uid : current.finalizedBy || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(COSTING_COLLECTIONS.batchRecords, options.id, next)], options.idToken);
  await auditCosting(options.idToken, options.session, {
    action: `BATCH_${options.action.toUpperCase()}`,
    resource: COSTING_COLLECTIONS.batchRecords,
    resourceId: options.id,
    description: `Batch costing ${text(current.batchCostingNumber)} → ${next.status}.`,
    reason: options.comment || options.varianceExplanation,
  });
  return { id: options.id, record: next };
}

export async function createCostVarianceInvestigation(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costingVariance:review");
  const data = parseOrFail(varianceInvestigationSchema, options.payload);
  await requireRecord(COSTING_COLLECTIONS.batchRecords, data.batchCostingId, options.idToken, "Batch costing");
  const numbered = await issueCostingNumber("INV", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    investigationId: id,
    investigationNumber: numbered.documentNumber,
    ...data,
    status: "under_review",
    searchIndex: searchIndex(numbered.documentNumber, data.batchCostingId, data.varianceType),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [writeOf(COSTING_COLLECTIONS.varianceInvestigations, id, record, { exists: false })],
    options.idToken
  );
  return { id, record };
}

export async function calculateProductProfitability(options: {
  productId: string;
  from?: string;
  to?: string;
  idToken: string;
  session: SessionPayload;
}) {
  ensurePermission(options.session, "costingReports:read");
  const { calculateProfitability } = await import("@/lib/costing/calculate");
  const invoices = await queryMasterDocuments("financeCustomerInvoiceLines", options.idToken, {
    filters: [{ field: "productId", value: options.productId }],
    limit: 300,
  }).catch(() => []);
  const batchCosts = await queryMasterDocuments(COSTING_COLLECTIONS.batchRecords, options.idToken, {
    filters: [{ field: "productId", value: options.productId }],
    limit: 200,
  });
  const finalizedCosts = batchCosts.filter((row) => ["finalized", "reconciled", "approved"].includes(text(row.status)));
  const avgUnitCost =
    finalizedCosts.length > 0
      ? money(finalizedCosts.reduce((sum, row) => addMoney(sum, row.costPerUnit), 0) / finalizedCosts.length)
      : 0;
  let netSales = 0;
  let qty = 0;
  for (const line of invoices) {
    netSales = addMoney(netSales, line.lineTotal);
    qty = addMoney(qty, line.quantity);
  }
  const productCost = multiplySafe(avgUnitCost, qty);
  const marginQuality =
    finalizedCosts.some((row) => text(row.status) === "finalized") && finalizedCosts.every((row) => text(row.dataQuality) === "actual")
      ? ("finalized" as const)
      : finalizedCosts.length
        ? (text(finalizedCosts[0].dataQuality) as "actual" | "provisional" | "estimated" | "standard")
        : ("missing" as const);
  return {
    productId: options.productId,
    invoiceLines: invoices.length,
    costedBatches: finalizedCosts.length,
    averageUnitCost: avgUnitCost,
    ...calculateProfitability({
      netSales,
      productCost,
      manufacturingCost: 0,
      marginQuality: marginQuality === "missing" ? "provisional" : marginQuality,
    }),
    unavailable: !invoices.length || !finalizedCosts.length,
  };
}

export async function calculateCustomerProfitability(options: {
  customerId: string;
  idToken: string;
  session: SessionPayload;
}) {
  ensurePermission(options.session, "costingReports:read");
  const { calculateProfitability } = await import("@/lib/costing/calculate");
  const invoices = await queryMasterDocuments("financeCustomerInvoices", options.idToken, {
    filters: [{ field: "customerId", value: options.customerId }],
    limit: 200,
  }).catch(() => []);
  const batchCosts = await queryMasterDocuments(COSTING_COLLECTIONS.batchRecords, options.idToken, {
    filters: [{ field: "customerId", value: options.customerId }],
    limit: 200,
  });
  const netSales = invoices
    .filter((row) => ["posted", "partially_paid", "paid"].includes(text(row.status)))
    .reduce((sum, row) => addMoney(sum, row.grandTotal), 0);
  const productCost = batchCosts
    .filter((row) => ["finalized", "reconciled", "approved"].includes(text(row.status)))
    .reduce((sum, row) => addMoney(sum, row.totalBatchCost), 0);
  return {
    customerId: options.customerId,
    invoiceCount: invoices.length,
    costedBatches: batchCosts.length,
    ...calculateProfitability({
      netSales,
      productCost,
      marginQuality: productCost > 0 && netSales > 0 ? "actual" : "provisional",
    }),
    unavailable: !invoices.length || !batchCosts.length,
  };
}

export async function reconcileCostingToLedger(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "costing:reconcile");
  const current = await requireRecord(COSTING_COLLECTIONS.batchRecords, options.id, options.idToken, "Batch costing");
  if (text(current.status) !== "finalized") fail("Only finalized costing can be reconciled to the ledger.");
  const postings = await queryMasterDocuments("financePostingRecords", options.idToken, {
    filters: [
      { field: "sourceDocumentType", value: "costingBatch" },
      { field: "sourceDocumentId", value: options.id },
    ],
    limit: 5,
  }).catch(() => []);
  const id = crypto.randomUUID();
  const record = {
    reconciliationId: id,
    batchCostingId: options.id,
    status: postings.length ? "matched" : "awaiting_finance_posting",
    ledgerPostingIds: postings.map((row) => String(row.id)),
    totalBatchCost: money(current.totalBatchCost),
    note: postings.length
      ? "Linked to existing finance posting records."
      : "No finance posting found. Costing is finalized but not auto-posted; use Finance journals if GL impact is required.",
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(COSTING_COLLECTIONS.reconciliations, id, record, { exists: false }),
      writeOf(COSTING_COLLECTIONS.batchRecords, options.id, {
        ...current,
        status: "reconciled",
        reconciliationId: id,
        ...actorStamp(options.session, current),
      }),
    ],
    options.idToken
  );
  return { id, record };
}

export async function loadBatchCostingExtras(id: string, idToken: string) {
  const [lines, variances, investigations] = await Promise.all([
    listByField(COSTING_COLLECTIONS.batchLines, "batchCostingId", id, idToken),
    listByField(COSTING_COLLECTIONS.varianceAnalyses, "batchCostingId", id, idToken),
    listByField(COSTING_COLLECTIONS.varianceInvestigations, "batchCostingId", id, idToken),
  ]);
  return { lines, variances, investigations };
}

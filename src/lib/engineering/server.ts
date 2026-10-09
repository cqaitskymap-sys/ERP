import type { AtomicWrite } from "@/lib/masters/firestore";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { ENGINEERING_COLLECTIONS } from "@/lib/engineering/collections";
import {
  actorStamp,
  auditEngineering,
  commitWrites,
  dateOnly,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueEngineeringNumber,
  listByField,
  notifyEngineering,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  searchIndex,
  text,
  toUtcIso,
  workflowFail,
  writeOf,
} from "@/lib/engineering/helpers";
import {
  assessEquipmentCriticality,
  calculateEquipmentDowntimeMinutes,
  calculateMaintenanceCost,
  calculateNextDueDate,
  daysUntil,
  scheduleTaskKey,
} from "@/lib/engineering/calculate";
import {
  BREAKDOWN_TRANSITIONS,
  EQUIPMENT_TRANSITIONS,
  WORK_ORDER_TRANSITIONS,
  canTransition,
  isClosedWorkOrder,
  isLockedEquipmentStatus,
} from "@/lib/engineering/status";
import { money } from "@/lib/finance/money";
import {
  breakdownSchema,
  equipmentSchema,
  maintenancePlanSchema,
  riskAssessmentSchema,
  spareLinkSchema,
  workOrderSchema,
  engineeringSettingsSchema,
  checklistSchema,
} from "@/lib/validation/engineering";
import type { SessionPayload } from "@/types/auth";

async function loadSettings(idToken: string) {
  const rows = await queryMasterDocuments(ENGINEERING_COLLECTIONS.settings, idToken, { limit: 1 });
  return (
    rows[0] || {
      pmDueSoonDays: 7,
      calibrationDueSoonDays: 14,
      requireQaReviewForCriticalBreakdowns: true,
      requireQaReviewForCalibrationFailure: true,
      restrictEquipmentOnCalibrationFailure: true,
      currency: "INR",
      allowEstimatedCostsInTotals: false,
    }
  );
}

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

export async function saveEngineeringSettings(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineering:update");
  const data = parseOrFail(engineeringSettingsSchema, options.payload);
  const existing = await queryMasterDocuments(ENGINEERING_COLLECTIONS.settings, options.idToken, { limit: 1 });
  const id = existing[0] ? String(existing[0].id) : "default";
  const record = { settingsId: id, ...data, ...actorStamp(options.session, existing[0]) };
  await commitWrites(
    [writeOf(ENGINEERING_COLLECTIONS.settings, id, record, { exists: existing[0] ? undefined : false })],
    options.idToken
  );
  return { id, record };
}

export async function createEquipmentRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringEquipment:create");
  const data = parseOrFail(equipmentSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  if (data.productionEquipmentId) {
    const linked = await readMasterDocument("productionEquipment", data.productionEquipmentId, options.idToken);
    if (!linked) fail("Linked production equipment was not found.");
  }
  if (data.qcInstrumentId) {
    const linked = await readMasterDocument("qcInstruments", data.qcInstrumentId, options.idToken);
    if (!linked) fail("Linked QC instrument was not found.");
  }

  const numbered = await issueEngineeringNumber("EQ", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    equipmentId: id,
    equipmentNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    lifecycle: [{ at: new Date().toISOString(), status: "draft", by: options.session.uid }],
    searchIndex: searchIndex(numbered.documentNumber, data.name, data.serialNumber, data.assetNumber),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.equipment, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditEngineering(options.idToken, options.session, {
    action: "EQUIPMENT_CREATED",
    resource: ENGINEERING_COLLECTIONS.equipment,
    resourceId: id,
    description: `Created equipment ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function transitionEquipmentStatus(options: {
  id: string;
  toStatus: string;
  reason?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringEquipment:update");
  const current = await requireRecord(ENGINEERING_COLLECTIONS.equipment, options.id, options.idToken, "Equipment");
  if (isLockedEquipmentStatus(text(current.status))) fail("Decommissioned equipment cannot change status.");
  assertTransition(EQUIPMENT_TRANSITIONS, text(current.status), options.toStatus, "change status");

  if (options.toStatus === "decommissioned") {
    const openWo = await queryMasterDocuments(ENGINEERING_COLLECTIONS.workOrders, options.idToken, {
      filters: [{ field: "equipmentId", value: options.id }],
      limit: 50,
    });
    if (openWo.some((row) => !isClosedWorkOrder(text(row.status)))) {
      fail("Close open work orders before decommissioning equipment.");
    }
    const openCal = await queryMasterDocuments(ENGINEERING_COLLECTIONS.calibrationRecords, options.idToken, {
      filters: [{ field: "equipmentId", value: options.id }],
      limit: 20,
    }).catch(() => []);
    if (openCal.some((row) => !["closed", "cancelled", "passed"].includes(text(row.status)))) {
      fail("Resolve open calibration records before decommissioning.");
    }
  }

  const lifecycle = Array.isArray(current.lifecycle) ? [...(current.lifecycle as unknown[])] : [];
  lifecycle.push({
    at: new Date().toISOString(),
    status: options.toStatus,
    by: options.session.uid,
    reason: options.reason || "",
  });
  const next = {
    ...current,
    status: options.toStatus,
    lifecycle,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(ENGINEERING_COLLECTIONS.equipment, options.id, next)], options.idToken);
  await auditEngineering(options.idToken, options.session, {
    action: "EQUIPMENT_STATUS",
    resource: ENGINEERING_COLLECTIONS.equipment,
    resourceId: options.id,
    description: `Equipment ${text(current.equipmentNumber)}: ${text(current.status)} → ${options.toStatus}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

export async function assessEquipmentCriticalityRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringEquipment:update");
  const data = parseOrFail(riskAssessmentSchema, options.payload);
  await requireRecord(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");
  const scored = assessEquipmentCriticality(data);
  const id = crypto.randomUUID();
  const record = {
    assessmentId: id,
    ...data,
    ...scored,
    assessorId: options.session.uid,
    assessmentDate: dateOnly(),
    status: "active",
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(ENGINEERING_COLLECTIONS.riskAssessments, id, record, { exists: false }),
      writeOf(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, {
        criticality: scored.classification,
        latestRiskAssessmentId: id,
        riskScore: scored.riskScore,
        ...actorStamp(options.session),
      }),
    ],
    options.idToken
  );
  return { id, record };
}

export async function createMaintenancePlan(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringMaintenance:create");
  const data = parseOrFail(maintenancePlanSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  await requireRecord(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");

  const numbered = await issueEngineeringNumber("PM", options.session, options.idToken);
  const nextDueDate = calculateNextDueDate({
    fromDate: data.startDate,
    frequency: data.frequency,
    customIntervalDays: data.customIntervalDays,
  });
  const id = crypto.randomUUID();
  const record = {
    planId: id,
    planNumber: numbered.documentNumber,
    ...data,
    lastCompletedDate: "",
    nextDueDate,
    status: data.active ? "active" : "inactive",
    searchIndex: searchIndex(numbered.documentNumber, data.name, data.equipmentId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.maintenancePlans, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function generateMaintenanceTasks(options: {
  planId?: string;
  horizonDays?: number;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringMaintenance:create");
  const horizon = Math.min(Math.max(Number(options.horizonDays || 30), 1), 366);
  const today = dateOnly();
  const horizonDate = calculateNextDueDate({ fromDate: today, frequency: "custom", customIntervalDays: horizon });
  const plans = options.planId
    ? [await requireRecord(ENGINEERING_COLLECTIONS.maintenancePlans, options.planId, options.idToken, "Maintenance plan")]
    : await queryMasterDocuments(ENGINEERING_COLLECTIONS.maintenancePlans, options.idToken, {
        filters: [{ field: "status", value: "active" }],
        limit: 200,
      });

  const created: string[] = [];
  const writes: AtomicWrite[] = [];
  for (const plan of plans) {
    let due = text(plan.nextDueDate) || text(plan.startDate);
    if (!due) continue;
    let guard = 0;
    while (due <= horizonDate && guard < 24) {
      guard += 1;
      const key = scheduleTaskKey(String(plan.id), due);
      const existing = await readMasterDocument(ENGINEERING_COLLECTIONS.idempotency, `pmtask-${key}`, options.idToken);
      if (!existing) {
        const numbered = await issueEngineeringNumber("PMT", options.session, options.idToken);
        const taskId = crypto.randomUUID();
        const task = {
          taskId,
          taskNumber: numbered.documentNumber,
          planId: String(plan.id),
          equipmentId: text(plan.equipmentId),
          dueDate: due,
          status: "scheduled",
          taskDescription: text(plan.taskDescription),
          assignedTechnicianId: text(plan.assignedTechnicianId),
          checklistId: text(plan.checklistId),
          scheduleKey: key,
          searchIndex: searchIndex(numbered.documentNumber, plan.equipmentId, due),
          ...actorStamp(options.session),
        };
        writes.push(writeOf(ENGINEERING_COLLECTIONS.maintenanceTasks, taskId, task, { exists: false }));
        writes.push(idempotencyWrite(`pmtask-${key}`, { id: taskId, task }, options.session));
        created.push(taskId);
      }
      due = calculateNextDueDate({
        fromDate: due,
        frequency: text(plan.frequency),
        customIntervalDays: Number(plan.customIntervalDays || 0),
      });
    }
  }
  await commitWrites(writes, options.idToken);
  return { createdCount: created.length, taskIds: created };
}

export async function completeMaintenanceTask(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringMaintenance:update");
  const current = await requireRecord(ENGINEERING_COLLECTIONS.maintenanceTasks, options.id, options.idToken, "Maintenance task");
  if (!["scheduled", "due", "overdue", "in_progress"].includes(text(current.status))) {
    fail("Only open maintenance tasks can be completed.");
  }
  const completedDate = dateOnly(String(options.payload.completedDate || new Date().toISOString()));
  const observations = text(options.payload.observations);
  const next = {
    ...current,
    status: "completed",
    completedDate,
    actualDurationMinutes: Number(options.payload.actualDurationMinutes || 0),
    observations,
    completedBy: options.session.uid,
    ...actorStamp(options.session, current),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.maintenanceTasks, options.id, next)];
  if (text(current.planId)) {
    const plan = await requireRecord(ENGINEERING_COLLECTIONS.maintenancePlans, text(current.planId), options.idToken, "Plan");
    const nextDueDate = calculateNextDueDate({
      fromDate: completedDate,
      frequency: text(plan.frequency),
      customIntervalDays: Number(plan.customIntervalDays || 0),
    });
    writes.push(
      writeOf(ENGINEERING_COLLECTIONS.maintenancePlans, text(current.planId), {
        ...plan,
        lastCompletedDate: completedDate,
        nextDueDate,
        ...actorStamp(options.session, plan),
      })
    );
  }
  await commitWrites(writes, options.idToken);
  return { id: options.id, record: next };
}

export async function createMaintenanceWorkOrder(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringWorkOrder:create");
  const data = parseOrFail(workOrderSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  const equipment = await requireRecord(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");
  if (text(equipment.status) === "decommissioned") fail("Cannot create work orders for decommissioned equipment.");

  const numbered = await issueEngineeringNumber("MWO", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    workOrderId: id,
    workOrderNumber: numbered.documentNumber,
    ...data,
    reportedBy: options.session.uid,
    reportedAt: new Date().toISOString(),
    status: "draft",
    stockIssueId: "",
    reservationIds: [] as string[],
    laborHours: 0,
    maintenanceCost: 0,
    costQuality: "actual",
    searchIndex: searchIndex(numbered.documentNumber, data.equipmentId, data.failureDescription),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.workOrders, id, record, { exists: false })];
  for (const part of data.sparePartRequests) {
    const lineId = crypto.randomUUID();
    writes.push(
      writeOf(
        ENGINEERING_COLLECTIONS.workOrderLines,
        lineId,
        {
          lineId,
          workOrderId: id,
          materialId: part.materialId,
          quantity: money(part.quantity),
          uom: part.uom || "",
          status: "requested",
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditEngineering(options.idToken, options.session, {
    action: "WORK_ORDER_CREATED",
    resource: ENGINEERING_COLLECTIONS.workOrders,
    resourceId: id,
    description: `Created work order ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function transitionWorkOrder(options: {
  id: string;
  action: string;
  comment?: string;
  payload?: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(ENGINEERING_COLLECTIONS.workOrders, options.id, options.idToken, "Work order");
  const actionMap: Record<string, { next: string; permission: Parameters<typeof ensurePermission>[1] }> = {
    submit: { next: "submitted", permission: "engineeringWorkOrder:create" },
    approve: { next: "approved", permission: "engineeringWorkOrder:approve" },
    reject: { next: "rejected", permission: "engineeringWorkOrder:approve" },
    assign: { next: "assigned", permission: "engineeringWorkOrder:update" },
    start: { next: "in_progress", permission: "engineeringWorkOrder:update" },
    wait_parts: { next: "waiting_for_parts", permission: "engineeringWorkOrder:update" },
    complete_work: { next: "work_completed", permission: "engineeringWorkOrder:update" },
    engineering_review: { next: "engineering_review", permission: "engineeringWorkOrder:approve" },
    qa_review: { next: "qa_review", permission: "engineeringWorkOrder:approve" },
    close: { next: "closed", permission: "engineeringWorkOrder:close" },
    reopen: { next: "reopened", permission: "engineeringWorkOrder:approve" },
    cancel: { next: "cancelled", permission: "engineeringWorkOrder:update" },
  };
  const step = actionMap[options.action];
  if (!step) fail(`Unsupported work order action "${options.action}".`);
  ensurePermission(options.session, step.permission);
  assertTransition(WORK_ORDER_TRANSITIONS, text(current.status), step.next, options.action);

  if (options.action === "close") {
    if (current.requireQaReview && text(current.status) !== "qa_review") {
      fail("QA review is required before closing this work order.");
    }
    if (!text(current.completionReport) && !text(options.payload?.completionReport)) {
      fail("Completion report is required to close a work order.");
    }
  }

  const costs = calculateMaintenanceCost({
    laborCost: options.payload?.laborCost ?? current.laborCost,
    sparePartCost: options.payload?.sparePartCost ?? current.sparePartCost,
    serviceProviderCost: options.payload?.serviceProviderCost ?? current.serviceProviderCost,
    otherCost: options.payload?.otherCost ?? current.otherCost,
    estimated: Boolean(options.payload?.estimated),
  });

  const next = {
    ...current,
    status: step.next,
    assignedTechnicianId: text(options.payload?.assignedTechnicianId || current.assignedTechnicianId),
    actualStart: options.action === "start" ? toUtcIso() : current.actualStart || "",
    actualEnd: ["complete_work", "close"].includes(options.action) ? toUtcIso() : current.actualEnd || "",
    completionReport: text(options.payload?.completionReport || current.completionReport),
    laborHours: Number(options.payload?.laborHours ?? current.laborHours ?? 0),
    ...costs,
    maintenanceCost: costs.totalCost,
    lastActionComment: options.comment || "",
    ...actorStamp(options.session, current),
  };

  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.workOrders, options.id, next)];
  if (options.action === "start" || options.action === "assign") {
    writes.push(
      writeOf(ENGINEERING_COLLECTIONS.equipment, text(current.equipmentId), {
        status: "under_maintenance",
        ...actorStamp(options.session),
      })
    );
  }
  if (options.action === "close") {
    writes.push(
      writeOf(ENGINEERING_COLLECTIONS.equipment, text(current.equipmentId), {
        status: "in_service",
        ...actorStamp(options.session),
      })
    );
    const costId = crypto.randomUUID();
    writes.push(
      writeOf(
        ENGINEERING_COLLECTIONS.maintenanceCosts,
        costId,
        {
          costId,
          workOrderId: options.id,
          equipmentId: text(current.equipmentId),
          ...costs,
          period: dateOnly().slice(0, 7),
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  await commitWrites(writes, options.idToken);
  await auditEngineering(options.idToken, options.session, {
    action: `WORK_ORDER_${options.action.toUpperCase()}`,
    resource: ENGINEERING_COLLECTIONS.workOrders,
    resourceId: options.id,
    description: `Work order ${text(current.workOrderNumber)} → ${step.next}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function reportEquipmentBreakdown(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringWorkOrder:create");
  const data = parseOrFail(breakdownSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  await requireRecord(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");
  const settings = await loadSettings(options.idToken);

  const numbered = await issueEngineeringNumber("BRK", options.session, options.idToken);
  const id = crypto.randomUUID();
  const requiresQa =
    data.qualityImpact ||
    (settings.requireQaReviewForCriticalBreakdowns && ["critical", "high"].includes(data.severity));
  const record = {
    breakdownId: id,
    breakdownNumber: numbered.documentNumber,
    ...data,
    failureAt: toUtcIso(data.failureAt),
    downtimeStart: toUtcIso(data.downtimeStart || data.failureAt),
    downtimeEnd: "",
    downtimeMinutes: 0,
    reportedBy: options.session.uid,
    status: "reported",
    requiresQaAssessment: requiresQa,
    deviationId: "",
    capaId: "",
    workOrderId: "",
    searchIndex: searchIndex(numbered.documentNumber, data.equipmentId, data.symptoms),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [
    writeOf(ENGINEERING_COLLECTIONS.breakdowns, id, record, { exists: false }),
    writeOf(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, {
      status: data.severity === "critical" ? "out_of_service" : "under_maintenance",
      ...actorStamp(options.session),
    }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);

  await notifyEngineering(options.idToken, options.session, {
    type: "engineering_breakdown",
    title: `Breakdown ${numbered.documentNumber}`,
    message: `Equipment breakdown reported (${data.severity}). QA assessment ${requiresQa ? "required" : "not auto-required"}. Open /engineering/breakdowns/${id}.`,
    module: "engineering",
    resource: ENGINEERING_COLLECTIONS.breakdowns,
    resourceId: id,
    severity: data.severity === "critical" ? "critical" : "warning",
    audienceRoles: ["maintenance", "finance", "qa", "management"],
  });

  // Auto-create linked corrective work order draft
  const wo = await createMaintenanceWorkOrder({
    payload: {
      equipmentId: data.equipmentId,
      workOrderType: "breakdown",
      priority: data.severity,
      failureDescription: data.symptoms,
      breakdownId: id,
      requireQaReview: requiresQa,
      notes: `Auto-created from breakdown ${numbered.documentNumber}`,
    },
    session: options.session,
    idToken: options.idToken,
  });
  await commitWrites(
    [
      writeOf(ENGINEERING_COLLECTIONS.breakdowns, id, {
        ...record,
        workOrderId: wo.id,
        ...actorStamp(options.session, record),
      }),
    ],
    options.idToken
  );

  return { id, record: { ...record, workOrderId: wo.id }, workOrderId: wo.id };
}

export async function transitionBreakdown(options: {
  id: string;
  action: string;
  comment?: string;
  payload?: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringWorkOrder:update");
  const current = await requireRecord(ENGINEERING_COLLECTIONS.breakdowns, options.id, options.idToken, "Breakdown");
  const map: Record<string, string> = {
    acknowledge: "acknowledged",
    repair: "under_repair",
    wait_parts: "awaiting_parts",
    restore: "restored",
    qa_assessment: "qa_assessment",
    close: "closed",
    cancel: "cancelled",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail("Unsupported breakdown action.");
  assertTransition(BREAKDOWN_TRANSITIONS, text(current.status), nextStatus, options.action);

  if (options.action === "close" && current.requiresQaAssessment && text(current.status) !== "qa_assessment") {
    fail("QA assessment is required before closing this breakdown. Product impact is not auto-determined.");
  }
  if (options.action === "close" && options.payload?.deviationId) {
    const deviation = await readMasterDocument("qaDeviations", String(options.payload.deviationId), options.idToken);
    if (!deviation) fail("Linked QA deviation was not found.");
  }

  const downtimeEnd =
    options.action === "restore" || options.action === "close"
      ? toUtcIso(String(options.payload?.downtimeEnd || new Date().toISOString()))
      : text(current.downtimeEnd);
  const downtimeMinutes = text(current.downtimeStart)
    ? calculateEquipmentDowntimeMinutes({
        downtimeStart: text(current.downtimeStart),
        downtimeEnd: downtimeEnd || undefined,
      })
    : 0;

  const next = {
    ...current,
    status: nextStatus,
    downtimeEnd,
    downtimeMinutes,
    deviationId: text(options.payload?.deviationId || current.deviationId),
    capaId: text(options.payload?.capaId || current.capaId),
    restorationVerification: text(options.payload?.restorationVerification || current.restorationVerification),
    lastActionComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.breakdowns, options.id, next)];
  if (options.action === "close") {
    writes.push(
      writeOf(ENGINEERING_COLLECTIONS.equipment, text(current.equipmentId), {
        status: "in_service",
        ...actorStamp(options.session),
      })
    );
  }
  await commitWrites(writes, options.idToken);
  return { id: options.id, record: next };
}

export async function createChecklist(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringMaintenance:create");
  const data = parseOrFail(checklistSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    checklistId: id,
    ...data,
    status: "active",
    searchIndex: searchIndex(data.name, data.version),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(ENGINEERING_COLLECTIONS.checklists, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createSpareLink(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineering:update");
  const data = parseOrFail(spareLinkSchema, options.payload);
  const material = await readMasterDocument("materials", data.materialId, options.idToken);
  if (!material) fail("Spare part material was not found in materials master.");
  const id = crypto.randomUUID();
  const record = {
    spareLinkId: id,
    ...data,
    description: text(material.name || material.materialName),
    searchIndex: searchIndex(data.materialId, data.partNumber, material.name),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(ENGINEERING_COLLECTIONS.spareLinks, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function reserveMaintenanceSpareParts(options: {
  workOrderId: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringWorkOrder:update");
  const wo = await requireRecord(ENGINEERING_COLLECTIONS.workOrders, options.workOrderId, options.idToken, "Work order");
  const lines = await listByField(ENGINEERING_COLLECTIONS.workOrderLines, "workOrderId", options.workOrderId, options.idToken);
  if (!lines.length) fail("No spare part lines on this work order.");
  // Do not mutate inventory balances here — create a linked stock issue draft reference for warehouse workflow.
  const stockIssueRef = {
    referenceType: "engineering_work_order",
    referenceId: options.workOrderId,
    workOrderNumber: text(wo.workOrderNumber),
    lines: lines.map((line) => ({
      materialId: text(line.materialId),
      quantity: money(line.quantity),
      uom: text(line.uom),
    })),
    note: "Create/complete a warehouse stock issue with this reference to consume spare parts. Engineering UI does not edit inventory quantities.",
  };
  const next = {
    ...wo,
    status: text(wo.status) === "assigned" || text(wo.status) === "in_progress" ? "waiting_for_parts" : wo.status,
    spareReservationRequest: stockIssueRef,
    ...actorStamp(options.session, wo),
  };
  await commitWrites([writeOf(ENGINEERING_COLLECTIONS.workOrders, options.workOrderId, next)], options.idToken);
  return { id: options.workOrderId, record: next, inventoryNote: stockIssueRef.note };
}

export { loadSettings, daysUntil };

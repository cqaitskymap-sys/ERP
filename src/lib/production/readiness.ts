import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { checkMaterialAvailability } from "@/lib/production/availability";
import { checkEquipmentEligibility, checkOperatorEligibility } from "@/lib/production/eligibility";
import { calculateMaterialRequirements } from "@/lib/production/requirements";
import { listByField, text } from "@/lib/production/helpers";
import { readMasterDocument, type MasterRecord } from "@/lib/masters/firestore";
import type { ReadinessResult } from "@/types/production";

export async function checkProductionReadiness(options: {
  order: MasterRecord;
  idToken: string;
}): Promise<ReadinessResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const order = options.order;
  if (!["approved", "ready", "dispensing_pending"].includes(text(order.status))) {
    blockers.push("Manufacturing order must be approved before start.");
  }
  if (!text(order.bomId)) blockers.push("An effective BOM must be linked to the order.");
  const bom = text(order.bomId)
    ? await readMasterDocument(PRODUCTION_COLLECTIONS.boms, text(order.bomId), options.idToken)
    : null;
  if (bom && !["approved", "effective"].includes(text(bom.status))) {
    blockers.push("Linked BOM is not effective.");
  }
  const bomItems = text(order.bomId)
    ? await listByField(PRODUCTION_COLLECTIONS.bomItems, "bomId", text(order.bomId), options.idToken)
    : [];
  if (!bomItems.length) blockers.push("BOM has no material lines.");
  if (bom && bomItems.length) {
    const required = calculateMaterialRequirements({
      bomBatchSize: Number(bom.batchSize || 0),
      orderBatchSize: Number(order.batchSize || order.plannedQuantity || 0),
      items: bomItems.map((item) => ({
        materialId: text(item.materialId),
        quantity: Number(item.quantity || 0),
        uom: text(item.uom),
        wastageAllowance: Number(item.wastageAllowance || 0),
        materialStage: text(item.materialStage),
        sequence: Number(item.sequence || 0),
      })),
    });
    const availability = await checkMaterialAvailability(required, options.idToken, {
      warehouseId: text(order.warehouseId) || undefined,
    });
    for (const line of availability) {
      if (line.status === "short") {
        blockers.push(`Material shortage for ${line.materialId}: need ${line.requiredQuantity}, available ${line.availableQuantity}.`);
      }
    }
  }
  const equipment = await listByField(
    PRODUCTION_COLLECTIONS.equipmentAssignments,
    "manufacturingOrderId",
    String(order.id),
    options.idToken
  );
  if (!equipment.length) warnings.push("No equipment is assigned.");
  for (const row of equipment) {
    const asset = await readMasterDocument(PRODUCTION_COLLECTIONS.equipment, text(row.equipmentId), options.idToken);
    const check = checkEquipmentEligibility({ equipment: asset });
    if (!check.eligible) blockers.push(...check.reasons);
    warnings.push(...check.warnings);
  }
  const operators = await listByField(
    PRODUCTION_COLLECTIONS.operatorAssignments,
    "manufacturingOrderId",
    String(order.id),
    options.idToken
  );
  if (!operators.length) warnings.push("No operators are assigned.");
  for (const row of operators) {
    const user = await readMasterDocument("users", text(row.userId), options.idToken);
    const check = checkOperatorEligibility({ user });
    if (!check.eligible) blockers.push(...check.reasons);
    warnings.push(...check.warnings);
  }
  const templates = await listByField(PRODUCTION_COLLECTIONS.processTemplates, "productId", text(order.productId), options.idToken);
  const bomSteps = Array.isArray(bom?.processSteps) ? bom.processSteps : [];
  if (!templates.length && !bomSteps.length) {
    blockers.push("Required process steps are not configured for this product.");
  }
  return { ready: blockers.length === 0, blockers, warnings };
}

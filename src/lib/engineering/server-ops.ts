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
  calculateMTBF,
  calculateMTTR,
  calculateMaintenanceCost,
  calculateNextCalibrationDueDate,
  complianceRate,
  evaluateCalibrationResults,
  evaluateUtilityLimits,
} from "@/lib/engineering/calculate";
import {
  CALIBRATION_TRANSITIONS,
  QUALIFICATION_TRANSITIONS,
  canTransition,
} from "@/lib/engineering/status";
import { money } from "@/lib/finance/money";
import {
  calibrationRecordSchema,
  calibrationResultsSchema,
  instrumentSchema,
  monitoringRecordSchema,
  qualificationSchema,
  utilitySystemSchema,
} from "@/lib/validation/engineering";
import { loadSettings } from "@/lib/engineering/server";
import type { SessionPayload } from "@/types/auth";

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

export async function createInstrumentRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringCalibration:create");
  const data = parseOrFail(instrumentSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  if (data.equipmentId) {
    await requireRecord(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");
  }
  if (money(data.toleranceLower) > money(data.toleranceUpper)) {
    fail("Instrument tolerance lower limit cannot exceed upper limit.");
  }
  const numbered = await issueEngineeringNumber("INS", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    instrumentId: id,
    instrumentNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    lastCalibrationDate: "",
    nextCalibrationDueDate: "",
    calibrationStatus: "not_calibrated",
    searchIndex: searchIndex(numbered.documentNumber, data.name, data.serialNumber),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.instruments, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createCalibrationRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringCalibration:create");
  const data = parseOrFail(calibrationRecordSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  const instrument = await requireRecord(
    ENGINEERING_COLLECTIONS.instruments,
    data.instrumentId,
    options.idToken,
    "Instrument"
  );
  const numbered = await issueEngineeringNumber("CAL", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    calibrationId: id,
    calibrationNumber: numbered.documentNumber,
    ...data,
    equipmentId: text(instrument.equipmentId),
    status: "scheduled",
    outcome: "",
    certificateReference: "",
    searchIndex: searchIndex(numbered.documentNumber, data.instrumentId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [
    writeOf(ENGINEERING_COLLECTIONS.calibrationRecords, id, record, { exists: false }),
    writeOf(ENGINEERING_COLLECTIONS.instruments, data.instrumentId, {
      ...instrument,
      status: "calibration_due",
      ...actorStamp(options.session, instrument),
    }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function transitionCalibration(options: {
  id: string;
  action: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(
    ENGINEERING_COLLECTIONS.calibrationRecords,
    options.id,
    options.idToken,
    "Calibration"
  );
  const map: Record<string, { next: string; permission: Parameters<typeof ensurePermission>[1] }> = {
    request: { next: "requested", permission: "engineeringCalibration:create" },
    approve: { next: "approved", permission: "engineeringCalibration:approve" },
    start: { next: "in_progress", permission: "engineeringCalibration:update" },
    submit_results: { next: "results_review", permission: "engineeringCalibration:update" },
    cancel: { next: "cancelled", permission: "engineeringCalibration:update" },
  };
  const step = map[options.action];
  if (!step) fail("Unsupported calibration action.");
  ensurePermission(options.session, step.permission);
  assertTransition(CALIBRATION_TRANSITIONS, text(current.status), step.next, options.action);
  const next = {
    ...current,
    status: step.next,
    lastActionComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  if (options.action === "start") {
    await commitWrites(
      [
        writeOf(ENGINEERING_COLLECTIONS.calibrationRecords, options.id, next),
        writeOf(ENGINEERING_COLLECTIONS.instruments, text(current.instrumentId), {
          status: "under_calibration",
          ...actorStamp(options.session),
        }),
      ],
      options.idToken
    );
  } else {
    await commitWrites([writeOf(ENGINEERING_COLLECTIONS.calibrationRecords, options.id, next)], options.idToken);
  }
  return { id: options.id, record: next };
}

export async function evaluateCalibrationResultsRecord(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringCalibration:update");
  const current = await requireRecord(
    ENGINEERING_COLLECTIONS.calibrationRecords,
    options.id,
    options.idToken,
    "Calibration"
  );
  if (!["in_progress", "results_review"].includes(text(current.status))) {
    fail("Results can only be entered for in-progress calibrations.");
  }
  const data = parseOrFail(calibrationResultsSchema, options.payload);
  const evaluation = evaluateCalibrationResults({ readings: data.readings });
  // Never fabricate — require as-left readings for pass
  if (evaluation.outcome === "passed" && evaluation.details.some((row) => row.asLeft == null)) {
    fail("As-left readings are required to pass calibration.");
  }

  const resultId = crypto.randomUUID();
  const resultRecord = {
    resultId,
    calibrationId: options.id,
    instrumentId: text(current.instrumentId),
    ...data,
    ...evaluation,
    recordedBy: options.session.uid,
    ...actorStamp(options.session),
  };

  const nextStatus =
    evaluation.outcome === "passed"
      ? "passed"
      : evaluation.outcome === "out_of_tolerance"
        ? "out_of_tolerance"
        : "failed";
  assertTransition(CALIBRATION_TRANSITIONS, "results_review", nextStatus, "evaluate");

  const next = {
    ...current,
    status: "results_review",
    outcome: evaluation.outcome,
    certificateReference: data.certificateReference || "",
    calibrationDate: dateOnly(data.calibrationDate),
    technicianId: data.technicianId || options.session.uid,
    resultId,
    ...actorStamp(options.session, current),
  };

  await commitWrites(
    [
      writeOf(ENGINEERING_COLLECTIONS.calibrationResults, resultId, resultRecord, { exists: false }),
      writeOf(ENGINEERING_COLLECTIONS.calibrationRecords, options.id, next),
    ],
    options.idToken
  );
  return { id: options.id, record: next, evaluation };
}

export async function reviewCalibration(options: {
  id: string;
  action: "pass" | "fail" | "oot" | "close";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringCalibration:approve");
  const current = await requireRecord(
    ENGINEERING_COLLECTIONS.calibrationRecords,
    options.id,
    options.idToken,
    "Calibration"
  );
  const settings = await loadSettings(options.idToken);
  const instrument = await requireRecord(
    ENGINEERING_COLLECTIONS.instruments,
    text(current.instrumentId),
    options.idToken,
    "Instrument"
  );

  let nextStatus = "";
  if (options.action === "close") nextStatus = "closed";
  else if (options.action === "pass") nextStatus = "passed";
  else if (options.action === "fail") nextStatus = "failed";
  else nextStatus = "out_of_tolerance";

  if (options.action !== "close") {
    assertTransition(CALIBRATION_TRANSITIONS, text(current.status), nextStatus, options.action);
  } else {
    assertTransition(CALIBRATION_TRANSITIONS, text(current.status), "closed", "close");
  }

  if (["pass", "fail", "oot"].includes(options.action) && !text(current.resultId)) {
    fail("Calibration results must be recorded before review. Results are not fabricated.");
  }

  const writes: AtomicWrite[] = [];
  let instrumentUpdate: Record<string, unknown> = { ...instrument };

  if (options.action === "pass" || (options.action === "close" && text(current.outcome) === "passed")) {
    const nextDue = calculateNextCalibrationDueDate({
      calibrationDate: text(current.calibrationDate) || dateOnly(),
      frequency: text(instrument.calibrationFrequency) || "yearly",
      customIntervalDays: Number(instrument.customIntervalDays || 0),
    });
    instrumentUpdate = {
      ...instrument,
      status: "in_service",
      calibrationStatus: "calibrated",
      lastCalibrationDate: text(current.calibrationDate) || dateOnly(),
      nextCalibrationDueDate: nextDue,
      ...actorStamp(options.session, instrument),
    };
  }

  if (options.action === "oot" || options.action === "fail" || text(current.outcome) === "out_of_tolerance") {
    if (settings.restrictEquipmentOnCalibrationFailure) {
      instrumentUpdate = {
        ...instrument,
        status: "restricted",
        calibrationStatus: "out_of_tolerance",
        ...actorStamp(options.session, instrument),
      };
      if (text(instrument.equipmentId)) {
        writes.push(
          writeOf(ENGINEERING_COLLECTIONS.equipment, text(instrument.equipmentId), {
            status: "restricted",
            ...actorStamp(options.session),
          })
        );
      }
    }
    await notifyEngineering(options.idToken, options.session, {
      type: "engineering_calibration_oot",
      title: `Calibration ${text(current.calibrationNumber)} out of tolerance`,
      message:
        "Instrument flagged. Impact on prior batches/results requires authorized QA assessment and is not auto-determined.",
      module: "engineering",
      resource: ENGINEERING_COLLECTIONS.calibrationRecords,
      resourceId: options.id,
      severity: "critical",
      audienceRoles: ["maintenance", "qa", "management"],
    });
  }

  const next = {
    ...current,
    status: options.action === "close" ? "closed" : nextStatus,
    reviewedBy: options.session.uid,
    reviewedAt: new Date().toISOString(),
    lastActionComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  writes.push(writeOf(ENGINEERING_COLLECTIONS.calibrationRecords, options.id, next));
  writes.push(writeOf(ENGINEERING_COLLECTIONS.instruments, text(current.instrumentId), instrumentUpdate));
  await commitWrites(writes, options.idToken);
  await auditEngineering(options.idToken, options.session, {
    action: `CALIBRATION_${options.action.toUpperCase()}`,
    resource: ENGINEERING_COLLECTIONS.calibrationRecords,
    resourceId: options.id,
    description: `Calibration ${text(current.calibrationNumber)} review action ${options.action}.`,
    reason: options.comment,
    severity: options.action === "oot" ? "critical" : "info",
  });
  return { id: options.id, record: next };
}

export async function createQualificationRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringQualification:create");
  const data = parseOrFail(qualificationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  await requireRecord(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");
  const numbered = await issueEngineeringNumber("QUAL", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    qualificationId: id,
    qualificationNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.equipmentId, data.qualificationType),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [
    writeOf(ENGINEERING_COLLECTIONS.qualifications, id, record, { exists: false }),
    writeOf(ENGINEERING_COLLECTIONS.equipment, data.equipmentId, {
      status: "qualification_pending",
      ...actorStamp(options.session),
    }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function transitionQualification(options: {
  id: string;
  action: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringQualification:approve");
  const current = await requireRecord(
    ENGINEERING_COLLECTIONS.qualifications,
    options.id,
    options.idToken,
    "Qualification"
  );
  const map: Record<string, string> = {
    approve_protocol: "protocol_approved",
    start: "in_execution",
    submit_review: "under_review",
    approve: "approved",
    make_effective: "effective",
    reject: "rejected",
    supersede: "superseded",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail("Unsupported qualification action.");
  assertTransition(QUALIFICATION_TRANSITIONS, text(current.status), nextStatus, options.action);

  if (options.action === "approve" || options.action === "make_effective") {
    if (!text(current.protocolDocumentId) && !text(current.reportDocumentId)) {
      fail("Qualification cannot be approved from uploads alone without protocol/report references and review.");
    }
  }

  const next = {
    ...current,
    status: nextStatus,
    lastActionComment: options.comment || "",
    approvedBy: ["approve", "make_effective"].includes(options.action) ? options.session.uid : current.approvedBy || "",
    ...actorStamp(options.session, current),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.qualifications, options.id, next)];
  if (nextStatus === "effective") {
    writes.push(
      writeOf(ENGINEERING_COLLECTIONS.equipment, text(current.equipmentId), {
        status: "in_service",
        qualificationStatus: "qualified",
        ...actorStamp(options.session),
      })
    );
  }
  await commitWrites(writes, options.idToken);
  return { id: options.id, record: next };
}

export async function createUtilitySystem(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringUtilities:create");
  const data = parseOrFail(utilitySystemSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  if (data.lowerLimit != null && data.upperLimit != null && money(data.lowerLimit) > money(data.upperLimit)) {
    fail("Configured utility limits are invalid.");
  }
  const numbered = await issueEngineeringNumber("UTIL", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    utilitySystemId: id,
    utilityNumber: numbered.documentNumber,
    ...data,
    status: "active",
    searchIndex: searchIndex(numbered.documentNumber, data.name, data.systemType),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.utilitySystems, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function recordUtilityMeasurement(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringMonitoring:create");
  const data = parseOrFail(monitoringRecordSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown>; alertId?: string };
  const system = await requireRecord(
    ENGINEERING_COLLECTIONS.utilitySystems,
    data.utilitySystemId,
    options.idToken,
    "Utility system"
  );
  const lower = data.lowerLimit ?? system.lowerLimit;
  const upper = data.upperLimit ?? system.upperLimit;
  const evaluation = evaluateUtilityLimits({ value: data.value, lowerLimit: lower, upperLimit: upper });
  const id = crypto.randomUUID();
  const record = {
    monitoringId: id,
    ...data,
    measuredAt: toUtcIso(data.measuredAt),
    lowerLimit: evaluation.lowerLimit,
    upperLimit: evaluation.upperLimit,
    withinLimits: evaluation.withinLimits,
    excursionType: evaluation.excursionType,
    reviewStatus: evaluation.withinLimits ? "accepted" : "alert",
    recordedBy: options.session.uid,
    searchIndex: searchIndex(data.utilitySystemId, data.parameter, data.measuredAt),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(ENGINEERING_COLLECTIONS.monitoringRecords, id, record, { exists: false })];
  let alertId: string | undefined;
  if (!evaluation.withinLimits) {
    alertId = crypto.randomUUID();
    const alertNumber = await issueEngineeringNumber("ALERT", options.session, options.idToken);
    writes.push(
      writeOf(
        ENGINEERING_COLLECTIONS.utilityAlerts,
        alertId,
        {
          alertId,
          alertNumber: alertNumber.documentNumber,
          utilitySystemId: data.utilitySystemId,
          monitoringId: id,
          parameter: data.parameter,
          value: evaluation.value,
          lowerLimit: evaluation.lowerLimit,
          upperLimit: evaluation.upperLimit,
          excursionType: evaluation.excursionType,
          status: "open",
          acknowledgedAt: "",
          deviationId: "",
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(data.idempotencyKey, { id, record, alertId }, options.session));
  }
  await commitWrites(writes, options.idToken);
  if (alertId) {
    await notifyEngineering(options.idToken, options.session, {
      type: "engineering_utility_alert",
      title: `Utility excursion on ${text(system.name)}`,
      message: `${data.parameter} reading outside approved configured limits. Review /engineering/utility-monitoring.`,
      module: "engineering",
      resource: ENGINEERING_COLLECTIONS.utilityAlerts,
      resourceId: alertId,
      severity: "warning",
      audienceRoles: ["maintenance", "qa", "management"],
    });
  }
  return { id, record, alertId };
}

export async function acknowledgeUtilityAlert(options: {
  id: string;
  comment?: string;
  deviationId?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "engineeringMonitoring:update");
  const current = await requireRecord(ENGINEERING_COLLECTIONS.utilityAlerts, options.id, options.idToken, "Utility alert");
  if (options.deviationId) {
    const deviation = await readMasterDocument("qaDeviations", options.deviationId, options.idToken);
    if (!deviation) fail("Linked QA deviation was not found.");
  }
  const next = {
    ...current,
    status: "acknowledged",
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: options.session.uid,
    deviationId: options.deviationId || current.deviationId || "",
    comment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(ENGINEERING_COLLECTIONS.utilityAlerts, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function calculateMaintenanceAnalytics(idToken: string, from?: string, to?: string) {
  const [workOrders, breakdowns, calibrations, costs, tasks] = await Promise.all([
    queryMasterDocuments(ENGINEERING_COLLECTIONS.workOrders, idToken, { limit: 400 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.breakdowns, idToken, { limit: 300 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.calibrationRecords, idToken, { limit: 300 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.maintenanceCosts, idToken, { limit: 300 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.maintenanceTasks, idToken, { limit: 400 }),
  ]);

  const inRange = (row: Record<string, unknown>, field = "createdAt") => {
    const date = text(row[field] || row.createdAt).slice(0, 10);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const costRows = costs.filter((row) => inRange(row));
  const settingsAllowEstimate = false;
  const actualCost = costRows
    .filter((row) => text(row.costQuality) !== "estimated" || settingsAllowEstimate)
    .reduce((sum, row) => sum + money(row.totalCost), 0);

  const repairMinutes = breakdowns
    .filter((row) => inRange(row, "failureAt") && Number(row.downtimeMinutes) > 0)
    .map((row) => Number(row.downtimeMinutes));
  const mttr = calculateMTTR({ repairMinutes });
  const mtbf = calculateMTBF({
    failureTimestamps: breakdowns.filter((row) => inRange(row, "failureAt")).map((row) => text(row.failureAt)),
  });

  const dueTasks = tasks.filter((row) => ["scheduled", "due", "overdue", "completed"].includes(text(row.status)));
  const completedTasks = dueTasks.filter((row) => text(row.status) === "completed");
  const calClosed = calibrations.filter((row) => ["passed", "closed"].includes(text(row.status)));
  const calDue = calibrations.filter((row) => !["cancelled"].includes(text(row.status)));

  return {
    maintenanceCost: money(actualCost),
    costSampleSize: costRows.length,
    plannedDowntimeMinutes: workOrders
      .filter((row) => text(row.workOrderType) === "preventive" && inRange(row))
      .reduce((sum, row) => sum + Number(row.laborHours || 0) * 60, 0),
    unplannedDowntimeMinutes: repairMinutes.reduce((sum, n) => sum + n, 0),
    breakdownFrequency: breakdowns.filter((row) => inRange(row, "failureAt")).length,
    mttr,
    mtbf,
    maintenanceCompletionRate: complianceRate(completedTasks.length, dueTasks.length),
    calibrationComplianceRate: complianceRate(calClosed.length, calDue.length || 1),
  };
}

export async function loadWorkOrderExtras(id: string, idToken: string) {
  const lines = await listByField(ENGINEERING_COLLECTIONS.workOrderLines, "workOrderId", id, idToken);
  return { lines };
}

export async function loadCalibrationExtras(id: string, idToken: string) {
  const results = await listByField(ENGINEERING_COLLECTIONS.calibrationResults, "calibrationId", id, idToken);
  return { results };
}

export { calculateMaintenanceCost };

import { ENGINEERING_COLLECTIONS } from "@/lib/engineering/collections";
import { ENGINEERING_RESOURCES, type EngineeringResource } from "@/lib/engineering/http";
import { text } from "@/lib/engineering/helpers";
import { daysUntil } from "@/lib/engineering/calculate";
import { calculateMaintenanceAnalytics } from "@/lib/engineering/server-ops";
import { money } from "@/lib/finance/money";
import {
  queryMasterDocuments,
  type MasterQueryFilter,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { EngineeringReportType } from "@/types/engineering";

const SEARCH_END = "\uf8ff";

export interface EngineeringListQuery {
  status?: string;
  facilityId?: string;
  departmentId?: string;
  category?: string;
  criticality?: string;
  equipmentId?: string;
  search?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  cursor?: string;
}

function encodeCursor(values: Array<string | number>) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Array<string | number>;
  } catch {
    return undefined;
  }
}

function paginate(rows: MasterRecord[], pageSize: number, cursorOf: (row: MasterRecord) => Array<string | number>) {
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}

export async function listEngineeringRecords(
  resource: EngineeringResource,
  query: EngineeringListQuery,
  idToken: string,
  _session: SessionPayload
) {
  const collection = ENGINEERING_RESOURCES[resource].collection;
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.facilityId) filters.push({ field: "facilityId", value: query.facilityId });
  if (query.departmentId) filters.push({ field: "departmentId", value: query.departmentId });
  if (query.category) filters.push({ field: "category", value: query.category });
  if (query.criticality) filters.push({ field: "criticality", value: query.criticality });
  if (query.equipmentId) filters.push({ field: "equipmentId", value: query.equipmentId });

  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  let rows: MasterRecord[];
  if (search) {
    rows = await queryMasterDocuments(collection, idToken, {
      filters: [
        ...filters,
        { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
        { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
      ],
      orderBy: [{ field: "searchIndex" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  } else {
    rows = await queryMasterDocuments(collection, idToken, {
      filters,
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  }

  if (query.from || query.to) {
    rows = rows.filter((row) => {
      const date = text(row.dueDate || row.scheduledDate || row.failureAt || row.createdAt).slice(0, 10);
      if (query.from && date < query.from) return false;
      if (query.to && date > query.to) return false;
      return true;
    });
  }

  return paginate(rows, pageSize, (row) =>
    search ? [String(row.searchIndex || "")] : [String(row.updatedAt || "")]
  );
}

export async function loadEngineeringDashboard(idToken: string, query: EngineeringListQuery = {}) {
  const [
    equipment,
    tasks,
    workOrders,
    breakdowns,
    instruments,
    calibrations,
    qualifications,
    alerts,
    spareLinks,
  ] = await Promise.all([
    queryMasterDocuments(ENGINEERING_COLLECTIONS.equipment, idToken, { limit: 500 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.maintenanceTasks, idToken, { limit: 400 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.workOrders, idToken, { limit: 400 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.breakdowns, idToken, { limit: 200 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.instruments, idToken, { limit: 300 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.calibrationRecords, idToken, { limit: 300 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.qualifications, idToken, { limit: 200 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.utilityAlerts, idToken, { limit: 100 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.spareLinks, idToken, { limit: 200 }),
  ]);

  const filterEquipment = equipment.filter((row) => {
    if (query.facilityId && text(row.facilityId) !== query.facilityId) return false;
    if (query.departmentId && text(row.departmentId) !== query.departmentId) return false;
    if (query.category && text(row.category) !== query.category) return false;
    if (query.criticality && text(row.criticality) !== query.criticality) return false;
    if (query.status && query.status !== "all" && text(row.status) !== query.status) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const pmDueSoonDays = 7;
  const calDueSoonDays = 14;

  const openTasks = tasks.filter((row) => ["scheduled", "due", "overdue"].includes(text(row.status)));
  const pmDue = openTasks.filter((row) => {
    const due = text(row.dueDate);
    const d = daysUntil(due, today);
    return d >= 0 && d <= pmDueSoonDays;
  });
  const pmOverdue = openTasks.filter((row) => text(row.dueDate) && text(row.dueDate) < today);

  const calOpen = calibrations.filter((row) => !["closed", "cancelled", "passed"].includes(text(row.status)));
  const instrumentsDue = instruments.filter((row) => {
    const due = text(row.nextCalibrationDueDate);
    if (!due) return false;
    const d = daysUntil(due, today);
    return d >= 0 && d <= calDueSoonDays;
  });
  const instrumentsOverdue = instruments.filter(
    (row) => text(row.nextCalibrationDueDate) && text(row.nextCalibrationDueDate) < today
  );

  const openBreakdowns = breakdowns.filter((row) => !["closed", "cancelled"].includes(text(row.status)));
  const criticalAffected = openBreakdowns.filter(
    (row) => text(row.severity) === "critical" || filterEquipment.find((e) => String(e.id) === text(row.equipmentId) && text(e.criticality) === "critical")
  );

  const openWo = workOrders.filter((row) => !["closed", "cancelled"].includes(text(row.status)));
  const pendingApprovals = workOrders.filter((row) =>
    ["submitted", "review", "engineering_review", "qa_review"].includes(text(row.status))
  );

  const analytics = await calculateMaintenanceAnalytics(idToken, query.from, query.to);
  const upcomingQual = qualifications.filter((row) =>
    ["draft", "protocol_approved", "in_execution", "under_review"].includes(text(row.status))
  );
  const openAlerts = alerts.filter((row) => text(row.status) === "open");
  const spareBelow = spareLinks.filter((row) => Boolean(row.criticalSpare));

  return {
    kpis: {
      totalRegisteredEquipment: filterEquipment.length,
      equipmentInService: filterEquipment.filter((row) => text(row.status) === "in_service").length,
      equipmentUnderMaintenance: filterEquipment.filter((row) =>
        ["under_maintenance", "maintenance_due"].includes(text(row.status))
      ).length,
      equipmentUnavailable: filterEquipment.filter((row) =>
        ["out_of_service", "restricted", "decommissioned"].includes(text(row.status))
      ).length,
      preventiveMaintenanceDue: pmDue.length,
      overdueMaintenanceTasks: pmOverdue.length,
      calibrationDueSoon: instrumentsDue.length,
      overdueCalibration: instrumentsOverdue.length,
      openBreakdowns: openBreakdowns.length,
      criticalEquipmentAffected: criticalAffected.length,
      openMaintenanceWorkOrders: openWo.length,
      pendingWorkOrderApprovals: pendingApprovals.length,
      sparePartsBelowReorderLevel: spareBelow.length,
      equipmentDowntimeMinutes: analytics.unplannedDowntimeMinutes,
      maintenanceCostPeriod: analytics.maintenanceCost,
      upcomingQualificationActivities: upcomingQual.length,
      openUtilityMonitoringAlerts: openAlerts.length,
      overdueCorrectiveActions: openBreakdowns.filter((row) => text(row.status) !== "reported").length,
      openCalibrationRecords: calOpen.length,
    },
    analytics,
    notes: {
      spareParts:
        "Reorder level count lists critical spare links. Live stock quantities require warehouse balance lookup via inventory module.",
      monitoring: "Utility alerts are from recorded measurements against configured system limits only.",
    },
  };
}

export async function loadPendingEngineeringApprovals(idToken: string) {
  const [workOrders, calibrations, qualifications] = await Promise.all([
    queryMasterDocuments(ENGINEERING_COLLECTIONS.workOrders, idToken, { limit: 200 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.calibrationRecords, idToken, { limit: 100 }),
    queryMasterDocuments(ENGINEERING_COLLECTIONS.qualifications, idToken, { limit: 100 }),
  ]);
  return {
    rows: [
      ...workOrders
        .filter((row) => ["submitted", "review", "engineering_review", "qa_review"].includes(text(row.status)))
        .map((row) => ({ ...row, resource: "workOrders" })),
      ...calibrations
        .filter((row) => ["requested", "results_review"].includes(text(row.status)))
        .map((row) => ({ ...row, resource: "calibrations" })),
      ...qualifications
        .filter((row) => ["under_review", "protocol_approved"].includes(text(row.status)))
        .map((row) => ({ ...row, resource: "qualifications" })),
    ],
  };
}

export async function loadEngineeringReport(
  type: EngineeringReportType,
  query: EngineeringListQuery,
  idToken: string,
  _session: SessionPayload
) {
  const inRange = (row: MasterRecord, field = "createdAt") => {
    const date = text(row[field] || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    return true;
  };

  let rows: MasterRecord[] = [];
  let meta: Record<string, unknown> | undefined;

  switch (type) {
    case "equipment_register":
      rows = await queryMasterDocuments(ENGINEERING_COLLECTIONS.equipment, idToken, { limit: 500 });
      break;
    case "pm_compliance": {
      const tasks = await queryMasterDocuments(ENGINEERING_COLLECTIONS.maintenanceTasks, idToken, { limit: 500 });
      rows = tasks.filter((row) => inRange(row, "dueDate"));
      break;
    }
    case "work_order_register":
      rows = (await queryMasterDocuments(ENGINEERING_COLLECTIONS.workOrders, idToken, { limit: 500 })).filter((row) =>
        inRange(row)
      );
      break;
    case "breakdown_register":
      rows = (await queryMasterDocuments(ENGINEERING_COLLECTIONS.breakdowns, idToken, { limit: 400 })).filter((row) =>
        inRange(row, "failureAt")
      );
      break;
    case "calibration_due": {
      const instruments = await queryMasterDocuments(ENGINEERING_COLLECTIONS.instruments, idToken, { limit: 400 });
      const today = new Date().toISOString().slice(0, 10);
      rows = instruments.filter((row) => text(row.nextCalibrationDueDate) && text(row.nextCalibrationDueDate) <= today);
      break;
    }
    case "calibration_register":
      rows = (await queryMasterDocuments(ENGINEERING_COLLECTIONS.calibrationRecords, idToken, { limit: 400 })).filter(
        (row) => inRange(row, "scheduledDate")
      );
      break;
    case "qualification_status":
      rows = await queryMasterDocuments(ENGINEERING_COLLECTIONS.qualifications, idToken, { limit: 300 });
      break;
    case "spare_parts_shortage":
      rows = await queryMasterDocuments(ENGINEERING_COLLECTIONS.spareLinks, idToken, { limit: 300 });
      meta = { note: "Stock levels must be confirmed in warehouse inventory; this lists critical spare links." };
      break;
    case "utility_alerts":
      rows = await queryMasterDocuments(ENGINEERING_COLLECTIONS.utilityAlerts, idToken, { limit: 300 });
      break;
    case "downtime_analysis":
    case "maintenance_cost":
    case "mttr_mtbf": {
      const analytics = await calculateMaintenanceAnalytics(idToken, query.from, query.to);
      rows = [{ id: type, ...analytics }];
      meta = analytics;
      break;
    }
    case "compliance_calendar": {
      const [tasks, cals, quals] = await Promise.all([
        queryMasterDocuments(ENGINEERING_COLLECTIONS.maintenanceTasks, idToken, { limit: 200 }),
        queryMasterDocuments(ENGINEERING_COLLECTIONS.calibrationRecords, idToken, { limit: 200 }),
        queryMasterDocuments(ENGINEERING_COLLECTIONS.qualifications, idToken, { limit: 100 }),
      ]);
      rows = [
        ...tasks.map((row) => ({ ...row, eventType: "maintenance_task", eventDate: row.dueDate })),
        ...cals.map((row) => ({ ...row, eventType: "calibration", eventDate: row.scheduledDate })),
        ...quals.map((row) => ({ ...row, eventType: "qualification", eventDate: row.reviewDueDate || row.createdAt })),
      ];
      break;
    }
    default:
      rows = await queryMasterDocuments(ENGINEERING_COLLECTIONS.equipment, idToken, { limit: 100 });
  }

  return { rows, nextCursor: null, meta, totalCost: money(meta && "maintenanceCost" in meta ? meta.maintenanceCost : 0) };
}

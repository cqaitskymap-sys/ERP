import {
  BATCH_PLAN_STATUSES,
  BMR_STATUSES,
  BOM_STATUSES,
  DEVIATION_SEVERITIES,
  DEVIATION_STATUSES,
  DISPENSING_STATUSES,
  IPC_RESULTS,
  MATERIAL_STAGES,
  MO_STATUSES,
  PLAN_STATUSES,
  PRODUCTION_PRIORITIES,
  PRODUCTION_REPORT_TYPES,
  RECON_STATUSES,
  SCHEDULE_STATUSES,
  STEP_STATUSES,
  WASTAGE_REASONS,
  WORK_CENTER_TYPES,
  YIELD_RESULTS,
} from "@/types/production";

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const priorityOptions = options(PRODUCTION_PRIORITIES, {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
});

export const planStatusOptions = options(PLAN_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
});

export const scheduleStatusOptions = options(SCHEDULE_STATUSES, {
  planned: "Planned",
  scheduled: "Scheduled",
  ready: "Ready",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
});

export const batchPlanStatusOptions = options(BATCH_PLAN_STATUSES, {
  draft: "Draft",
  planned: "Planned",
  approved: "Approved",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
});

export const moStatusOptions = options(MO_STATUSES, {
  draft: "Draft",
  planned: "Planned",
  approved: "Approved",
  ready: "Ready",
  dispensing_pending: "Dispensing Pending",
  manufacturing: "Manufacturing",
  in_process: "In Process",
  completed: "Completed",
  qc_pending: "QC Pending",
  qa_pending: "QA Pending",
  held: "Held",
  rejected: "Rejected",
  released: "Released",
  closed: "Closed",
  cancelled: "Cancelled",
});

export const bomStatusOptions = options(BOM_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  effective: "Effective",
  superseded: "Superseded",
  obsolete: "Obsolete",
});

export const materialStageOptions = options(MATERIAL_STAGES, {
  raw_material: "Raw Material",
  api: "API",
  excipient: "Excipient",
  packaging: "Packaging",
  processing_aid: "Processing Aid",
  other: "Other",
});

export const dispensingStatusOptions = options(DISPENSING_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  approved: "Approved",
  ready_for_dispensing: "Ready for Dispensing",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
});

export const workCenterTypeOptions = options(WORK_CENTER_TYPES, {
  granulation: "Granulation",
  compression: "Compression",
  coating: "Coating",
  filling: "Filling",
  packing: "Packing",
  liquid_manufacturing: "Liquid Manufacturing",
  ointment: "Ointment",
  inspection: "Inspection",
  other: "Other",
});

export const bmrStatusOptions = options(BMR_STATUSES, {
  draft: "Draft",
  issued: "Issued",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  reviewed: "Reviewed",
  closed: "Closed",
});

export const stepStatusOptions = options(STEP_STATUSES, {
  pending: "Pending",
  ready: "Ready",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
});

export const ipcResultOptions = options(IPC_RESULTS, {
  pass: "Pass",
  fail: "Fail",
  pending: "Pending",
});

export const yieldResultOptions = options(YIELD_RESULTS, {
  within_limit: "Within Limit",
  below_limit: "Below Limit",
  above_limit: "Above Limit",
});

export const reconStatusOptions = options(RECON_STATUSES, {
  pending_review: "Pending Review",
  reconciled: "Reconciled",
  variance: "Variance",
});

export const wastageReasonOptions = options(WASTAGE_REASONS, {
  process_loss: "Process Loss",
  spillage: "Spillage",
  rejection: "Rejection",
  sampling: "Sampling",
  equipment_loss: "Equipment Loss",
  other: "Other",
});

export const deviationSeverityOptions = options(DEVIATION_SEVERITIES, {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
});

export const deviationStatusOptions = options(DEVIATION_STATUSES, {
  open: "Open",
  under_investigation: "Under Investigation",
  action_required: "Action Required",
  closed: "Closed",
});

export const productionReportOptions = options(PRODUCTION_REPORT_TYPES, {
  production_plan: "Production Plan Report",
  production_schedule: "Production Schedule",
  batch: "Batch Report",
  manufacturing_order: "Manufacturing Order Report",
  batch_status: "Batch Status Report",
  production_by_customer: "Production by Customer",
  production_by_product: "Production by Product",
  material_requirement: "Material Requirement Report",
  material_shortage: "Material Shortage Report",
  batch_yield: "Batch Yield Report",
  production_loss: "Production Loss Report",
  material_reconciliation: "Material Reconciliation Report",
  work_center_utilization: "Work Center Utilization",
  production_delay: "Production Delay Report",
  batch_traceability: "Batch Traceability Report",
});

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "approved":
    case "effective":
    case "completed":
    case "closed":
    case "released":
    case "reconciled":
    case "pass":
    case "within_limit":
      return "success";
    case "cancelled":
    case "failed":
    case "obsolete":
    case "critical":
    case "below_limit":
      return "critical";
    case "submitted":
    case "under_review":
    case "qc_pending":
    case "qa_pending":
    case "dispensing_pending":
    case "variance":
    case "paused":
    case "short":
      return "warning";
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}

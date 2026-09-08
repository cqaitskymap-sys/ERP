import {
  ASSIGNMENT_STATUSES,
  DEFAULT_SAMPLE_SOURCES,
  DISPOSITION_STATES,
  INSTRUMENT_STATUSES,
  OOS_STATUSES,
  OOT_STATUSES,
  QC_PRIORITIES,
  QC_REPORT_TYPES,
  RESULT_OUTCOMES,
  SAMPLE_CONDITIONS,
  SAMPLE_REQUEST_STATUSES,
  SAMPLE_STATUSES,
  SPEC_STATUSES,
  STABILITY_TIMEPOINTS,
  STANDARD_STATUSES,
  TEST_REQUEST_STATUSES,
  TEST_TYPES,
} from "@/types/qc";

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const qcPriorityOptions = options(QC_PRIORITIES, {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
});

export const sampleSourceOptions = options(DEFAULT_SAMPLE_SOURCES, {
  raw_material_receipt: "Raw Material Receipt",
  packaging_material_receipt: "Packaging Material Receipt",
  bulk_product: "Bulk Product",
  semi_finished_product: "Semi-Finished Product",
  finished_product: "Finished Product",
  stability: "Stability",
  in_process_manufacturing: "In-Process Manufacturing",
  validation: "Validation",
  other: "Other",
});

export const sampleRequestStatusOptions = options(SAMPLE_REQUEST_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  approved: "Approved",
  sampling: "Sampling",
  sampled: "Sampled",
  received: "Received",
  testing: "Testing",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
});

export const sampleStatusOptions = options(SAMPLE_STATUSES, {
  planned: "Planned",
  sampled: "Sampled",
  in_transit: "In Transit",
  received: "Received",
  registered: "Registered",
  testing: "Testing",
  completed: "Completed",
  retained: "Retained",
  disposed: "Disposed",
  cancelled: "Cancelled",
});

export const sampleConditionOptions = options(SAMPLE_CONDITIONS, {
  acceptable: "Acceptable",
  damaged: "Damaged",
  leaking: "Leaking",
  insufficient: "Insufficient",
  other: "Other",
});

export const testRequestStatusOptions = options(TEST_REQUEST_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  assigned: "Assigned",
  in_testing: "In Testing",
  review_pending: "Review Pending",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
});

export const assignmentStatusOptions = options(ASSIGNMENT_STATUSES, {
  assigned: "Assigned",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  reviewed: "Reviewed",
  rejected: "Rejected",
});

export const specStatusOptions = options(SPEC_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  effective: "Effective",
  superseded: "Superseded",
  obsolete: "Obsolete",
});

export const testTypeOptions = options(TEST_TYPES, {
  numeric: "Numeric",
  text: "Text",
  boolean: "Boolean",
  qualitative: "Qualitative",
  quantitative: "Quantitative",
  calculated: "Calculated",
});

export const resultOutcomeOptions = options(RESULT_OUTCOMES, {
  pass: "Pass",
  fail: "Fail",
  pending: "Pending",
  invalid: "Invalid",
});

export const oosStatusOptions = options(OOS_STATUSES, {
  open: "Open",
  initial_review: "Initial Review",
  investigation: "Investigation",
  capa_required: "CAPA Required",
  closed: "Closed",
});

export const ootStatusOptions = options(OOT_STATUSES, {
  open: "Open",
  under_review: "Under Review",
  closed: "Closed",
});

export const dispositionOptions = options(DISPOSITION_STATES, {
  pending: "Pending",
  approved_for_qa: "Approved for QA",
  failed: "Failed",
  retest_required: "Retest Required",
  investigation_required: "Investigation Required",
  hold: "Hold",
});

export const instrumentStatusOptions = options(INSTRUMENT_STATUSES, {
  active: "Active",
  inactive: "Inactive",
  maintenance: "Maintenance",
  retired: "Retired",
});

export const standardStatusOptions = options(STANDARD_STATUSES, {
  available: "Available",
  expired: "Expired",
  exhausted: "Exhausted",
  quarantined: "Quarantined",
});

export const stabilityTimepointOptions = options(STABILITY_TIMEPOINTS, {
  initial: "Initial",
  "1_month": "1 Month",
  "3_month": "3 Month",
  "6_month": "6 Month",
  "9_month": "9 Month",
  "12_month": "12 Month",
  custom: "Custom",
});

export const qcReportOptions = options(QC_REPORT_TYPES, {
  sample_register: "Sample Register",
  test_register: "Test Register",
  test_result: "Test Result Report",
  batch_qc: "Batch QC Report",
  material_qc: "Material QC Report",
  product_qc: "Product QC Report",
  oos: "OOS Report",
  oot: "OOT Report",
  retest: "Retest Report",
  coa_register: "COA Register",
  turnaround: "QC Turnaround Report",
  analyst_workload: "Analyst Workload",
  instrument_usage: "Instrument Usage",
  stability: "Stability Report",
  supplier_material_qc: "Supplier Material QC Report",
});

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "approved":
    case "effective":
    case "completed":
    case "closed":
    case "pass":
    case "acceptable":
    case "approved_for_qa":
      return "success";
    case "cancelled":
    case "failed":
    case "fail":
    case "rejected":
    case "obsolete":
      return "critical";
    case "review_pending":
    case "oos":
    case "investigation":
    case "damaged":
    case "insufficient":
    case "retest_required":
    case "hold":
      return "warning";
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}

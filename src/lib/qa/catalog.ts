import {
  CAPA_SOURCES,
  CAPA_STATUSES,
  CHANGE_STATUSES,
  CHANGE_TYPES,
  CHECKLIST_STATUSES,
  DEVIATION_SOURCES,
  HOLD_REASONS,
  QA_DECISIONS,
  QA_DEVIATION_STATUSES,
  QA_DOCUMENT_STATUSES,
  QA_DOCUMENT_TYPES,
  QA_PRIORITIES,
  QA_REPORT_TYPES,
  QA_REVIEW_STATUSES,
  QA_SEVERITIES,
  REJECTION_CATEGORIES,
} from "@/types/qa";

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const qaReviewStatusOptions = options(QA_REVIEW_STATUSES, {
  pending_review: "Pending Review",
  under_review: "Under Review",
  review_complete: "Review Complete",
  decision_pending: "Decision Pending",
  released: "Released",
  held: "Held",
  rejected: "Rejected",
  closed: "Closed",
});

export const qaDecisionOptions = options(QA_DECISIONS, {
  release: "Release",
  hold: "Hold",
  reject: "Reject",
  conditional: "Conditional",
});

export const checklistStatusOptions = options(CHECKLIST_STATUSES, {
  pending: "Pending",
  satisfactory: "Satisfactory",
  unsatisfactory: "Unsatisfactory",
  not_applicable: "Not Applicable",
});

export const qaPriorityOptions = options(QA_PRIORITIES, {
  normal: "Normal",
  urgent: "Urgent",
  overdue: "Overdue",
  critical: "Critical",
});

export const holdReasonOptions = options(HOLD_REASONS, {
  investigation_pending: "Investigation pending",
  documentation_issue: "Documentation issue",
  oos: "OOS",
  deviation: "Deviation",
  customer_clarification: "Customer clarification",
  regulatory_concern: "Regulatory concern",
  other: "Other",
});

export const rejectionCategoryOptions = options(REJECTION_CATEGORIES, {
  quality_failure: "Quality failure",
  documentation: "Documentation",
  process: "Process",
  contamination: "Contamination",
  customer_requirement: "Customer requirement",
  other: "Other",
});

export const deviationSourceOptions = options(DEVIATION_SOURCES, {
  manufacturing: "Manufacturing",
  qc: "QC",
  warehouse: "Warehouse",
  documentation: "Documentation",
  equipment: "Equipment",
  material: "Material",
  packaging: "Packaging",
  environmental: "Environmental",
  supplier: "Supplier",
  other: "Other",
});

export const qaDeviationStatusOptions = options(QA_DEVIATION_STATUSES, {
  open: "Open",
  investigation: "Investigation",
  qa_review: "QA Review",
  capa_required: "CAPA Required",
  action_pending: "Action Pending",
  effectiveness_review: "Effectiveness Review",
  closed: "Closed",
});

export const qaSeverityOptions = options(QA_SEVERITIES, {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
});

export const capaSourceOptions = options(CAPA_SOURCES, {
  deviation: "Deviation",
  oos: "OOS",
  oot: "OOT",
  audit: "Audit",
  complaint: "Complaint",
  supplier_issue: "Supplier issue",
  trend: "Trend",
  pv_case: "PV case",
  pv_signal: "PV signal",
  other: "Other",
});

export const capaStatusOptions = options(CAPA_STATUSES, {
  draft: "Draft",
  open: "Open",
  action_in_progress: "Action In Progress",
  effectiveness_review: "Effectiveness Review",
  closed: "Closed",
  overdue: "Overdue",
});

export const changeTypeOptions = options(CHANGE_TYPES, {
  major: "Major",
  minor: "Minor",
  emergency: "Emergency",
});

export const changeStatusOptions = options(CHANGE_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  impact_assessment: "Impact Assessment",
  qa_review: "QA Review",
  approved: "Approved",
  implementation: "Implementation",
  verification: "Verification",
  closed: "Closed",
  rejected: "Rejected",
});

export const qaDocumentTypeOptions = options(QA_DOCUMENT_TYPES, {
  sop: "SOP",
  specification: "Specification",
  bmr: "BMR",
  bpr: "BPR",
  test_method: "Test Method",
  validation: "Validation Document",
  quality_agreement: "Quality Agreement",
  customer_specification: "Customer Specification",
  coa: "COA",
  training: "Training Document",
  other: "Other",
});

export const qaDocumentStatusOptions = options(QA_DOCUMENT_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  effective: "Effective",
  superseded: "Superseded",
  obsolete: "Obsolete",
});

export const qaReportOptions = options(QA_REPORT_TYPES, {
  batch_release: "Batch Release Report",
  batch_hold: "Batch Hold Report",
  batch_rejection: "Batch Rejection Report",
  qa_review: "QA Review Report",
  deviation: "Deviation Report",
  capa: "CAPA Report",
  change_control: "Change Control Report",
  oos_review: "OOS QA Review Report",
  oot_review: "OOT QA Review Report",
  turnaround: "QA Turnaround Report",
  compliance: "Compliance Dashboard Report",
  customer_release: "Customer Release Report",
  product_disposition: "Product Disposition Report",
  expiring_document: "Expiring Document Report",
});

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "released":
    case "closed":
    case "approved":
    case "effective":
    case "satisfactory":
      return "success";
    case "rejected":
    case "obsolete":
    case "unsatisfactory":
    case "critical":
      return "critical";
    case "held":
    case "overdue":
    case "capa_required":
      return "hold";
    case "pending_review":
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}

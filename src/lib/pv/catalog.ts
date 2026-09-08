import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CAUSALITY_RESULTS,
  COMMITMENT_STATUSES,
  EVENT_OUTCOMES,
  EXPECTEDNESS_VALUES,
  FOLLOWUP_STATUSES,
  INTAKE_SOURCES,
  INTAKE_STATUSES,
  INTAKE_URGENCIES,
  PRODUCT_ROLES,
  PV_REPORT_TYPES,
  REPORT_STATUSES,
  REPORTER_TYPES,
  SEVERITIES,
  SIGNAL_STATUSES,
} from "@/types/pv";

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const intakeSourceOptions = options(INTAKE_SOURCES, {
  customer: "Customer",
  healthcare_professional: "Healthcare Professional",
  patient: "Patient",
  distributor: "Distributor",
  regulatory_authority: "Regulatory Authority",
  sales_commercial: "Sales / Commercial",
  employee: "Employee",
  literature: "Literature",
  website: "Website",
  email: "Email",
  phone: "Phone",
  other: "Other",
});

export const intakeStatusOptions = options(INTAKE_STATUSES, {
  received: "Received",
  triage_pending: "Triage Pending",
  converted_to_case: "Converted to Case",
  duplicate: "Duplicate",
  invalid: "Invalid",
  closed: "Closed",
});

export const urgencyOptions = options(INTAKE_URGENCIES, {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
});

export const caseStatusOptions = options(CASE_STATUSES, {
  new: "New",
  triage: "Triage",
  processing: "Processing",
  medical_review: "Medical Review",
  follow_up_required: "Follow-up Required",
  regulatory_review: "Regulatory Review",
  reporting: "Reporting",
  follow_up_pending: "Follow-up Pending",
  closed: "Closed",
  reopened: "Reopened",
});

export const priorityOptions = options(CASE_PRIORITIES, {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
});

export const reporterTypeOptions = options(REPORTER_TYPES, {
  physician: "Physician",
  pharmacist: "Pharmacist",
  nurse: "Nurse",
  patient: "Patient",
  consumer: "Consumer",
  distributor: "Distributor",
  regulatory_authority: "Regulatory Authority",
  other: "Other",
});

export const productRoleOptions = options(PRODUCT_ROLES, {
  suspect: "Suspect",
  interacting: "Interacting",
  concomitant: "Concomitant",
});

export const outcomeOptions = options(EVENT_OUTCOMES, {
  recovered: "Recovered",
  recovering: "Recovering",
  not_recovered: "Not Recovered",
  recovered_with_sequelae: "Recovered with Sequelae",
  fatal: "Fatal",
  unknown: "Unknown",
});

export const severityOptions = options(SEVERITIES, {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  unknown: "Unknown",
});

export const expectednessOptions = options(EXPECTEDNESS_VALUES, {
  expected: "Expected",
  unexpected: "Unexpected",
  unknown: "Unknown",
  requires_review: "Requires Review",
});

export const causalityOptions = options(CAUSALITY_RESULTS, {
  related: "Related",
  possibly_related: "Possibly Related",
  unlikely_related: "Unlikely Related",
  not_related: "Not Related",
  unassessable: "Unassessable",
});

export const followUpStatusOptions = options(FOLLOWUP_STATUSES, {
  requested: "Requested",
  pending: "Pending",
  received: "Received",
  under_review: "Under Review",
  closed: "Closed",
  overdue: "Overdue",
  cancelled: "Cancelled",
});

export const reportStatusOptions = options(REPORT_STATUSES, {
  assessment_pending: "Assessment Pending",
  required: "Required",
  not_required: "Not Required",
  preparing: "Preparing",
  internal_review: "Internal Review",
  approved: "Approved",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  rejected: "Rejected",
  closed: "Closed",
});

export const signalStatusOptions = options(SIGNAL_STATUSES, {
  detected: "Detected",
  screening: "Screening",
  assessment: "Assessment",
  confirmed: "Confirmed",
  monitoring: "Monitoring",
  closed: "Closed",
});

export const commitmentStatusOptions = options(COMMITMENT_STATUSES, {
  open: "Open",
  in_progress: "In Progress",
  pending_evidence: "Pending Evidence",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
});

export const pvReportOptions = options(PV_REPORT_TYPES, {
  safety_case: "Safety Case Report",
  serious_case: "Serious Case Report",
  intake: "Case Intake Report",
  product_safety: "Product Safety Report",
  batch_safety: "Batch Safety Report",
  followup: "Follow-up Report",
  overdue_followup: "Overdue Follow-up Report",
  regulatory_reporting: "Regulatory Reporting Report",
  signal: "Signal Report",
  commitment: "Safety Commitment Report",
  case_tat: "Case Processing TAT Report",
  customer_safety: "Customer Safety Report",
  market_safety: "Market Safety Report",
  event_trend: "Event Trend Report",
});

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "closed":
    case "completed":
    case "acknowledged":
    case "converted_to_case":
      return "success";
    case "critical":
    case "fatal":
    case "overdue":
    case "rejected":
    case "invalid":
      return "critical";
    case "high":
    case "serious":
    case "follow_up_required":
    case "required":
      return "hold";
    case "new":
    case "received":
    case "detected":
      return "neutral";
    default:
      return "info";
  }
}

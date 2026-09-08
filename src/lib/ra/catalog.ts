import {
  ARTWORK_STATUSES,
  CHANGE_STATUSES,
  COMMITMENT_SOURCES,
  COMMITMENT_STATUSES,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  LICENSE_STATUSES,
  PROFILE_STATUSES,
  QUERY_STATUSES,
  RA_REPORT_TYPES,
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  RENEWAL_STATUSES,
  SUBMISSION_STATUSES,
} from "@/types/ra";

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const profileStatusOptions = options(PROFILE_STATUSES, {
  not_assessed: "Not Assessed",
  assessment_pending: "Assessment Pending",
  registration_required: "Registration Required",
  registration_in_progress: "Registration In Progress",
  registered: "Registered",
  suspended: "Suspended",
  withdrawn: "Withdrawn",
  expired: "Expired",
});

export const registrationStatusOptions = options(REGISTRATION_STATUSES, {
  draft: "Draft",
  preparation: "Preparation",
  submitted: "Submitted",
  under_review: "Under Review",
  query_received: "Query Received",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  expired: "Expired",
  withdrawn: "Withdrawn",
});

export const registrationTypeOptions = options(REGISTRATION_TYPES, {
  new_registration: "New Registration",
  renewal: "Renewal",
  variation: "Variation",
  transfer: "Transfer",
  amendment: "Amendment",
  extension: "Extension",
  other: "Other",
});

export const submissionStatusOptions = options(SUBMISSION_STATUSES, {
  draft: "Draft",
  in_preparation: "In Preparation",
  internal_review: "Internal Review",
  approved_for_submission: "Approved for Submission",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  under_review: "Under Review",
  query_received: "Query Received",
  response_submitted: "Response Submitted",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed",
});

export const documentStatusOptions = options(DOCUMENT_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  submitted: "Submitted",
  superseded: "Superseded",
  expired: "Expired",
  obsolete: "Obsolete",
});

export const documentTypeOptions = options(DOCUMENT_TYPES, {
  manufacturing_license: "Manufacturing License",
  product_license: "Product License",
  certificate: "Certificate",
  gmp_certificate: "GMP Certificate",
  cpp: "CPP",
  coa: "COA",
  specification: "Specification",
  stability_report: "Stability Report",
  validation_report: "Validation Report",
  regulatory_certificate: "Regulatory Certificate",
  authorization_letter: "Authorization Letter",
  free_sale_certificate: "Free Sale Certificate",
  customer_requirement: "Customer Requirement",
  label: "Label",
  artwork: "Artwork",
  submission_document: "Submission Document",
  authority_letter: "Authority Letter",
  other: "Other",
});

export const licenseStatusOptions = options(LICENSE_STATUSES, {
  draft: "Draft",
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  suspended: "Suspended",
  cancelled: "Cancelled",
});

export const renewalStatusOptions = options(RENEWAL_STATUSES, {
  not_started: "Not Started",
  planning: "Planning",
  documents_pending: "Documents Pending",
  ready: "Ready",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
});

export const queryStatusOptions = options(QUERY_STATUSES, {
  received: "Received",
  assigned: "Assigned",
  in_preparation: "In Preparation",
  internal_review: "Internal Review",
  approved: "Approved",
  submitted: "Submitted",
  accepted: "Accepted",
  closed: "Closed",
  overdue: "Overdue",
});

export const commitmentStatusOptions = options(COMMITMENT_STATUSES, {
  open: "Open",
  in_progress: "In Progress",
  pending_evidence: "Pending Evidence",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
});

export const commitmentSourceOptions = options(COMMITMENT_SOURCES, {
  authority_approval: "Authority Approval",
  regulatory_submission: "Regulatory Submission",
  regulatory_query: "Regulatory Query",
  inspection: "Inspection",
  audit: "Audit",
  license: "License",
  registration: "Registration",
  other: "Other",
});

export const communicationTypeOptions = options(COMMUNICATION_TYPES, {
  submission: "Submission",
  query: "Query",
  response: "Response",
  notice: "Notice",
  approval: "Approval",
  rejection: "Rejection",
  renewal: "Renewal",
  other: "Other",
});

export const communicationDirectionOptions = options(COMMUNICATION_DIRECTIONS, {
  incoming: "Incoming",
  outgoing: "Outgoing",
});

export const artworkStatusOptions = options(ARTWORK_STATUSES, {
  draft: "Draft",
  ra_review: "RA Review",
  customer_review: "Customer Review",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Superseded",
});

export const changeStatusOptions = options(CHANGE_STATUSES, {
  new_requirement: "New Requirement",
  ra_assessment: "RA Assessment",
  impact_assessment: "Impact Assessment",
  department_review: "Department Review",
  action_plan: "Action Plan",
  implementation: "Implementation",
  verification: "Verification",
  closed: "Closed",
});

export const raReportOptions = options(RA_REPORT_TYPES, {
  registration: "Registration Report",
  submission: "Submission Report",
  registration_expiry: "Registration Expiry Report",
  license_expiry: "License Expiry Report",
  renewal: "Renewal Report",
  query: "Regulatory Query Report",
  commitment: "Commitment Report",
  overdue_commitment: "Overdue Commitment Report",
  communication: "Authority Communication Report",
  product_market: "Product Market Registration Report",
  document: "Regulatory Document Report",
  artwork: "Artwork Approval Report",
  regulatory_change: "Regulatory Change Report",
  compliance_calendar: "Compliance Calendar Report",
  customer_requirement: "Customer Regulatory Requirement Report",
});

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "approved":
    case "registered":
    case "active":
    case "completed":
    case "closed":
    case "accepted":
      return "success";
    case "rejected":
    case "expired":
    case "cancelled":
    case "withdrawn":
    case "obsolete":
    case "overdue":
      return "critical";
    case "expiring_soon":
    case "critical":
    case "query_received":
    case "suspended":
      return "hold";
    case "draft":
    case "not_assessed":
    case "not_started":
      return "neutral";
    default:
      return "info";
  }
}

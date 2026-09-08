export const QC_PRIORITIES = ["normal", "high", "urgent", "critical"] as const;

export const DEFAULT_SAMPLE_SOURCES = [
  "raw_material_receipt",
  "packaging_material_receipt",
  "bulk_product",
  "semi_finished_product",
  "finished_product",
  "stability",
  "in_process_manufacturing",
  "validation",
  "other",
] as const;

export const SAMPLE_REQUEST_STATUSES = [
  "draft",
  "requested",
  "approved",
  "sampling",
  "sampled",
  "received",
  "testing",
  "completed",
  "closed",
  "cancelled",
] as const;

export const SAMPLE_STATUSES = [
  "planned",
  "sampled",
  "in_transit",
  "received",
  "registered",
  "testing",
  "completed",
  "retained",
  "disposed",
  "cancelled",
] as const;

export const SAMPLE_CONDITIONS = ["acceptable", "damaged", "leaking", "insufficient", "other"] as const;

export const TEST_REQUEST_STATUSES = [
  "draft",
  "requested",
  "assigned",
  "in_testing",
  "review_pending",
  "completed",
  "rejected",
  "cancelled",
] as const;

export const ASSIGNMENT_STATUSES = ["assigned", "accepted", "in_progress", "completed", "reviewed", "rejected"] as const;

export const SPEC_STATUSES = ["draft", "under_review", "approved", "effective", "superseded", "obsolete"] as const;

export const TEST_TYPES = ["numeric", "text", "boolean", "qualitative", "quantitative", "calculated"] as const;

export const RESULT_OUTCOMES = ["pass", "fail", "pending", "invalid"] as const;

export const OOS_STATUSES = ["open", "initial_review", "investigation", "capa_required", "closed"] as const;

export const OOT_STATUSES = ["open", "under_review", "closed"] as const;

export const DISPOSITION_STATES = [
  "pending",
  "approved_for_qa",
  "failed",
  "retest_required",
  "investigation_required",
  "hold",
] as const;

export const INSTRUMENT_STATUSES = ["active", "inactive", "maintenance", "retired"] as const;

export const STANDARD_STATUSES = ["available", "expired", "exhausted", "quarantined"] as const;

export const STABILITY_TIMEPOINTS = ["initial", "1_month", "3_month", "6_month", "9_month", "12_month", "custom"] as const;

export const QC_REPORT_TYPES = [
  "sample_register",
  "test_register",
  "test_result",
  "batch_qc",
  "material_qc",
  "product_qc",
  "oos",
  "oot",
  "retest",
  "coa_register",
  "turnaround",
  "analyst_workload",
  "instrument_usage",
  "stability",
  "supplier_material_qc",
] as const;

export interface TestEvaluation {
  outcome: (typeof RESULT_OUTCOMES)[number];
  reason: string;
}

export interface OverallTestResult {
  passed: number;
  failed: number;
  pending: number;
  invalid: number;
  overall: "pass" | "fail" | "pending";
}

export interface SignatureRecord {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
}

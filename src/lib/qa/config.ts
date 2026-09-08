export const QA_NUMBER_SERIES = {
  REVIEW: { documentType: "QAREV", prefix: "QA-REV" },
  DISP: { documentType: "QADISP", prefix: "QA-DISP" },
  HOLD: { documentType: "QAHOLD", prefix: "QA-HOLD" },
  REJ: { documentType: "QAREJ", prefix: "QA-REJ" },
  DEV: { documentType: "QADEV", prefix: "QA-DEV" },
  CAPA: { documentType: "QACAPA", prefix: "CAPA" },
  CC: { documentType: "QACC", prefix: "CC" },
  DOC: { documentType: "QADOC", prefix: "QA-DOC" },
  BRC: { documentType: "QABRC", prefix: "BRC" },
} as const;

export const QA_WORKFLOW_MODULES = {
  batchRelease: "qa_batch_release",
  batchHold: "qa_batch_hold",
  batchReject: "qa_batch_reject",
  capa: "qa_capa",
  changeControl: "qa_change_control",
  document: "qa_document",
} as const;

export const DEFAULT_QA_CHECKLIST = [
  { key: "correct_product", item: "Correct product", mandatory: true },
  { key: "correct_batch", item: "Correct batch number", mandatory: true },
  { key: "correct_bom", item: "Correct BOM version", mandatory: true },
  { key: "correct_bmr", item: "Correct BMR", mandatory: true },
  { key: "material_traceability", item: "Material traceability complete", mandatory: true },
  { key: "dispensing_complete", item: "Dispensing records complete", mandatory: true },
  { key: "manufacturing_complete", item: "Manufacturing records complete", mandatory: true },
  { key: "ipc_complete", item: "IPC completed", mandatory: true },
  { key: "yield_acceptable", item: "Yield acceptable", mandatory: true },
  { key: "reconciliation_complete", item: "Reconciliation complete", mandatory: true },
  { key: "qc_complete", item: "QC completed", mandatory: true },
  { key: "oos_reviewed", item: "OOS reviewed", mandatory: true },
  { key: "oot_reviewed", item: "OOT reviewed", mandatory: false },
  { key: "deviations_reviewed", item: "Deviations reviewed", mandatory: true },
  { key: "documents_available", item: "Required documents available", mandatory: true },
  { key: "coa_reviewed", item: "COA reviewed", mandatory: true },
  { key: "customer_requirements", item: "Customer requirements satisfied", mandatory: true },
] as const;

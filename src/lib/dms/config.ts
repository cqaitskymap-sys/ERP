export const DMS_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const DMS_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const DEFAULT_DMS_SETTINGS = {
  segregationOfDuties: true,
  requireSignatureEmailConfirmation: true,
  reviewSoonDays: 30,
  expirySoonDays: 30,
  defaultReviewIntervalDays: 730,
  retentionYears: 10,
  requireFileBeforeRelease: true,
  requireReviewBeforeApproval: true,
  requiredApprovals: 1,
} as const;

export const DOCUMENT_TYPE_DEFAULTS: Record<
  string,
  { prefix: string; label: string; reviewIntervalDays: number; trainingRequired: boolean; gmp: boolean }
> = {
  sop: { prefix: "SOP", label: "SOP", reviewIntervalDays: 730, trainingRequired: true, gmp: true },
  work_instruction: { prefix: "WI", label: "Work instruction", reviewIntervalDays: 730, trainingRequired: true, gmp: true },
  policy: { prefix: "POL", label: "Policy", reviewIntervalDays: 1095, trainingRequired: false, gmp: true },
  procedure: { prefix: "PR", label: "Procedure", reviewIntervalDays: 730, trainingRequired: true, gmp: true },
  form: { prefix: "FRM", label: "Form", reviewIntervalDays: 730, trainingRequired: false, gmp: false },
  template: { prefix: "TPL", label: "Template", reviewIntervalDays: 730, trainingRequired: false, gmp: false },
  register: { prefix: "REG", label: "Register", reviewIntervalDays: 365, trainingRequired: false, gmp: false },
  checklist: { prefix: "CHK", label: "Checklist", reviewIntervalDays: 730, trainingRequired: false, gmp: false },
  specification: { prefix: "SPEC", label: "Specification", reviewIntervalDays: 730, trainingRequired: false, gmp: true },
  analytical_method: { prefix: "ATM", label: "Analytical method", reviewIntervalDays: 730, trainingRequired: true, gmp: true },
  validation_protocol: { prefix: "VP", label: "Validation protocol", reviewIntervalDays: 1095, trainingRequired: false, gmp: true },
  validation_report: { prefix: "VR", label: "Validation report", reviewIntervalDays: 1095, trainingRequired: false, gmp: true },
  qualification: { prefix: "QUAL", label: "Qualification", reviewIntervalDays: 1095, trainingRequired: false, gmp: true },
  bmr: { prefix: "BMR", label: "Batch manufacturing record", reviewIntervalDays: 730, trainingRequired: true, gmp: true },
  bpr: { prefix: "BPR", label: "Batch packaging record", reviewIntervalDays: 730, trainingRequired: true, gmp: true },
  quality_agreement: { prefix: "QAG", label: "Quality agreement", reviewIntervalDays: 1095, trainingRequired: false, gmp: true },
  technical_agreement: { prefix: "TAG", label: "Technical agreement", reviewIntervalDays: 1095, trainingRequired: false, gmp: true },
  training: { prefix: "TRN", label: "Training document", reviewIntervalDays: 730, trainingRequired: true, gmp: false },
  vendor: { prefix: "VND", label: "Vendor document", reviewIntervalDays: 365, trainingRequired: false, gmp: false },
  regulatory_external: { prefix: "REGX", label: "External regulatory document", reviewIntervalDays: 365, trainingRequired: false, gmp: true },
  engineering: { prefix: "EDOC", label: "Engineering document", reviewIntervalDays: 730, trainingRequired: false, gmp: false },
  maintenance: { prefix: "MDOC", label: "Maintenance document", reviewIntervalDays: 365, trainingRequired: false, gmp: false },
  calibration: { prefix: "CDOC", label: "Calibration document", reviewIntervalDays: 365, trainingRequired: false, gmp: true },
  equipment: { prefix: "EQD", label: "Equipment document", reviewIntervalDays: 730, trainingRequired: false, gmp: false },
  other: { prefix: "DOC", label: "Other controlled document", reviewIntervalDays: 730, trainingRequired: false, gmp: false },
};

export const DMS_NUMBER_SERIES = {
  DCR: { documentType: "DMS-DCR", prefix: "DCR" },
  PRV: { documentType: "DMS-PRV", prefix: "PRV" },
  EXT: { documentType: "DMS-EXT", prefix: "EXT" },
} as const;

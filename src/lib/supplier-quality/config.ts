export const SQ_NUMBER_SERIES = {
  QUAL: { documentType: "SUPQ", prefix: "SUP-Q" },
  AUD: { documentType: "SUPAUD", prefix: "SUP-AUD" },
  EV: { documentType: "SUPEV", prefix: "SUP-EV" },
  RQ: { documentType: "SUPRQ", prefix: "SUP-RQ" },
  CHG: { documentType: "SUPCHG", prefix: "SUP-CHG" },
  AGR: { documentType: "SUPAGR", prefix: "SUP-AGR" },
  SUS: { documentType: "SUPSUS", prefix: "SUP-SUS" },
} as const;

export const EXPIRY_THRESHOLDS = [90, 60, 30, 7] as const;

export const DEFAULT_DOCUMENT_TYPES = [
  "manufacturing_license",
  "gmp_certificate",
  "iso_certificate",
  "product_certificate",
  "coa_sample",
  "specification",
  "test_method",
  "regulatory_certificate",
  "business_registration",
  "quality_agreement",
  "technical_agreement",
  "questionnaire",
  "audit_report",
  "insurance",
  "other",
];

export const DEFAULT_QUESTIONNAIRE_SECTIONS = [
  "company_information",
  "manufacturing",
  "quality_system",
  "gmp",
  "qc",
  "qa",
  "validation",
  "data_integrity",
  "change_control",
  "deviation",
  "capa",
  "complaints",
  "recall",
  "regulatory",
  "supply_chain",
  "storage",
  "transportation",
  "business_continuity",
];

export const DEFAULT_AUDIT_SECTIONS = [
  "quality_management",
  "gmp",
  "documentation",
  "production",
  "qc",
  "qa",
  "validation",
  "warehouse",
  "utilities",
  "data_integrity",
  "change_control",
  "deviation",
  "capa",
  "complaints",
  "recall",
  "regulatory",
  "training",
];

export const DEFAULT_SCORE_WEIGHTS = {
  quality: 30,
  delivery: 20,
  documentation: 15,
  compliance: 20,
  service: 15,
  version: "1",
  method: "weighted_average",
};

export const DEFAULT_RISK_WEIGHTS = {
  materialCriticality: 15,
  productImpact: 10,
  regulatoryImpact: 15,
  supplierHistory: 10,
  geographicRisk: 5,
  manufacturingComplexity: 10,
  qualityPerformance: 15,
  auditHistory: 10,
  certificateStatus: 5,
  changeHistory: 5,
  version: "1",
  method: "weighted_sum",
};

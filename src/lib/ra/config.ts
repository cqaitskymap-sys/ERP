import type { ExpiryThresholds } from "@/types/ra";

export const RA_NUMBER_SERIES = {
  PROFILE: { documentType: "RAPRF", prefix: "RA-PRF" },
  REG: { documentType: "RAREG", prefix: "REG" },
  SUB: { documentType: "RASUB", prefix: "RA-SUB" },
  DOS: { documentType: "RADOS", prefix: "RA-DOS" },
  DOC: { documentType: "RADOC", prefix: "RA-DOC" },
  LIC: { documentType: "RALIC", prefix: "RA-LIC" },
  REN: { documentType: "RAREN", prefix: "RA-REN" },
  QRY: { documentType: "RAQRY", prefix: "RA-QRY" },
  COM: { documentType: "RACOM", prefix: "RA-COM" },
  MSG: { documentType: "RAMSG", prefix: "RA-MSG" },
  ART: { documentType: "RAART", prefix: "RA-ART" },
  CHG: { documentType: "RACHG", prefix: "RA-CHG" },
} as const;

export const RA_WORKFLOW_MODULES = {
  registration: "ra_registration",
  submission: "ra_submission",
  dossier: "ra_dossier",
  document: "ra_document",
  renewal: "ra_renewal",
  query: "ra_query",
  artwork: "ra_artwork",
  change: "ra_regulatory_change",
} as const;

export const DEFAULT_EXPIRY_THRESHOLDS: ExpiryThresholds = {
  soonDays: 90,
  warningDays: 60,
  criticalDays: 30,
  urgentDays: 7,
};

export const DEFAULT_DOSSIER_SECTIONS = [
  { key: "administrative", title: "Administrative" },
  { key: "product_information", title: "Product Information" },
  { key: "manufacturing", title: "Manufacturing" },
  { key: "quality", title: "Quality" },
  { key: "qc", title: "QC" },
  { key: "qa", title: "QA" },
  { key: "stability", title: "Stability" },
  { key: "packaging", title: "Packaging" },
  { key: "labeling", title: "Labeling" },
  { key: "safety", title: "Safety" },
  { key: "regulatory", title: "Regulatory" },
  { key: "supporting_documents", title: "Supporting Documents" },
] as const;

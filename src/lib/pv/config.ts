export const PV_NUMBER_SERIES = {
  INTAKE: { documentType: "PVINT", prefix: "PV-INT" },
  CASE: { documentType: "PVCASE", prefix: "PV" },
  FOLLOWUP: { documentType: "PVFU", prefix: "PV-FU" },
  REPORT: { documentType: "PVRPT", prefix: "PV-RPT" },
  SIGNAL: { documentType: "PVSIG", prefix: "PV-SIG" },
  COMMITMENT: { documentType: "PVCOM", prefix: "PV-COM" },
  RULE: { documentType: "PVRULE", prefix: "PV-RULE" },
} as const;

export const DEFAULT_PV_WINDOWS = {
  caseProcessingDays: 30,
  followUpDays: 14,
  notificationSoonDays: 7,
  notificationUrgentDays: 2,
};

export const DEFAULT_FOLLOWUP_QUESTIONS = [
  "Missing patient details",
  "Missing event dates",
  "Missing product information",
  "Missing batch number",
  "Missing outcome",
  "Missing medical history",
  "Missing reporter details",
  "Missing treatment information",
];

export const ORGANIZATION_TIMEZONE = "Asia/Kolkata";

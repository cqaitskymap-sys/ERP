import { DEFAULT_COMPLAINT_CATEGORIES } from "@/types/complaints";

export const COMPLAINT_NUMBER_SERIES = {
  CMP: { documentType: "CMP", prefix: "CMP" },
  INV: { documentType: "CINV", prefix: "INV" },
  SMP: { documentType: "CSMP", prefix: "SMP" },
  REC: { documentType: "CREC", prefix: "REC" },
  WDR: { documentType: "CWDR", prefix: "WDR" },
  CRN: { documentType: "CRN", prefix: "CRN" },
} as const;

export const DEFAULT_SLA = {
  acknowledgementDays: 2,
  triageDays: 5,
  investigationDays: 30,
  qaReviewDays: 7,
  customerResponseDays: 10,
  closureDays: 45,
  timezone: "Asia/Kolkata",
};

export const DEFAULT_CATEGORY_OPTIONS = DEFAULT_COMPLAINT_CATEGORIES.map((value) => ({
  value,
  label: value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
}));

export const INVESTIGATION_DEPARTMENTS = [
  "qa",
  "qc",
  "production",
  "warehouse",
  "engineering",
  "packaging",
  "rd",
  "regulatory",
  "pharmacovigilance",
  "supply_chain",
  "customer_service",
];

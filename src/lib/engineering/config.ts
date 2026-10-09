export const DEFAULT_PM_DUE_SOON_DAYS = 7;
export const DEFAULT_CALIBRATION_DUE_SOON_DAYS = 14;
export const DEFAULT_CURRENCY = "INR";

export const ENGINEERING_NUMBER_SERIES = {
  EQ: { documentType: "ENG-EQ", prefix: "EQ" },
  MWO: { documentType: "MWO", prefix: "MWO" },
  BRK: { documentType: "BRK", prefix: "BRK" },
  CAL: { documentType: "CAL", prefix: "CAL" },
  INS: { documentType: "ENG-INS", prefix: "INS" },
  PM: { documentType: "ENG-PM", prefix: "PM" },
  PMT: { documentType: "ENG-PMT", prefix: "PMT" },
  QUAL: { documentType: "ENG-QUAL", prefix: "QUAL" },
  UTIL: { documentType: "ENG-UTIL", prefix: "UTIL" },
  ALERT: { documentType: "ENG-ALERT", prefix: "UAL" },
} as const;

export const WORKFLOW_MODULES = {
  workOrder: "engineering_work_order",
  calibration: "engineering_calibration",
  qualification: "engineering_qualification",
  breakdown: "engineering_breakdown",
  maintenancePlan: "engineering_maintenance_plan",
} as const;

export const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  half_yearly: 182,
  yearly: 365,
};

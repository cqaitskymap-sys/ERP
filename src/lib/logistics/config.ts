export const LOGISTICS_NUMBER_SERIES = {
  MOV: { documentType: "STKMOV", prefix: "STK-MOV" },
  PICK: { documentType: "PICK", prefix: "PICK" },
  PACK: { documentType: "PACK", prefix: "PACK" },
  SHP: { documentType: "SHP", prefix: "SHP" },
  WRET: { documentType: "WRET", prefix: "WRET" },
  CNT: { documentType: "CNT", prefix: "CNT" },
  EXC: { documentType: "TEMPEXC", prefix: "TEMP-EXC" },
  PUT: { documentType: "PUT", prefix: "PUT" },
  PAL: { documentType: "PAL", prefix: "PAL" },
} as const;

export const DEFAULT_EXPIRY_THRESHOLDS = {
  windows: [180, 90, 60, 30, 7] as const,
  near: 90,
  critical: 30,
};

export const DEFAULT_TEMPERATURE_UNIT = "C";

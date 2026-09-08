export const QC_NUMBER_SERIES = {
  SMPREQ: { documentType: "QCSMPREQ", prefix: "QC-SR" },
  SMP: { documentType: "QCSMP", prefix: "QC-SMP" },
  TESTREQ: { documentType: "QCTR", prefix: "QC-TR" },
  TEST: { documentType: "QCTEST", prefix: "QC-T" },
  SPEC: { documentType: "QCSPEC", prefix: "QC-SPEC" },
  METHOD: { documentType: "QCMTH", prefix: "QC-MTH" },
  OOS: { documentType: "QCOOS", prefix: "QC-OOS" },
  OOT: { documentType: "QCOOT", prefix: "QC-OOT" },
  RETEST: { documentType: "QCRT", prefix: "QC-RT" },
  RESAMP: { documentType: "QCRS", prefix: "QC-RS" },
  COA: { documentType: "QCCOA", prefix: "COA" },
  DISP: { documentType: "QCDISP", prefix: "QC-DISP" },
  INST: { documentType: "QCINST", prefix: "QC-INS" },
  STD: { documentType: "QCSTD", prefix: "QC-STD" },
  STB: { documentType: "QCSTB", prefix: "QC-STB" },
} as const;

export const QC_WORKFLOW_MODULES = {
  sampleRequest: "qc_sample_request",
  specification: "qc_specification",
  testMethod: "qc_test_method",
  test: "qc_test",
  coa: "qc_coa",
  resampling: "qc_resampling",
  retest: "qc_retest",
} as const;

export const DEFAULT_MAX_RETESTS = 2;
export const DEFAULT_SAMPLE_SOURCES_KEY = "qcSampleSources";

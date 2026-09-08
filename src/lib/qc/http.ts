import { QC_COLLECTIONS } from "@/lib/qc/collections";
import type { Permission } from "@/types/permissions";

export const QC_RESOURCES = {
  sampleRequests: { collection: QC_COLLECTIONS.sampleRequests, read: "qcSample:read" as Permission, create: "qcSample:create" as Permission },
  samples: { collection: QC_COLLECTIONS.samples, read: "qcSample:read" as Permission, create: "qcSample:create" as Permission },
  testRequests: { collection: QC_COLLECTIONS.testRequests, read: "qcTest:read" as Permission, create: "qcTest:create" as Permission },
  assignments: { collection: QC_COLLECTIONS.assignments, read: "qcTest:read" as Permission, create: "qcTest:assign" as Permission },
  tests: { collection: QC_COLLECTIONS.tests, read: "qcTest:read" as Permission, create: "qcTest:create" as Permission },
  results: { collection: QC_COLLECTIONS.results, read: "qcTest:read" as Permission, create: "qcTest:execute" as Permission },
  specifications: { collection: QC_COLLECTIONS.specifications, read: "qcSpecification:read" as Permission, create: "qcSpecification:create" as Permission },
  methods: { collection: QC_COLLECTIONS.methods, read: "qcTestMethod:read" as Permission, create: "qcTestMethod:create" as Permission },
  oos: { collection: QC_COLLECTIONS.oos, read: "qcOos:read" as Permission, create: "qcOos:create" as Permission },
  oot: { collection: QC_COLLECTIONS.oot, read: "qcOot:read" as Permission, create: "qcOot:create" as Permission },
  retests: { collection: QC_COLLECTIONS.retests, read: "qcRetest:create" as Permission, create: "qcRetest:create" as Permission },
  resampling: { collection: QC_COLLECTIONS.resampling, read: "qcResampling:create" as Permission, create: "qcResampling:create" as Permission },
  coas: { collection: QC_COLLECTIONS.coas, read: "qcCoa:read" as Permission, create: "qcCoa:create" as Permission },
  dispositions: { collection: QC_COLLECTIONS.dispositions, read: "qcTest:read" as Permission, create: "qcTest:approve" as Permission },
  instruments: { collection: QC_COLLECTIONS.instruments, read: "qcInstrument:read" as Permission, create: "qcInstrument:create" as Permission },
  standards: { collection: QC_COLLECTIONS.standards, read: "qcReferenceStandard:read" as Permission, create: "qcReferenceStandard:create" as Permission },
  stability: { collection: QC_COLLECTIONS.stability, read: "qcStability:read" as Permission, create: "qcStability:create" as Permission },
} as const;

export type QcResource = keyof typeof QC_RESOURCES;

export function isQcResource(value: string): value is QcResource {
  return value in QC_RESOURCES;
}

export const READ_ALIASES: Record<QcResource, Permission[]> = {
  sampleRequests: ["qcSample:read", "qc:read", "quality:read"],
  samples: ["qcSample:read", "qc:read", "quality:read"],
  testRequests: ["qcTest:read", "qc:read", "quality:read"],
  assignments: ["qcTest:read", "qc:read"],
  tests: ["qcTest:read", "qc:read", "quality:read"],
  results: ["qcTest:read", "qc:read"],
  specifications: ["qcSpecification:read", "qc:read", "quality:read"],
  methods: ["qcTestMethod:read", "qc:read"],
  oos: ["qcOos:read", "qc:read", "quality:read"],
  oot: ["qcOot:read", "qc:read"],
  retests: ["qcRetest:create", "qcTest:read"],
  resampling: ["qcResampling:create", "qcSample:read"],
  coas: ["qcCoa:read", "qc:read", "quality:read"],
  dispositions: ["qcTest:read", "qc:read"],
  instruments: ["qcInstrument:read", "qc:read"],
  standards: ["qcReferenceStandard:read", "qc:read"],
  stability: ["qcStability:read", "qc:read"],
};

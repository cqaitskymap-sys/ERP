import { SQ_COLLECTIONS } from "@/lib/supplier-quality/collections";
import type { Permission } from "@/types/permissions";

export const SQ_RESOURCES = {
  profiles: { collection: SQ_COLLECTIONS.profiles, read: "supplierQuality:read" as Permission, create: "supplierQuality:update" as Permission },
  risks: { collection: SQ_COLLECTIONS.risks, read: "supplierQualityRisk:read" as Permission, create: "supplierQualityRisk:create" as Permission },
  qualifications: { collection: SQ_COLLECTIONS.qualifications, read: "supplierQualityQualification:read" as Permission, create: "supplierQualityQualification:create" as Permission },
  documents: { collection: SQ_COLLECTIONS.documents, read: "supplierQualityQualification:read" as Permission, create: "supplierQualityQualification:update" as Permission },
  questionnaires: { collection: SQ_COLLECTIONS.questionnaires, read: "supplierQualityQuestionnaire:read" as Permission, create: "supplierQualityQuestionnaire:create" as Permission },
  evaluations: { collection: SQ_COLLECTIONS.evaluations, read: "supplierQualityEvaluation:read" as Permission, create: "supplierQualityEvaluation:create" as Permission },
  materials: { collection: SQ_COLLECTIONS.materials, read: "supplierQualityQualification:read" as Permission, create: "supplierQualityQualification:update" as Permission },
  audits: { collection: SQ_COLLECTIONS.audits, read: "supplierQualityAudit:read" as Permission, create: "supplierQualityAudit:create" as Permission },
  findings: { collection: SQ_COLLECTIONS.findings, read: "supplierQualityAudit:read" as Permission, create: "supplierQualityAudit:update" as Permission },
  certificates: { collection: SQ_COLLECTIONS.certificates, read: "supplierQualityCertificate:read" as Permission, create: "supplierQualityCertificate:create" as Permission },
  agreements: { collection: SQ_COLLECTIONS.agreements, read: "supplierQualityAgreement:read" as Permission, create: "supplierQualityAgreement:create" as Permission },
  changes: { collection: SQ_COLLECTIONS.changes, read: "supplierQualityChange:read" as Permission, create: "supplierQualityChange:create" as Permission },
  suspensions: { collection: SQ_COLLECTIONS.suspensions, read: "supplierQualitySuspension:read" as Permission, create: "supplierQualitySuspension:create" as Permission },
  requalifications: { collection: SQ_COLLECTIONS.requalifications, read: "supplierQualityRequalification:read" as Permission, create: "supplierQualityRequalification:create" as Permission },
  communications: { collection: SQ_COLLECTIONS.communications, read: "supplierQuality:read" as Permission, create: "supplierQuality:update" as Permission },
} as const;

export type SqResource = keyof typeof SQ_RESOURCES;

export function isSqResource(value: string): value is SqResource {
  return value in SQ_RESOURCES;
}

export const READ_ALIASES: Record<SqResource, Permission[]> = {
  profiles: ["supplierQuality:read"],
  risks: ["supplierQualityRisk:read", "supplierQuality:read"],
  qualifications: ["supplierQualityQualification:read", "supplierQuality:read"],
  documents: ["supplierQualityQualification:read", "supplierQuality:read"],
  questionnaires: ["supplierQualityQuestionnaire:read", "supplierQuality:read"],
  evaluations: ["supplierQualityEvaluation:read", "supplierQuality:read"],
  materials: ["supplierQualityQualification:read", "supplierQuality:read"],
  audits: ["supplierQualityAudit:read", "supplierQuality:read"],
  findings: ["supplierQualityAudit:read", "supplierQuality:read"],
  certificates: ["supplierQualityCertificate:read", "supplierQuality:read"],
  agreements: ["supplierQualityAgreement:read", "supplierQuality:read"],
  changes: ["supplierQualityChange:read", "supplierQuality:read"],
  suspensions: ["supplierQualitySuspension:read", "supplierQuality:read"],
  requalifications: ["supplierQualityRequalification:read", "supplierQuality:read"],
  communications: ["supplierQuality:read"],
};

import { QA_COLLECTIONS } from "@/lib/qa/collections";
import type { Permission } from "@/types/permissions";

export const QA_RESOURCES = {
  reviews: { collection: QA_COLLECTIONS.reviews, read: "qaBatchReview:read" as Permission, create: "qaBatchReview:update" as Permission },
  dispositions: { collection: QA_COLLECTIONS.dispositions, read: "qaBatchRelease:read" as Permission, create: "qaBatchRelease:approve" as Permission },
  holds: { collection: QA_COLLECTIONS.holds, read: "qaBatchHold:create" as Permission, create: "qaBatchHold:create" as Permission },
  rejections: { collection: QA_COLLECTIONS.rejections, read: "qaBatchReject:create" as Permission, create: "qaBatchReject:create" as Permission },
  deviations: { collection: QA_COLLECTIONS.deviations, read: "qaDeviation:read" as Permission, create: "qaDeviation:create" as Permission },
  capas: { collection: QA_COLLECTIONS.capas, read: "qaCapa:read" as Permission, create: "qaCapa:create" as Permission },
  changes: { collection: QA_COLLECTIONS.changes, read: "qaChangeControl:read" as Permission, create: "qaChangeControl:create" as Permission },
  documents: { collection: QA_COLLECTIONS.documents, read: "qaDocumentReview:read" as Permission, create: "qaDocumentReview:read" as Permission },
  certificates: { collection: QA_COLLECTIONS.certificates, read: "qaReleaseCertificate:read" as Permission, create: "qaReleaseCertificate:create" as Permission },
} as const;

export type QaResource = keyof typeof QA_RESOURCES;

export function isQaResource(value: string): value is QaResource {
  return value in QA_RESOURCES;
}

export const READ_ALIASES: Record<QaResource, Permission[]> = {
  reviews: ["qaBatchReview:read", "qa:read", "quality:read"],
  dispositions: ["qaBatchRelease:read", "qa:read"],
  holds: ["qaBatchHold:create", "qaBatchReview:read", "qa:read"],
  rejections: ["qaBatchReject:create", "qaBatchReview:read", "qa:read"],
  deviations: ["qaDeviation:read", "qa:read"],
  capas: ["qaCapa:read", "qa:read"],
  changes: ["qaChangeControl:read", "qa:read"],
  documents: ["qaDocumentReview:read", "qa:read"],
  certificates: ["qaReleaseCertificate:read", "qa:read"],
};

import { DMS_COLLECTIONS } from "@/lib/dms/collections";
import type { Permission } from "@/types/permissions";

export const DMS_RESOURCES = {
  documents: {
    collection: DMS_COLLECTIONS.documents,
    read: "dmsDocument:read" as Permission,
    create: "dmsDocument:create" as Permission,
  },
  versions: {
    collection: DMS_COLLECTIONS.versions,
    read: "dmsDocument:read" as Permission,
    create: "dmsDocument:update" as Permission,
  },
  reviews: {
    collection: DMS_COLLECTIONS.reviews,
    read: "dmsReview:read" as Permission,
    create: "dmsReview:review" as Permission,
  },
  approvals: {
    collection: DMS_COLLECTIONS.approvals,
    read: "dmsApproval:read" as Permission,
    create: "dmsApproval:approve" as Permission,
  },
  changeRequests: {
    collection: DMS_COLLECTIONS.changeRequests,
    read: "dmsChangeRequest:read" as Permission,
    create: "dmsChangeRequest:create" as Permission,
  },
  periodicReviews: {
    collection: DMS_COLLECTIONS.periodicReviews,
    read: "dmsPeriodicReview:read" as Permission,
    create: "dmsPeriodicReview:review" as Permission,
  },
  externalDocuments: {
    collection: DMS_COLLECTIONS.externalDocuments,
    read: "dmsExternal:read" as Permission,
    create: "dmsExternal:create" as Permission,
  },
  templates: {
    collection: DMS_COLLECTIONS.templates,
    read: "dmsNumbering:read" as Permission,
    create: "dmsNumbering:update" as Permission,
  },
  retention: {
    collection: DMS_COLLECTIONS.retention,
    read: "dmsAudit:read" as Permission,
    create: "dmsDocument:close" as Permission,
  },
  settings: {
    collection: DMS_COLLECTIONS.settings,
    read: "dms:read" as Permission,
    create: "dmsNumbering:update" as Permission,
  },
  audit: {
    collection: DMS_COLLECTIONS.audit,
    read: "dmsAudit:read" as Permission,
    create: "dmsAudit:read" as Permission,
  },
} as const;

export type DmsResource = keyof typeof DMS_RESOURCES;

export function isDmsResource(value: string): value is DmsResource {
  return value in DMS_RESOURCES;
}

export const READ_ALIASES: Record<DmsResource, Permission[]> = {
  documents: ["dmsDocument:read", "dms:read"],
  versions: ["dmsDocument:read", "dms:read"],
  reviews: ["dmsReview:read", "dms:read"],
  approvals: ["dmsApproval:read", "dms:read"],
  changeRequests: ["dmsChangeRequest:read", "dms:read"],
  periodicReviews: ["dmsPeriodicReview:read", "dms:read"],
  externalDocuments: ["dmsExternal:read", "dms:read"],
  templates: ["dmsNumbering:read", "dms:read"],
  retention: ["dmsAudit:read", "dms:read"],
  settings: ["dms:read", "dmsNumbering:update"],
  audit: ["dmsAudit:read", "audit:read"],
};

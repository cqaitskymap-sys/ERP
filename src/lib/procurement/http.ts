import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import type { Permission } from "@/types/permissions";

export const PROCUREMENT_RESOURCES = {
  requirements: {
    collection: PROCUREMENT_COLLECTIONS.requirements,
    read: "purchaseRequisition:read" as Permission,
    create: "purchaseRequisition:create" as Permission,
  },
  requisitions: {
    collection: PROCUREMENT_COLLECTIONS.requisitions,
    read: "purchaseRequisition:read" as Permission,
    create: "purchaseRequisition:create" as Permission,
  },
  rfqs: {
    collection: PROCUREMENT_COLLECTIONS.rfqs,
    read: "rfq:read" as Permission,
    create: "rfq:create" as Permission,
  },
  quotations: {
    collection: PROCUREMENT_COLLECTIONS.quotations,
    read: "quotation:read" as Permission,
    create: "quotation:create" as Permission,
  },
  selections: {
    collection: PROCUREMENT_COLLECTIONS.selections,
    read: "vendorSelection:create" as Permission,
    create: "vendorSelection:create" as Permission,
  },
  orders: {
    collection: PROCUREMENT_COLLECTIONS.orders,
    read: "purchaseOrder:read" as Permission,
    create: "purchaseOrder:create" as Permission,
  },
  amendments: {
    collection: PROCUREMENT_COLLECTIONS.amendments,
    read: "purchaseOrderAmendment:create" as Permission,
    create: "purchaseOrderAmendment:create" as Permission,
  },
  documents: {
    collection: PROCUREMENT_COLLECTIONS.documents,
    read: "purchaseOrder:read" as Permission,
    create: "purchaseOrder:update" as Permission,
  },
  approvals: {
    collection: PROCUREMENT_COLLECTIONS.approvals,
    read: "purchaseRequisition:read" as Permission,
    create: "purchaseRequisition:approve" as Permission,
  },
} as const;

export type ProcurementResource = keyof typeof PROCUREMENT_RESOURCES;

export function isProcurementResource(value: string): value is ProcurementResource {
  return value in PROCUREMENT_RESOURCES;
}

export const READ_ALIASES: Record<ProcurementResource, Permission[]> = {
  requirements: ["purchaseRequisition:read", "procurement:read"],
  requisitions: ["purchaseRequisition:read", "procurement:read"],
  rfqs: ["rfq:read", "procurement:read"],
  quotations: ["quotation:read", "procurement:read"],
  selections: ["vendorSelection:create", "vendorSelection:approve", "rfq:read"],
  orders: ["purchaseOrder:read", "procurement:read"],
  amendments: ["purchaseOrderAmendment:create", "purchaseOrderAmendment:approve", "purchaseOrder:read"],
  documents: ["purchaseOrder:read", "rfq:read", "quotation:read"],
  approvals: [
    "purchaseRequisition:approve",
    "purchaseOrder:approve",
    "vendorSelection:approve",
    "purchaseOrderAmendment:approve",
    "procurement:read",
  ],
};

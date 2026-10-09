import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import type { Permission } from "@/types/permissions";

export const SALES_RESOURCES = {
  priceLists: {
    collection: SALES_COLLECTIONS.priceLists,
    read: "salesPricing:read" as Permission,
    create: "salesPricing:create" as Permission,
  },
  priceRules: {
    collection: SALES_COLLECTIONS.priceRules,
    read: "salesPricing:read" as Permission,
    create: "salesPricing:create" as Permission,
  },
  quotations: {
    collection: SALES_COLLECTIONS.quotations,
    read: "salesQuotation:read" as Permission,
    create: "salesQuotation:create" as Permission,
  },
  orders: {
    collection: SALES_COLLECTIONS.orders,
    read: "salesOrder:read" as Permission,
    create: "salesOrder:create" as Permission,
  },
  contractOrders: {
    collection: SALES_COLLECTIONS.contractOrders,
    read: "contractManufacturing:read" as Permission,
    create: "contractManufacturing:create" as Permission,
  },
  returns: {
    collection: SALES_COLLECTIONS.returns,
    read: "salesReturn:read" as Permission,
    create: "salesReturn:create" as Permission,
  },
  requirements: {
    collection: SALES_COLLECTIONS.requirements,
    read: "salesRequirement:read" as Permission,
    create: "salesRequirement:create" as Permission,
  },
  communications: {
    collection: SALES_COLLECTIONS.communications,
    read: "sales:read" as Permission,
    create: "sales:update" as Permission,
  },
  creditReviews: {
    collection: SALES_COLLECTIONS.creditReviews,
    read: "salesCredit:read" as Permission,
    create: "salesCredit:create" as Permission,
  },
  documents: {
    collection: SALES_COLLECTIONS.documents,
    read: "salesOrder:read" as Permission,
    create: "salesOrder:update" as Permission,
  },
  approvals: {
    collection: SALES_COLLECTIONS.orderApprovals,
    read: "salesOrder:read" as Permission,
    create: "salesOrder:approve" as Permission,
  },
  receivables: {
    collection: SALES_COLLECTIONS.receivables,
    read: "salesCredit:read" as Permission,
    create: "salesCredit:create" as Permission,
  },
  settings: {
    collection: SALES_COLLECTIONS.settings,
    read: "sales:read" as Permission,
    create: "sales:update" as Permission,
  },
} as const;

export type SalesResource = keyof typeof SALES_RESOURCES;

export function isSalesResource(value: string): value is SalesResource {
  return value in SALES_RESOURCES;
}

export const READ_ALIASES: Record<SalesResource, Permission[]> = {
  priceLists: ["salesPricing:read", "sales:read"],
  priceRules: ["salesPricing:read", "sales:read"],
  quotations: ["salesQuotation:read", "sales:read"],
  orders: ["salesOrder:read", "sales:read"],
  contractOrders: ["contractManufacturing:read", "sales:read"],
  returns: ["salesReturn:read", "sales:read"],
  requirements: ["salesRequirement:read", "sales:read", "customers:read"],
  communications: ["sales:read", "salesOrder:read", "salesQuotation:read"],
  creditReviews: ["salesCredit:read", "finance:read", "sales:read"],
  documents: ["salesOrder:read", "salesQuotation:read", "sales:read"],
  approvals: [
    "salesOrder:approve",
    "salesQuotation:approve",
    "salesReturn:approve",
    "contractManufacturing:approve",
    "sales:read",
  ],
  receivables: ["salesCredit:read", "finance:read", "sales:read"],
  settings: ["sales:read", "admin:read"],
};

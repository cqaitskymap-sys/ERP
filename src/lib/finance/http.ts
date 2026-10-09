import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import type { Permission } from "@/types/permissions";

export const FINANCE_RESOURCES = {
  accounts: {
    collection: FINANCE_COLLECTIONS.accounts,
    read: "financeAccounts:read" as Permission,
    create: "financeAccounts:create" as Permission,
  },
  journals: {
    collection: FINANCE_COLLECTIONS.journals,
    read: "financeJournal:read" as Permission,
    create: "financeJournal:create" as Permission,
  },
  supplierInvoices: {
    collection: FINANCE_COLLECTIONS.supplierInvoices,
    read: "financeAp:read" as Permission,
    create: "financeAp:create" as Permission,
  },
  paymentProposals: {
    collection: FINANCE_COLLECTIONS.paymentProposals,
    read: "financePayment:read" as Permission,
    create: "financePayment:create" as Permission,
  },
  payments: {
    collection: FINANCE_COLLECTIONS.payments,
    read: "financePayment:read" as Permission,
    create: "financePayment:create" as Permission,
  },
  customerInvoices: {
    collection: FINANCE_COLLECTIONS.customerInvoices,
    read: "financeAr:read" as Permission,
    create: "financeAr:create" as Permission,
  },
  customerReceipts: {
    collection: FINANCE_COLLECTIONS.customerReceipts,
    read: "financeAr:read" as Permission,
    create: "financeAr:create" as Permission,
  },
  creditNotes: {
    collection: FINANCE_COLLECTIONS.creditNotes,
    read: "financeAr:read" as Permission,
    create: "financeAr:create" as Permission,
  },
  debitNotes: {
    collection: FINANCE_COLLECTIONS.debitNotes,
    read: "financeAp:read" as Permission,
    create: "financeAp:create" as Permission,
  },
  bankAccounts: {
    collection: FINANCE_COLLECTIONS.bankAccounts,
    read: "financeBank:read" as Permission,
    create: "financeBank:create" as Permission,
  },
  bankStatements: {
    collection: FINANCE_COLLECTIONS.bankStatements,
    read: "financeBank:read" as Permission,
    create: "financeBank:create" as Permission,
  },
  bankReconciliations: {
    collection: FINANCE_COLLECTIONS.bankReconciliations,
    read: "financeBank:read" as Permission,
    create: "financeBank:reconcile" as Permission,
  },
  taxCodes: {
    collection: FINANCE_COLLECTIONS.taxCodes,
    read: "financeTax:read" as Permission,
    create: "financeTax:create" as Permission,
  },
  costCenters: {
    collection: FINANCE_COLLECTIONS.costCenters,
    read: "finance:read" as Permission,
    create: "finance:update" as Permission,
  },
  budgets: {
    collection: FINANCE_COLLECTIONS.budgets,
    read: "financeBudget:read" as Permission,
    create: "financeBudget:create" as Permission,
  },
  fixedAssets: {
    collection: FINANCE_COLLECTIONS.fixedAssets,
    read: "finance:read" as Permission,
    create: "finance:create" as Permission,
  },
  expenseClaims: {
    collection: FINANCE_COLLECTIONS.expenseClaims,
    read: "finance:read" as Permission,
    create: "finance:create" as Permission,
  },
  periods: {
    collection: FINANCE_COLLECTIONS.periods,
    read: "financePeriod:read" as Permission,
    create: "financePeriod:create" as Permission,
  },
  settings: {
    collection: FINANCE_COLLECTIONS.settings,
    read: "finance:read" as Permission,
    create: "finance:update" as Permission,
  },
} as const;

export type FinanceResource = keyof typeof FINANCE_RESOURCES;

export function isFinanceResource(value: string): value is FinanceResource {
  return value in FINANCE_RESOURCES;
}

export const READ_ALIASES: Record<FinanceResource, Permission[]> = {
  accounts: ["financeAccounts:read", "finance:read"],
  journals: ["financeJournal:read", "finance:read"],
  supplierInvoices: ["financeAp:read", "finance:read"],
  paymentProposals: ["financePayment:read", "finance:read"],
  payments: ["financePayment:read", "finance:read"],
  customerInvoices: ["financeAr:read", "finance:read", "salesCredit:read"],
  customerReceipts: ["financeAr:read", "finance:read"],
  creditNotes: ["financeAr:read", "financeAp:read", "finance:read"],
  debitNotes: ["financeAp:read", "finance:read"],
  bankAccounts: ["financeBank:read", "finance:read"],
  bankStatements: ["financeBank:read", "finance:read"],
  bankReconciliations: ["financeBank:read", "financeBank:reconcile", "finance:read"],
  taxCodes: ["financeTax:read", "finance:read"],
  costCenters: ["finance:read"],
  budgets: ["financeBudget:read", "finance:read"],
  fixedAssets: ["finance:read"],
  expenseClaims: ["finance:read"],
  periods: ["financePeriod:read", "finance:read"],
  settings: ["finance:read", "admin:read"],
};

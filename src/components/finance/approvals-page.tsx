"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { getPendingFinanceApprovals } from "@/lib/finance/client";
import { publicMasterError } from "@/lib/masters/errors";

const DOC_ROUTES: Record<string, (id: string) => string> = {
  financeJournalEntry: (id) => `/finance/journals/${id}`,
  finance_supplier_invoice: (id) => `/finance/supplier-invoices/${id}`,
  financeSupplierInvoice: (id) => `/finance/supplier-invoices/${id}`,
  finance_payment_proposal: (id) => `/finance/payments/${id}`,
  financePaymentProposal: (id) => `/finance/payments/${id}`,
  finance_customer_invoice: (id) => `/finance/customer-invoices/${id}`,
  financeCustomerInvoice: (id) => `/finance/customer-invoices/${id}`,
  finance_credit_note: (id) => `/finance/credit-notes/${id}`,
  finance_budget: (id) => `/finance/budgets/${id}`,
  finance_expense_claim: (id) => `/finance/expenses/${id}`,
  finance_period_close: (id) => `/finance/periods/${id}`,
  finance_bank_reconciliation: (id) => `/finance/bank-reconciliation/${id}`,
};

export function FinanceApprovalsPage() {
  return (
    <RequirePermission permission={"finance:approve" as import("@/types/permissions").Permission}>
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPendingFinanceApprovals()
        .then((result) => setRows(result.rows))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState title="Unable to load approvals" description={error} />;

  return (
    <div>
      <PageHeader title="Finance approvals" description="Pending approval steps from finance workflows." />
      {!rows.length ? (
        <EmptyState title="No pending approvals" description="Approval queues are empty." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const docType = String(row.documentType || row.module || "");
            const docId = String(row.documentId || row.id);
            const href = DOC_ROUTES[docType]?.(docId) || `/finance/approvals#${docId}`;
            return (
              <Link key={row.id} href={href} className="block rounded-xl border p-4 hover:bg-muted/40">
                <p className="font-medium">{String(row.documentNumber || row.documentId || row.id)}</p>
                <p className="text-sm text-muted-foreground">
                  {String(row.label || row.role)} · step {String(row.step)} · {docType}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

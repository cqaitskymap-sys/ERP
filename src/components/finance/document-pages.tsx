"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { FinanceList } from "@/components/finance/finance-list";
import { COMMON_FINANCE_ACTIONS, FinanceWorkflowActions, financeAction } from "@/components/finance/workflow-actions";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getFinance, getFinanceReport } from "@/lib/finance/client";
import {
  ALL_STATUS_OPTIONS,
  accountStatusOptions,
  assetStatusOptions,
  bankReconStatusOptions,
  budgetStatusOptions,
  creditNoteStatusOptions,
  customerInvoiceStatusOptions,
  expenseStatusOptions,
  journalStatusOptions,
  labelFor,
  paymentStatusOptions,
  periodStatusOptions,
  supplierInvoiceStatusOptions,
  workflowTone,
} from "@/lib/finance/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

const P = {
  accounts: "financeAccounts:read" as Permission,
  journals: "financeJournal:read" as Permission,
  ap: "financeAp:read" as Permission,
  payment: "financePayment:read" as Permission,
  ar: "financeAr:read" as Permission,
  bank: "financeBank:read" as Permission,
  tax: "financeTax:read" as Permission,
  budget: "financeBudget:read" as Permission,
  period: "financePeriod:read" as Permission,
  reports: "financeReports:read" as Permission,
  finance: "finance:read" as Permission,
};

export function ChartOfAccountsList() {
  return (
    <FinanceList
      title="Chart of accounts"
      description="Controlled GL accounts with type, category, and posting rules."
      resource="accounts"
      permission={P.accounts}
      createHref="/finance/accounts/new"
      createLabel="New account"
      exportColumns={["accountCode", "name", "accountType", "category", "status"]}
      columns={[
        { key: "accountCode", header: "Code" },
        { key: "name", header: "Name" },
        { key: "accountType", header: "Type", hideOnMobile: true },
        { key: "category", header: "Category", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/accounts/${row.id}`}
    />
  );
}

export function JournalList() {
  return (
    <FinanceList
      title="Journal entries"
      description="Manual and system journals with approval and posting controls."
      resource="journals"
      permission={P.journals}
      createHref="/finance/journals/new"
      createLabel="New journal"
      exportColumns={["journalNumber", "journalDate", "description", "status", "totalDebit", "totalCredit"]}
      columns={[
        { key: "journalNumber", header: "JE #" },
        { key: "journalDate", header: "Date", hideOnMobile: true },
        { key: "description", header: "Description" },
        { key: "status", header: "Status" },
        { key: "totalDebit", header: "Debit", hideOnMobile: true },
        { key: "totalCredit", header: "Credit", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/journals/${row.id}`}
    />
  );
}

export function SupplierInvoiceList() {
  return (
    <FinanceList
      title="Supplier invoices"
      description="Accounts payable with three-way match and approval workflow."
      resource="supplierInvoices"
      permission={P.ap}
      createHref="/finance/supplier-invoices/new"
      createLabel="New invoice"
      exportColumns={["invoiceNumber", "vendorId", "invoiceDate", "dueDate", "status", "grandTotal"]}
      columns={[
        { key: "invoiceNumber", header: "Invoice #" },
        { key: "vendorId", header: "Vendor" },
        { key: "invoiceDate", header: "Date", hideOnMobile: true },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "grandTotal", header: "Total", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/supplier-invoices/${row.id}`}
    />
  );
}

export function PaymentProposalList() {
  return (
    <FinanceList
      title="Payment proposals"
      description="Batch payment proposals awaiting approval and execution."
      resource="paymentProposals"
      permission={P.payment}
      createHref="/finance/payments/new"
      createLabel="New proposal"
      exportColumns={["proposalNumber", "status", "totalAmount", "currency", "proposedDate"]}
      columns={[
        { key: "proposalNumber", header: "Proposal #" },
        { key: "status", header: "Status" },
        { key: "totalAmount", header: "Amount", hideOnMobile: true },
        { key: "currency", header: "Currency", hideOnMobile: true },
        { key: "proposedDate", header: "Date", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/payments/${row.id}`}
    />
  );
}

export function PaymentList() {
  return (
    <FinanceList
      title="Payments"
      description="Executed and in-flight supplier payments."
      resource="payments"
      permission={P.payment}
      exportColumns={["paymentNumber", "beneficiaryName", "status", "amount", "valueDate"]}
      columns={[
        { key: "paymentNumber", header: "Payment #" },
        { key: "beneficiaryName", header: "Beneficiary" },
        { key: "status", header: "Status" },
        { key: "amount", header: "Amount", hideOnMobile: true },
        { key: "valueDate", header: "Value date", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/payments/${row.id}`}
    />
  );
}

export function CustomerInvoiceList() {
  return (
    <FinanceList
      title="Customer invoices"
      description="Accounts receivable billing with approval and posting."
      resource="customerInvoices"
      permission={P.ar}
      createHref="/finance/customer-invoices/new"
      createLabel="New invoice"
      exportColumns={["invoiceNumber", "customerId", "invoiceDate", "dueDate", "status", "grandTotal"]}
      columns={[
        { key: "invoiceNumber", header: "Invoice #" },
        { key: "customerId", header: "Customer" },
        { key: "invoiceDate", header: "Date", hideOnMobile: true },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "grandTotal", header: "Total", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/customer-invoices/${row.id}`}
    />
  );
}

export function CreditNoteList() {
  return (
    <FinanceList
      title="Credit notes"
      description="Customer credit adjustments linked to AR."
      resource="creditNotes"
      permission={P.ar}
      createHref="/finance/credit-notes/new"
      createLabel="New credit note"
      exportColumns={["creditNoteNumber", "customerId", "status", "amount"]}
      columns={[
        { key: "creditNoteNumber", header: "CN #" },
        { key: "customerId", header: "Customer" },
        { key: "status", header: "Status" },
        { key: "amount", header: "Amount", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/credit-notes/${row.id}`}
    />
  );
}

export function DebitNoteList() {
  return (
    <FinanceList
      title="Debit notes"
      description="Supplier debit adjustments and AP corrections."
      resource="debitNotes"
      permission={P.ap}
      createHref="/finance/debit-notes/new"
      createLabel="New debit note"
      exportColumns={["debitNoteNumber", "vendorId", "status", "amount"]}
      columns={[
        { key: "debitNoteNumber", header: "DN #" },
        { key: "vendorId", header: "Vendor" },
        { key: "status", header: "Status" },
        { key: "amount", header: "Amount", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/debit-notes/${row.id}`}
    />
  );
}

export function BankAccountList() {
  return (
    <FinanceList
      title="Bank accounts"
      description="Operating accounts used for payments and reconciliation."
      resource="bankAccounts"
      permission={P.bank}
      createHref="/finance/bank-accounts/new"
      createLabel="New bank account"
      exportColumns={["accountName", "bankName", "currency", "status"]}
      columns={[
        { key: "accountName", header: "Account" },
        { key: "bankName", header: "Bank", hideOnMobile: true },
        { key: "currency", header: "Currency", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/bank-accounts/${row.id}`}
    />
  );
}

export function BankStatementList() {
  return (
    <FinanceList
      title="Bank statements"
      description="Imported statement batches for reconciliation."
      resource="bankStatements"
      permission={P.bank}
      exportColumns={["statementNumber", "bankAccountId", "periodStart", "periodEnd", "status"]}
      columns={[
        { key: "statementNumber", header: "Statement #" },
        { key: "bankAccountId", header: "Bank account" },
        { key: "periodStart", header: "From", hideOnMobile: true },
        { key: "periodEnd", header: "To", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/bank-accounts/${String(row.bankAccountId || row.id)}`}
    />
  );
}

export function BankReconciliationList() {
  return (
    <FinanceList
      title="Bank reconciliations"
      description="Statement-to-ledger matching workflows."
      resource="bankReconciliations"
      permission={P.bank}
      exportColumns={["reconciliationNumber", "bankAccountId", "status", "statementBalance", "bookBalance"]}
      columns={[
        { key: "reconciliationNumber", header: "Rec #" },
        { key: "bankAccountId", header: "Bank account" },
        { key: "status", header: "Status" },
        { key: "statementBalance", header: "Statement", hideOnMobile: true },
        { key: "bookBalance", header: "Book", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/bank-reconciliation/${row.id}`}
    />
  );
}

export function TaxCodeList() {
  return (
    <FinanceList
      title="Tax codes"
      description="GST and statutory tax configuration for AP/AR."
      resource="taxCodes"
      permission={P.tax}
      createHref="/finance/tax/new"
      createLabel="New tax code"
      exportColumns={["code", "name", "ratePercent", "status"]}
      columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "ratePercent", header: "Rate %", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/tax/${row.id}`}
    />
  );
}

export function CostCenterList() {
  return (
    <FinanceList
      title="Cost centers"
      description="Plant and department cost allocation dimensions."
      resource="costCenters"
      permission={P.finance}
      createHref="/finance/cost-centers/new"
      createLabel="New cost center"
      exportColumns={["code", "name", "status"]}
      columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/cost-centers/${row.id}`}
    />
  );
}

export function BudgetList() {
  return (
    <FinanceList
      title="Budgets"
      description="Approved budgets with variance tracking."
      resource="budgets"
      permission={P.budget}
      createHref="/finance/budgets/new"
      createLabel="New budget"
      exportColumns={["budgetNumber", "name", "fiscalYear", "status", "totalAmount"]}
      columns={[
        { key: "budgetNumber", header: "Budget #" },
        { key: "name", header: "Name" },
        { key: "fiscalYear", header: "Year", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "totalAmount", header: "Total", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/budgets/${row.id}`}
    />
  );
}

export function FixedAssetList() {
  return (
    <FinanceList
      title="Fixed assets"
      description="Capitalized assets and depreciation schedules."
      resource="fixedAssets"
      permission={P.finance}
      createHref="/finance/fixed-assets/new"
      createLabel="New asset"
      exportColumns={["assetNumber", "name", "status", "acquisitionCost", "usefulLifeMonths"]}
      columns={[
        { key: "assetNumber", header: "Asset #" },
        { key: "name", header: "Name" },
        { key: "status", header: "Status" },
        { key: "acquisitionCost", header: "Cost", hideOnMobile: true },
        { key: "usefulLifeMonths", header: "Life (mo)", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/fixed-assets/${row.id}`}
    />
  );
}

export function ExpenseClaimList() {
  return (
    <FinanceList
      title="Expense claims"
      description="Employee reimbursements with approval chain."
      resource="expenseClaims"
      permission={P.finance}
      createHref="/finance/expenses/new"
      createLabel="New claim"
      exportColumns={["claimNumber", "employeeId", "status", "totalAmount"]}
      columns={[
        { key: "claimNumber", header: "Claim #" },
        { key: "employeeId", header: "Employee" },
        { key: "status", header: "Status" },
        { key: "totalAmount", header: "Amount", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/expenses/${row.id}`}
    />
  );
}

export function PeriodList() {
  return (
    <FinanceList
      title="Financial periods"
      description="Open and closed accounting periods."
      resource="periods"
      permission={P.period}
      createHref="/finance/periods/new"
      createLabel="New period"
      exportColumns={["name", "startDate", "endDate", "status"]}
      columns={[
        { key: "name", header: "Period" },
        { key: "startDate", header: "Start", hideOnMobile: true },
        { key: "endDate", header: "End", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/periods/${row.id}`}
    />
  );
}

export function FinanceApOverview() {
  return (
    <RequirePermission permission={P.ap}>
      <ApOverviewInner />
    </RequirePermission>
  );
}

function ApOverviewInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getFinanceReport("ap_aging", {})
        .then((result) => setRows(result.rows as Row[]))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts payable"
        description="Supplier invoice pipeline and AP aging snapshot."
        actions={
          <>
            <Link href="/finance/supplier-invoices" className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium">
              All invoices
            </Link>
            <Link href="/finance/supplier-invoices/new" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              New supplier invoice
            </Link>
          </>
        }
      />
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">AP aging</div>
        {error ? <p className="p-4 text-sm text-destructive">{error}</p> : null}
        {!error && !rows.length ? <p className="p-4 text-sm text-muted-foreground">No aging rows yet.</p> : null}
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {Object.keys(rows[0]).slice(0, 6).map((key) => (
                    <th key={key} className="px-4 py-2 font-medium">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((row, index) => (
                  <tr key={String(row.id || index)} className="border-b last:border-0">
                    {Object.keys(rows[0]).slice(0, 6).map((key) => (
                      <td key={key} className="px-4 py-2">
                        {String(row[key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FinanceArOverview() {
  return (
    <RequirePermission permission={P.ar}>
      <ArOverviewInner />
    </RequirePermission>
  );
}

function ArOverviewInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getFinanceReport("ar_aging", {})
        .then((result) => setRows(result.rows as Row[]))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts receivable"
        description="Customer billing and AR aging."
        actions={
          <Link href="/finance/customer-invoices" className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium">
            All customer invoices
          </Link>
        }
      />
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">AR aging</div>
        {error ? <p className="p-4 text-sm text-destructive">{error}</p> : null}
        {!error && !rows.length ? <p className="p-4 text-sm text-muted-foreground">No aging rows yet.</p> : null}
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {Object.keys(rows[0]).slice(0, 6).map((key) => (
                    <th key={key} className="px-4 py-2 font-medium">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((row, index) => (
                  <tr key={String(row.id || index)} className="border-b last:border-0">
                    {Object.keys(rows[0]).slice(0, 6).map((key) => (
                      <td key={key} className="px-4 py-2">
                        {String(row[key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FinancePaymentApprovalsPage() {
  return (
    <FinanceList
      title="Payment approvals"
      description="Payment proposals awaiting approval."
      resource="paymentProposals"
      permission={P.payment}
      filterValues={{ status: "pending_approval" }}
      exportColumns={["proposalNumber", "status", "totalAmount", "proposedDate"]}
      columns={[
        { key: "proposalNumber", header: "Proposal #" },
        { key: "status", header: "Status" },
        { key: "totalAmount", header: "Amount" },
        { key: "proposedDate", header: "Date", hideOnMobile: true },
      ]}
      rowHref={(row) => `/finance/payments/${row.id}`}
    />
  );
}

export function FinanceAuditPage() {
  return (
    <FinanceList
      title="Finance audit trail"
      description="Posted journal register for finance investigations. Full immutable audit lives in the enterprise audit module."
      resource="journals"
      permission={P.journals}
      exportColumns={["journalNumber", "journalDate", "postedAt", "postedBy", "status"]}
      columns={[
        { key: "journalNumber", header: "JE #" },
        { key: "journalDate", header: "Date" },
        { key: "postedAt", header: "Posted at", hideOnMobile: true },
        { key: "postedBy", header: "Posted by", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/finance/journals/${row.id}`}
    />
  );
}

function DetailShell({
  permission,
  resource,
  id,
  titleKey,
  statusOptions,
  actions,
  children,
}: {
  permission: Permission;
  resource: string;
  id: string;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: Parameters<typeof FinanceWorkflowActions>[0]["actions"];
  children?: (ctx: { record: Row; extra: Record<string, unknown>; reload: () => void }) => ReactNode;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    void getFinance(resource, id)
      .then((result) => {
        setRecord(result.record as Row);
        setExtra(result.extra || {});
        setError(null);
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Unable to load record" description={error || "Not found."} />;
  }

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader
          title={String(record[titleKey] || record.id)}
          description={`${resource} detail with audited workflow actions.`}
        />
        <FinanceWorkflowActions
          resource={resource}
          id={id}
          status={String(record.status || "")}
          statusOptions={statusOptions}
          actions={actions}
          onChanged={load}
        />
        {children?.({ record, extra, reload: load })}
      </div>
    </RequirePermission>
  );
}

const journalActions = [
  COMMON_FINANCE_ACTIONS.submit,
  COMMON_FINANCE_ACTIONS.approve,
  COMMON_FINANCE_ACTIONS.reject,
  COMMON_FINANCE_ACTIONS.post,
  COMMON_FINANCE_ACTIONS.reverse,
];

const apInvoiceActions = [
  COMMON_FINANCE_ACTIONS.submit,
  COMMON_FINANCE_ACTIONS.match,
  COMMON_FINANCE_ACTIONS.approve,
  COMMON_FINANCE_ACTIONS.hold,
  COMMON_FINANCE_ACTIONS.reject,
  COMMON_FINANCE_ACTIONS.post,
];

const arInvoiceActions = [
  COMMON_FINANCE_ACTIONS.submit,
  COMMON_FINANCE_ACTIONS.approve,
  COMMON_FINANCE_ACTIONS.reject,
  COMMON_FINANCE_ACTIONS.post,
];

const paymentProposalActions = [COMMON_FINANCE_ACTIONS.approve, COMMON_FINANCE_ACTIONS.reject];

const paymentActions = [
  COMMON_FINANCE_ACTIONS.submit_manual,
  COMMON_FINANCE_ACTIONS.confirm,
  COMMON_FINANCE_ACTIONS.post,
];

const periodActions = [COMMON_FINANCE_ACTIONS.close, COMMON_FINANCE_ACTIONS.reopen];

export function AccountDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.accounts}
      resource="accounts"
      id={id}
      titleKey="accountCode"
      statusOptions={accountStatusOptions}
      actions={[COMMON_FINANCE_ACTIONS.deactivate]}
    >
      {({ record }) => (
        <RecordSections
          record={record}
          fields={["accountCode", "name", "accountType", "category", "normalBalance", "currency", "allowPosting"]}
        />
      )}
    </DetailShell>
  );
}

export function JournalDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.journals}
      resource="journals"
      id={id}
      titleKey="journalNumber"
      statusOptions={journalStatusOptions}
      actions={journalActions}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["journalDate", "description", "currency", "totalDebit", "totalCredit", "periodId"]}
          items={(extra.lines as Row[]) || []}
          itemColumns={["accountId", "description", "debit", "credit", "costCenterId"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function SupplierInvoiceDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.ap}
      resource="supplierInvoices"
      id={id}
      titleKey="invoiceNumber"
      statusOptions={supplierInvoiceStatusOptions}
      actions={apInvoiceActions}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["vendorId", "invoiceDate", "dueDate", "purchaseOrderId", "matchStatus", "subtotal", "tax", "grandTotal"]}
          items={(extra.items as Row[]) || []}
          itemColumns={["description", "quantity", "unitPrice", "taxCodeId", "lineTotal"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function PaymentProposalDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.payment}
      resource="paymentProposals"
      id={id}
      titleKey="proposalNumber"
      statusOptions={paymentStatusOptions}
      actions={paymentProposalActions}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["proposedDate", "currency", "totalAmount", "bankAccountId"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function PaymentDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.payment}
      resource="payments"
      id={id}
      titleKey="paymentNumber"
      statusOptions={paymentStatusOptions}
      actions={paymentActions}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["beneficiaryName", "amount", "currency", "valueDate", "bankAccountId", "reference"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function CustomerInvoiceDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.ar}
      resource="customerInvoices"
      id={id}
      titleKey="invoiceNumber"
      statusOptions={customerInvoiceStatusOptions}
      actions={arInvoiceActions}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["customerId", "invoiceDate", "dueDate", "salesOrderId", "subtotal", "tax", "grandTotal"]}
          items={(extra.items as Row[]) || []}
          itemColumns={["description", "quantity", "unitPrice", "taxCodeId", "lineTotal"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function CreditNoteDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.ar}
      resource="creditNotes"
      id={id}
      titleKey="creditNoteNumber"
      statusOptions={creditNoteStatusOptions}
      actions={[COMMON_FINANCE_ACTIONS.submit, COMMON_FINANCE_ACTIONS.approve, COMMON_FINANCE_ACTIONS.post]}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["customerId", "customerInvoiceId", "amount", "reason"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function DebitNoteDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.ap}
      resource="debitNotes"
      id={id}
      titleKey="debitNoteNumber"
      statusOptions={creditNoteStatusOptions}
      actions={[COMMON_FINANCE_ACTIONS.submit, COMMON_FINANCE_ACTIONS.approve, COMMON_FINANCE_ACTIONS.post]}
    >
      {({ record }) => <RecordSections record={record} fields={["vendorId", "supplierInvoiceId", "amount", "reason"]} />}
    </DetailShell>
  );
}

export function BankAccountDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.bank} resource="bankAccounts" id={id} titleKey="accountName" statusOptions={accountStatusOptions} actions={[]}>
      {({ record }) => (
        <RecordSections record={record} fields={["bankName", "currency", "accountReference", "glAccountId", "status"]} />
      )}
    </DetailShell>
  );
}

export function BankReconciliationDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.bank}
      resource="bankReconciliations"
      id={id}
      titleKey="reconciliationNumber"
      statusOptions={bankReconStatusOptions}
      actions={[
        financeAction("transition", "Advance to matching", "finance:update" as Permission, {
          requireReason: false,
          payload: { toStatus: "matching" },
        }),
        financeAction("transition", "Submit for approval", "finance:submit" as Permission, {
          requireReason: false,
          payload: { toStatus: "pending_approval" },
        }),
        COMMON_FINANCE_ACTIONS.approve,
      ]}
    >
      {({ record }) => (
        <RecordSections
          record={record}
          fields={["bankAccountId", "statementBalance", "bookBalance", "variance", "periodEnd"]}
        />
      )}
    </DetailShell>
  );
}

export function TaxCodeDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.tax} resource="taxCodes" id={id} titleKey="code" statusOptions={accountStatusOptions} actions={[]}>
      {({ record }) => <RecordSections record={record} fields={["name", "ratePercent", "accountId", "status"]} />}
    </DetailShell>
  );
}

export function CostCenterDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.finance} resource="costCenters" id={id} titleKey="code" statusOptions={accountStatusOptions} actions={[]}>
      {({ record }) => <RecordSections record={record} fields={["name", "department", "status"]} />}
    </DetailShell>
  );
}

export function BudgetDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.budget}
      resource="budgets"
      id={id}
      titleKey="budgetNumber"
      statusOptions={budgetStatusOptions}
      actions={[COMMON_FINANCE_ACTIONS.submit, COMMON_FINANCE_ACTIONS.approve, COMMON_FINANCE_ACTIONS.reject]}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["name", "fiscalYear", "totalAmount", "currency"]}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function FixedAssetDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.finance} resource="fixedAssets" id={id} titleKey="assetNumber" statusOptions={assetStatusOptions} actions={[]}>
      {({ record }) => (
        <RecordSections
          record={record}
          fields={["name", "acquisitionDate", "acquisitionCost", "usefulLifeMonths", "depreciationMethod", "status"]}
        />
      )}
    </DetailShell>
  );
}

export function ExpenseClaimDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.finance}
      resource="expenseClaims"
      id={id}
      titleKey="claimNumber"
      statusOptions={expenseStatusOptions}
      actions={[COMMON_FINANCE_ACTIONS.submit, COMMON_FINANCE_ACTIONS.approve, COMMON_FINANCE_ACTIONS.reject]}
    >
      {({ record, extra }) => (
        <RecordSections record={record} fields={["employeeId", "claimDate", "totalAmount", "purpose"]} approvals={(extra.approvals as Row[]) || []} />
      )}
    </DetailShell>
  );
}

export function PeriodDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.period} resource="periods" id={id} titleKey="name" statusOptions={periodStatusOptions} actions={periodActions}>
      {({ record }) => <RecordSections record={record} fields={["startDate", "endDate", "fiscalYear", "status"]} />}
    </DetailShell>
  );
}

function RecordSections({
  record,
  fields,
  items = [],
  approvals = [],
  itemColumns = ["accountId", "description", "debit", "credit"],
}: {
  record: Row;
  fields: string[];
  items?: Row[];
  approvals?: Row[];
  itemColumns?: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
            <p className="mt-1 text-sm font-medium break-all">{formatValue(record[field])}</p>
          </div>
        ))}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">status</p>
          <div className="mt-1">
            <StatusBadge label={labelFor(ALL_STATUS_OPTIONS, String(record.status || ""))} tone={workflowTone(String(record.status || ""))} />
          </div>
        </div>
      </div>
      {items.length ? (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-3 text-sm font-medium">Line items</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {itemColumns.map((column) => (
                    <th key={column} className="px-4 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id || String(item.lineId)} className="border-b last:border-0">
                    {itemColumns.map((column) => (
                      <td key={column} className="px-4 py-2">
                        {formatValue(item[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {approvals.length ? <HistoryPanel title="Approvals" rows={approvals} /> : null}
    </div>
  );
}

function HistoryPanel({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg bg-muted/40 px-3 py-2">
            {formatValue(row.label || row.toStatus || row.status)} · {formatValue(row.comment || row.reason || "")} ·{" "}
            {formatValue(row.updatedAt || row.performedAt || row.timestamp)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

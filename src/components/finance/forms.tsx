"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFinance } from "@/lib/finance/client";
import { accountTypeOptions } from "@/lib/finance/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormShell({
  permission,
  title,
  description,
  onSubmit,
  children,
}: {
  permission: Permission;
  title: string;
  description: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description={description} />
        <form
          className="max-w-3xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void onSubmit()
              .catch((error) => toast.error("Unable to save", publicMasterError(error)))
              .finally(() => setBusy(false));
          }}
        >
          {children}
          <Button type="submit" className="min-h-11" disabled={busy}>
            Save
          </Button>
        </form>
      </div>
    </RequirePermission>
  );
}

const emptyJournalLine = { accountId: "", description: "", debit: "", credit: "", costCenterId: "" };
const emptyInvoiceLine = { description: "", quantity: "1", unitPrice: "0", taxCodeId: "" };

export function AccountForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    accountCode: "",
    name: "",
    accountType: "expense",
    category: "other",
    normalBalance: "debit",
    currency: "INR",
  });
  return (
    <FormShell
      permission={"financeAccounts:create" as Permission}
      title="New GL account"
      description="Create a chart of accounts entry."
      onSubmit={async () => {
        const result = await createFinance("accounts", form);
        toast.success("Account created");
        router.push(`/finance/accounts/${result.id}`);
      }}
    >
      <Field label="Account code">
        <Input className="min-h-11" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} required />
      </Field>
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Type">
        <Select value={form.accountType} onValueChange={(value) => setForm({ ...form, accountType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accountTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Normal balance">
        <Select value={form.normalBalance} onValueChange={(value) => setForm({ ...form, normalBalance: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FormShell>
  );
}

export function JournalForm() {
  const router = useRouter();
  const [form, setForm] = useState({ journalDate: "", description: "", currency: "INR", periodId: "" });
  const [lines, setLines] = useState([{ ...emptyJournalLine }, { ...emptyJournalLine }]);
  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.0001 && debit > 0 };
  }, [lines]);

  return (
    <FormShell
      permission={"financeJournal:create" as Permission}
      title="New journal entry"
      description="Debit and credit lines must balance before submit."
      onSubmit={async () => {
        if (!totals.balanced) {
          toast.error("Journal is not balanced");
          throw new Error("Unbalanced journal");
        }
        const result = await createFinance("journals", {
          ...form,
          lines: lines.map((line) => ({
            ...line,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
          })),
        });
        toast.success("Journal created");
        router.push(`/finance/journals/${result.id}`);
      }}
    >
      <Field label="Journal date">
        <Input className="min-h-11" type="date" value={form.journalDate} onChange={(e) => setForm({ ...form, journalDate: e.target.value })} required />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Period ID">
        <Input className="min-h-11" value={form.periodId} onChange={(e) => setForm({ ...form, periodId: e.target.value })} />
      </Field>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
          <Field label={`Account ${index + 1}`}>
            <Input
              className="min-h-11"
              value={line.accountId}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, accountId: e.target.value };
                setLines(next);
              }}
            />
          </Field>
          <Field label="Description">
            <Input
              className="min-h-11"
              value={line.description}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, description: e.target.value };
                setLines(next);
              }}
            />
          </Field>
          <Field label="Debit">
            <Input
              className="min-h-11"
              type="number"
              value={line.debit}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, debit: e.target.value, credit: e.target.value ? "0" : line.credit };
                setLines(next);
              }}
            />
          </Field>
          <Field label="Credit">
            <Input
              className="min-h-11"
              type="number"
              value={line.credit}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, credit: e.target.value, debit: e.target.value ? "0" : line.debit };
                setLines(next);
              }}
            />
          </Field>
        </div>
      ))}
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setLines([...lines, { ...emptyJournalLine }])}>
        Add line
      </Button>
      <p className={`text-sm ${totals.balanced ? "text-emerald-700" : "text-destructive"}`}>
        Debit {totals.debit.toFixed(2)} · Credit {totals.credit.toFixed(2)} {totals.balanced ? "· Balanced" : "· Out of balance"}
      </p>
    </FormShell>
  );
}

function InvoiceLinesEditor({
  lines,
  setLines,
}: {
  lines: Array<typeof emptyInvoiceLine>;
  setLines: (lines: Array<typeof emptyInvoiceLine>) => void;
}) {
  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
          <Field label="Description">
            <Input
              className="min-h-11"
              value={line.description}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, description: e.target.value };
                setLines(next);
              }}
            />
          </Field>
          <Field label="Quantity">
            <Input
              className="min-h-11"
              type="number"
              value={line.quantity}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, quantity: e.target.value };
                setLines(next);
              }}
            />
          </Field>
          <Field label="Unit price">
            <Input
              className="min-h-11"
              type="number"
              value={line.unitPrice}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, unitPrice: e.target.value };
                setLines(next);
              }}
            />
          </Field>
          <Field label="Tax code ID">
            <Input
              className="min-h-11"
              value={line.taxCodeId}
              onChange={(e) => {
                const next = [...lines];
                next[index] = { ...line, taxCodeId: e.target.value };
                setLines(next);
              }}
            />
          </Field>
        </div>
      ))}
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setLines([...lines, { ...emptyInvoiceLine }])}>
        Add line
      </Button>
    </div>
  );
}

export function SupplierInvoiceForm() {
  const router = useRouter();
  const [form, setForm] = useState({ vendorId: "", invoiceNumber: "", invoiceDate: "", dueDate: "", purchaseOrderId: "" });
  const [lines, setLines] = useState([{ ...emptyInvoiceLine }]);
  return (
    <FormShell
      permission={"financeAp:create" as Permission}
      title="New supplier invoice"
      description="Capture vendor invoice for matching and posting."
      onSubmit={async () => {
        const result = await createFinance("supplierInvoices", {
          ...form,
          items: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
        });
        toast.success("Supplier invoice created");
        router.push(`/finance/supplier-invoices/${result.id}`);
      }}
    >
      <Field label="Vendor ID">
        <Input className="min-h-11" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} required />
      </Field>
      <Field label="Invoice number">
        <Input className="min-h-11" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} required />
      </Field>
      <Field label="Invoice date">
        <Input className="min-h-11" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
      </Field>
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </Field>
      <InvoiceLinesEditor lines={lines} setLines={setLines} />
    </FormShell>
  );
}

export function CustomerInvoiceForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerId: "", invoiceDate: "", dueDate: "", salesOrderId: "" });
  const [lines, setLines] = useState([{ ...emptyInvoiceLine }]);
  return (
    <FormShell
      permission={"financeAr:create" as Permission}
      title="New customer invoice"
      description="Bill a customer from sales or manual AR."
      onSubmit={async () => {
        const result = await createFinance("customerInvoices", {
          ...form,
          items: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
        });
        toast.success("Customer invoice created");
        router.push(`/finance/customer-invoices/${result.id}`);
      }}
    >
      <Field label="Customer ID">
        <Input className="min-h-11" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
      </Field>
      <Field label="Invoice date">
        <Input className="min-h-11" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
      </Field>
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </Field>
      <InvoiceLinesEditor lines={lines} setLines={setLines} />
    </FormShell>
  );
}

export function PaymentProposalForm() {
  const router = useRouter();
  const [form, setForm] = useState({ proposedDate: "", bankAccountId: "", currency: "INR", totalAmount: "" });
  return (
    <FormShell
      permission={"financePayment:create" as Permission}
      title="New payment proposal"
      description="Propose supplier payments for approval."
      onSubmit={async () => {
        const result = await createFinance("paymentProposals", { ...form, totalAmount: Number(form.totalAmount) });
        toast.success("Payment proposal created");
        router.push(`/finance/payments/${result.id}`);
      }}
    >
      <Field label="Proposed date">
        <Input className="min-h-11" type="date" value={form.proposedDate} onChange={(e) => setForm({ ...form, proposedDate: e.target.value })} />
      </Field>
      <Field label="Bank account ID">
        <Input className="min-h-11" value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })} />
      </Field>
      <Field label="Total amount">
        <Input className="min-h-11" type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function TaxCodeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", ratePercent: "18", accountId: "" });
  return (
    <FormShell
      permission={"financeTax:create" as Permission}
      title="New tax code"
      description="Configure a tax rate for AP/AR lines."
      onSubmit={async () => {
        const result = await createFinance("taxCodes", { ...form, ratePercent: Number(form.ratePercent) });
        toast.success("Tax code created");
        router.push(`/finance/tax/${result.id}`);
      }}
    >
      <Field label="Code">
        <Input className="min-h-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </Field>
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Rate %">
        <Input className="min-h-11" type="number" value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function CostCenterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", department: "" });
  return (
    <FormShell
      permission="finance:update"
      title="New cost center"
      description="Dimension for manufacturing and admin allocation."
      onSubmit={async () => {
        const result = await createFinance("costCenters", form);
        toast.success("Cost center created");
        router.push(`/finance/cost-centers/${result.id}`);
      }}
    >
      <Field label="Code">
        <Input className="min-h-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </Field>
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function BudgetForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", fiscalYear: "", currency: "INR", totalAmount: "" });
  return (
    <FormShell
      permission={"financeBudget:create" as Permission}
      title="New budget"
      description="Create a budget header for approval."
      onSubmit={async () => {
        const result = await createFinance("budgets", { ...form, totalAmount: Number(form.totalAmount) });
        toast.success("Budget created");
        router.push(`/finance/budgets/${result.id}`);
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Fiscal year">
        <Input className="min-h-11" value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} />
      </Field>
      <Field label="Total amount">
        <Input className="min-h-11" type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function BankAccountForm() {
  const router = useRouter();
  const [form, setForm] = useState({ accountName: "", bankName: "", currency: "INR", accountReference: "", glAccountId: "" });
  return (
    <FormShell
      permission={"financeBank:create" as Permission}
      title="New bank account"
      description="Register an operating bank account."
      onSubmit={async () => {
        const result = await createFinance("bankAccounts", form);
        toast.success("Bank account created");
        router.push(`/finance/bank-accounts/${result.id}`);
      }}
    >
      <Field label="Account name">
        <Input className="min-h-11" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} required />
      </Field>
      <Field label="Bank name">
        <Input className="min-h-11" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
      </Field>
      <Field label="Account reference">
        <Input className="min-h-11" value={form.accountReference} onChange={(e) => setForm({ ...form, accountReference: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function PeriodForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", fiscalYear: "" });
  return (
    <FormShell
      permission={"financePeriod:create" as Permission}
      title="New financial period"
      description="Open an accounting period for posting."
      onSubmit={async () => {
        const result = await createFinance("periods", form);
        toast.success("Period created");
        router.push(`/finance/periods/${result.id}`);
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Start date">
        <Input className="min-h-11" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      </Field>
      <Field label="End date">
        <Input className="min-h-11" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function ExpenseClaimForm() {
  const router = useRouter();
  const [form, setForm] = useState({ employeeId: "", claimDate: "", purpose: "", totalAmount: "" });
  return (
    <FormShell
      permission="finance:create"
      title="New expense claim"
      description="Submit employee expenses for approval."
      onSubmit={async () => {
        const result = await createFinance("expenseClaims", { ...form, totalAmount: Number(form.totalAmount) });
        toast.success("Expense claim created");
        router.push(`/finance/expenses/${result.id}`);
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Claim date">
        <Input className="min-h-11" type="date" value={form.claimDate} onChange={(e) => setForm({ ...form, claimDate: e.target.value })} />
      </Field>
      <Field label="Amount">
        <Input className="min-h-11" type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
      </Field>
      <Field label="Purpose">
        <Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function FixedAssetForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    acquisitionDate: "",
    acquisitionCost: "",
    usefulLifeMonths: "60",
    depreciationMethod: "straight_line",
  });
  return (
    <FormShell
      permission="finance:create"
      title="New fixed asset"
      description="Capitalize equipment or facility assets."
      onSubmit={async () => {
        const result = await createFinance("fixedAssets", {
          ...form,
          acquisitionCost: Number(form.acquisitionCost),
          usefulLifeMonths: Number(form.usefulLifeMonths),
        });
        toast.success("Fixed asset created");
        router.push(`/finance/fixed-assets/${result.id}`);
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Acquisition date">
        <Input className="min-h-11" type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
      </Field>
      <Field label="Acquisition cost">
        <Input className="min-h-11" type="number" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function CreditNoteForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerId: "", customerInvoiceId: "", amount: "", reason: "" });
  return (
    <FormShell
      permission={"financeAr:create" as Permission}
      title="New credit note"
      description="Issue a customer credit against AR."
      onSubmit={async () => {
        const result = await createFinance("creditNotes", { ...form, amount: Number(form.amount) });
        toast.success("Credit note created");
        router.push(`/finance/credit-notes/${result.id}`);
      }}
    >
      <Field label="Customer ID">
        <Input className="min-h-11" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
      </Field>
      <Field label="Amount">
        <Input className="min-h-11" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </Field>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function DebitNoteForm() {
  const router = useRouter();
  const [form, setForm] = useState({ vendorId: "", supplierInvoiceId: "", amount: "", reason: "" });
  return (
    <FormShell
      permission={"financeAp:create" as Permission}
      title="New debit note"
      description="Issue a supplier debit adjustment."
      onSubmit={async () => {
        const result = await createFinance("debitNotes", { ...form, amount: Number(form.amount) });
        toast.success("Debit note created");
        router.push(`/finance/debit-notes/${result.id}`);
      }}
    >
      <Field label="Vendor ID">
        <Input className="min-h-11" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} required />
      </Field>
      <Field label="Amount">
        <Input className="min-h-11" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </Field>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
    </FormShell>
  );
}

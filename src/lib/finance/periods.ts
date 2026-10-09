import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import { fail, text } from "@/lib/finance/helpers";

export async function resolvePeriodForDate(date: string, idToken: string) {
  const periods = await queryMasterDocuments(FINANCE_COLLECTIONS.periods, idToken, { limit: 100 });
  const match = periods.find((row) => {
    const start = text(row.startDate);
    const end = text(row.endDate);
    return start && end && date >= start && date <= end;
  });
  if (match) return match;
  const years = await queryMasterDocuments("financialYears", idToken, { limit: 20 });
  const year = years.find((row) => {
    const start = text(row.startDate);
    const end = text(row.endDate);
    return start && end && date >= start && date <= end;
  });
  return year
    ? {
        id: `fy:${year.id}`,
        financialYearId: String(year.id),
        name: text(year.name),
        startDate: text(year.startDate),
        endDate: text(year.endDate),
        status: text(year.status) === "closed" ? "closed" : "open",
      }
    : null;
}

export async function validateAccountingPeriod(options: {
  periodId?: string;
  postingDate: string;
  idToken: string;
  allowClosed?: boolean;
}) {
  const period = options.periodId
    ? await readMasterDocument(FINANCE_COLLECTIONS.periods, options.periodId, options.idToken)
    : await resolvePeriodForDate(options.postingDate, options.idToken);
  if (!period) {
    fail("No open financial period covers the posting date. Configure finance periods or financial years.");
  }
  const status = text(period.status);
  if (!options.allowClosed && ["closed", "closing"].includes(status)) {
    fail(`Cannot post to financial period "${text(period.name)}" because it is ${status}.`);
  }
  const start = text(period.startDate);
  const end = text(period.endDate);
  if (start && end && (options.postingDate < start || options.postingDate > end)) {
    fail("Posting date is outside the selected financial period.");
  }
  return period;
}

export function periodClosingChecklist(options: {
  openJournals: number;
  unreconciledStatements: number;
  unapprovedInvoices: number;
  pendingPayments: number;
}) {
  return [
    {
      id: "journals",
      label: "Pending journal review",
      ok: options.openJournals === 0,
      detail: `${options.openJournals} unposted/submitted journals`,
    },
    {
      id: "bank",
      label: "Unreconciled bank statements",
      ok: options.unreconciledStatements === 0,
      detail: `${options.unreconciledStatements} open reconciliations`,
    },
    {
      id: "invoices",
      label: "Outstanding invoice review",
      ok: options.unapprovedInvoices === 0,
      detail: `${options.unapprovedInvoices} invoices awaiting approval/posting`,
    },
    {
      id: "payments",
      label: "Pending payment confirmations",
      ok: options.pendingPayments === 0,
      detail: `${options.pendingPayments} payments awaiting confirmation`,
    },
  ];
}

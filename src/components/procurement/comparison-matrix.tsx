"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { SelectionReasonField } from "@/components/procurement/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProcurement, getQuotationComparison, listProcurement } from "@/lib/procurement/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Quotation = Record<string, unknown> & { id: string };

export function ComparisonMatrix({ rfqId }: { rfqId?: string }) {
  return (
    <RequirePermission permission="quotation:read">
      <ComparisonInner initialRfqId={rfqId || ""} />
    </RequirePermission>
  );
}

function ComparisonInner({ initialRfqId }: { initialRfqId: string }) {
  const [rfqId, setRfqId] = useState(initialRfqId);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState("");

  function load(id: string) {
    if (!id) return;
    void getQuotationComparison(id)
      .then((response) => setResult(response.result))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (initialRfqId) load(initialRfqId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialRfqId]);

  const quotations = ((result?.quotations as Quotation[]) || []).filter((row) => row.status !== "cancelled");
  const highlights = (result?.highlights || {}) as Record<string, string>;
  const vendors = (result?.vendors as Array<Record<string, unknown>>) || [];

  async function selectVendor() {
    if (!reason || !selected) {
      toast.error("Select a vendor and provide a reason");
      return;
    }
    try {
      await createProcurement("selections", {
        rfqId,
        quotationId: selected,
        selectionReason: reason,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Vendor selection submitted for approval");
    } catch (err) {
      toast.error("Unable to select vendor", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Quotation comparison"
        description="Highlights lowest price and shortest lead time. The system never auto-selects a vendor."
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input className="min-h-11 md:max-w-sm" placeholder="RFQ ID" value={rfqId} onChange={(event) => setRfqId(event.target.value)} />
        <Button className="min-h-11" onClick={() => load(rfqId)}>Compare</Button>
      </div>
      {!result && !error ? (initialRfqId ? <LoadingState /> : <RfqPicker onPick={(id) => { setRfqId(id); load(id); }} />) : null}
      {error ? <EmptyState title="Unable to compare" description={error} /> : null}
      {quotations.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 text-left">Metric</th>
                {quotations.map((quote) => (
                  <th key={quote.id} className="p-3 text-left">
                    <div className="font-medium">{String(quote.quotationNumber || quote.id)}</div>
                    <div className="text-xs text-muted-foreground">{String(quote.vendorId)}</div>
                    {highlights.lowestPrice === quote.id ? <StatusBadge label="Lowest price" tone="success" /> : null}
                    {highlights.shortestLead === quote.id ? <StatusBadge label="Shortest lead" tone="info" /> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Unit / total", "grandTotal"],
                ["Lead time", "leadTime"],
                ["Payment terms", "paymentTerms"],
                ["Delivery terms", "deliveryTerms"],
                ["Valid until", "validUntil"],
                ["Status", "status"],
              ].map(([label, key]) => (
                <tr key={key} className="border-b">
                  <td className="p-3 font-medium">{label}</td>
                  {quotations.map((quote) => (
                    <td key={quote.id} className="p-3">
                      {quote[key] === undefined ? "—" : String(quote[key])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b">
                <td className="p-3 font-medium">Qualification / risk</td>
                {quotations.map((quote) => {
                  const invited = vendors.find((row) => String(row.vendorId) === String(quote.vendorId));
                  const vendor = (invited?.vendor || {}) as Record<string, unknown>;
                  return (
                    <td key={quote.id} className="p-3">
                      {String(vendor.qualificationStatus || "—")} / {String(vendor.riskCategory || "—")}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ) : result ? (
        <EmptyState title="No quotations to compare" description="Record vendor quotations against the issued RFQ first." />
      ) : null}
      {quotations.length ? (
        <div className="mt-6 grid gap-3 rounded-xl border p-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Preferred quotation</label>
            <select className="min-h-11 w-full rounded-md border bg-background px-3" value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Select manually</option>
              {quotations.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {String(quote.quotationNumber)} · {String(quote.vendorId)}
                </option>
              ))}
            </select>
          </div>
          <SelectionReasonField value={reason} onChange={setReason} />
          <Button className="min-h-11 md:col-span-2" onClick={() => void selectVendor()}>
            Submit vendor selection
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RfqPicker({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listProcurement("rfqs", { pageSize: 20 }).then((result) => setRows(result.rows)).catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!rows.length) return <EmptyState title="Select an RFQ" description="Enter an RFQ ID or open comparison from an RFQ." />;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <button key={row.id} className="rounded-lg border p-3 text-left text-sm" onClick={() => onPick(row.id)}>
          {String(row.rfqNumber || row.id)} · {String(row.status)}
        </button>
      ))}
    </div>
  );
}

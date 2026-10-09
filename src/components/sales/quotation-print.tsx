"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getSales } from "@/lib/sales/client";
import { publicMasterError } from "@/lib/masters/errors";

export function QuotationPrint({ id }: { id: string }) {
  return (
    <RequirePermission permission="salesQuotation:print">
      <Inner id={id} />
    </RequirePermission>
  );
}

function Inner({ id }: { id: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getSales("quotations", id)
        .then((result) => {
          setRecord(result.record);
          setItems(((result.extra?.items as Array<Record<string, unknown>>) || []).filter((row) => String(row.status || "") !== "superseded"));
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Unable to load quotation" description={error || "Not found."} />;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Quotation</h1>
          <p className="text-sm text-neutral-600">Print-ready commercial quotation. External send is not claimed by this view.</p>
        </div>
        <Button className="min-h-11" onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <div className="mb-8 border-b border-neutral-300 pb-4">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Quotation</p>
        <h2 className="mt-2 text-3xl font-semibold">{String(record.quotationNumber)}</h2>
        <p className="mt-2 text-sm">Customer: {String(record.customerId)}</p>
        <p className="text-sm">Date: {String(record.quotationDate)} · Valid until: {String(record.validUntil)}</p>
        <p className="text-sm">Currency: {String(record.currency)} · Version: {String(record.version || 1)}</p>
      </div>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="py-2">Product</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Unit price</th>
            <th className="py-2">Discount</th>
            <th className="py-2">Tax</th>
            <th className="py-2">Line total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={String(item.id || item.lineId)} className="border-b border-neutral-200">
              <td className="py-2">{String(item.productCode || item.productId)}</td>
              <td className="py-2">{String(item.quantity)}</td>
              <td className="py-2">{String(item.unitPrice)}</td>
              <td className="py-2">{String(item.discount)}</td>
              <td className="py-2">{String(item.tax)}</td>
              <td className="py-2">{String(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{String(record.subtotal)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>{String(record.discount)}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>{String(record.tax)}</span></div>
        <div className="flex justify-between"><span>Freight</span><span>{String(record.freight)}</span></div>
        <div className="flex justify-between border-t border-neutral-400 pt-2 font-semibold"><span>Grand total</span><span>{String(record.grandTotal)}</span></div>
      </div>
      <div className="mt-8 text-sm text-neutral-600">
        <p>Payment terms: {String(record.paymentTerms || "—")}</p>
        <p>Delivery terms: {String(record.deliveryTerms || "—")}</p>
        <p className="mt-4">Prepared by: {String(record.preparedBy || "—")}</p>
        <p>This printout does not by itself confirm external customer delivery of the quotation.</p>
      </div>
    </div>
  );
}

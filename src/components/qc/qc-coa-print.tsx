"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RequirePermission } from "@/components/auth/require-permission";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getQc } from "@/lib/qc/client";
import { listMasterRecords } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { appConfig } from "@/lib/config/app";

type Row = Record<string, unknown> & { id: string };

export function QcCoaPrint({ id }: { id: string }) {
  return (
    <RequirePermission permission="qcCoa:read">
      <PrintInner id={id} />
    </RequirePermission>
  );
}

function PrintInner({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [company, setCompany] = useState<Row | null>(null);
  const [product, setProduct] = useState<Row | null>(null);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await getQc("coas", id);
          setRecord(result.record);
          const [companies, products, customers] = await Promise.all([
            listMasterRecords("companies", { pageSize: 5 }),
            result.record.productId ? listMasterRecords("products", { pageSize: 5 }) : Promise.resolve({ rows: [] as Row[] }),
            result.record.customerId ? listMasterRecords("customers", { pageSize: 5 }) : Promise.resolve({ rows: [] as Row[] }),
          ]);
          setCompany(companies.rows[0] || null);
          setProduct(products.rows.find((row) => row.id === result.record.productId) || null);
          setCustomer(customers.rows.find((row) => row.id === result.record.customerId) || null);
        } catch (err) {
          setError(publicMasterError(err));
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="COA not found" description={error || ""} />;

  const lines = (Array.isArray(record.lines) ? record.lines : []) as Array<Record<string, unknown>>;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-slate-900 print:max-w-none print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <Button className="min-h-11" onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <header className="mb-6 border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Image
              src={appConfig.logoSrc}
              alt={`${appConfig.name} logo`}
              width={56}
              height={56}
              priority
              className="h-14 w-14 rounded-lg border bg-white object-contain p-0.5"
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Certificate of Analysis</p>
              <h1 className="text-2xl font-semibold">
                {String(company?.companyName || company?.legalName || appConfig.companyName)}
              </h1>
              <p className="text-sm text-slate-600">{String(company?.legalName || "")}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p><strong>COA</strong> {String(record.coaNumber || "—")}</p>
            <p>Version {String(record.version || 1)}</p>
            <p>{String(record.approvedAt || record.createdAt || "").slice(0, 10) || "—"}</p>
          </div>
        </div>
      </header>
      <section className="mb-6 grid gap-3 md:grid-cols-2 text-sm">
        <Field label="Customer" value={customer?.customerName || record.customerId} />
        <Field label="Product" value={product?.productName || record.productId} />
        <Field label="Product code" value={product?.productCode} />
        <Field label="Batch number" value={record.batchNumber} />
        <Field label="Manufacturing date" value={record.manufacturingDate} />
        <Field label="Expiry date" value={record.expiryDate} />
        <Field label="Sample / reference" value={record.sampleNumber} />
        <Field label="Specification" value={`${record.specificationId || "—"} v${record.specificationVersion || ""}`} />
      </section>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left">
            <th className="p-2">Parameter</th>
            <th className="p-2">Specification</th>
            <th className="p-2">Result</th>
            <th className="p-2">Unit</th>
            <th className="p-2">Method</th>
            <th className="p-2">Conclusion</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="border-b">
              <td className="p-2">{String(line.parameterName || "—")}</td>
              <td className="p-2">{String(line.specification || "—")}</td>
              <td className="p-2">{String(line.result || "—")}</td>
              <td className="p-2">{String(line.unit || "—")}</td>
              <td className="p-2">{String(line.methodId || "—")}</td>
              <td className="p-2">{String(line.outcome || "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mb-8 text-sm">
        <p className="font-semibold">Conclusion</p>
        <p>{String(record.conclusion || "—")}</p>
      </section>
      <section className="grid gap-6 md:grid-cols-2 text-sm">
        <div className="border-t pt-3">
          <p className="text-xs uppercase text-slate-500">QC approval</p>
          <p>{String((record.approvalSignature as { signedByEmail?: string } | undefined)?.signedByEmail || record.approvedBy || "—")}</p>
          <p>{String(record.approvedAt || "Pending")}</p>
        </div>
        <div className="border-t pt-3">
          <p className="text-xs uppercase text-slate-500">Document control</p>
          <p>{String(record.coaNumber || "—")} · Version {String(record.version || 1)}</p>
          <p>Status: {String(record.status || "draft")}</p>
        </div>
      </section>
      <footer className="mt-10 flex justify-between border-t pt-3 text-xs text-slate-500">
        <span>Laboratory record. QA batch release is a separate controlled process.</span>
        <span className="print:block">Page 1</span>
      </footer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p>{value ? String(value) : "—"}</p>
    </div>
  );
}

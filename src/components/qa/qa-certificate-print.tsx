"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RequirePermission } from "@/components/auth/require-permission";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getQa } from "@/lib/qa/client";
import { listMasterRecords } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { appConfig } from "@/lib/config/app";

type Row = Record<string, unknown> & { id: string };

export function QaCertificatePrint({ id }: { id: string }) {
  return (
    <RequirePermission permission="qaReleaseCertificate:read">
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
          const result = await getQa("certificates", id);
          setRecord(result.record);
          const [companies, products, customers] = await Promise.all([
            listMasterRecords("companies", { pageSize: 5 }),
            result.record.productId ? listMasterRecords("products", { pageSize: 50 }) : Promise.resolve({ rows: [] as Row[] }),
            result.record.customerId ? listMasterRecords("customers", { pageSize: 50 }) : Promise.resolve({ rows: [] as Row[] }),
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
  if (error || !record) return <EmptyState title="Release certificate not found" description={error || ""} />;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-slate-900 print:max-w-none print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <Button className="min-h-11" onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <header className="mb-6 border-b pb-4">
        <div className="mb-3 flex items-start gap-3">
          <Image
            src={appConfig.logoSrc}
            alt={`${appConfig.name} logo`}
            width={56}
            height={56}
            priority
            className="h-14 w-14 rounded-lg border bg-white object-contain p-0.5"
          />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Batch Release Certificate</p>
            <h1 className="text-2xl font-semibold">
              {String(company?.companyName || company?.legalName || appConfig.companyName)}
            </h1>
            <p className="text-sm text-slate-600">{String(company?.legalName || "")}</p>
          </div>
        </div>
        <div className="mt-3 text-sm">
          <p><strong>Certificate</strong> {String(record.certificateNumber || "—")}</p>
          <p>Version {String(record.version || 1)}</p>
        </div>
      </header>
      <section className="mb-6 grid gap-3 md:grid-cols-2 text-sm">
        <Field label="Customer" value={customer?.customerName || record.customerId} />
        <Field label="Product" value={product?.productName || record.productId} />
        <Field label="Product code" value={product?.productCode} />
        <Field label="Batch number" value={record.batchNumber} />
        <Field label="Manufacturing date" value={record.manufacturingDate} />
        <Field label="Expiry date" value={record.expiryDate} />
        <Field label="Batch quantity" value={record.batchQuantity} />
        <Field label="QA disposition" value={record.disposition} />
        <Field label="COA reference" value={record.coaNumber} />
        <Field label="QA approver" value={record.approvedBy} />
        <Field label="Release date" value={record.releaseDate} />
        <Field label="Document number" value={record.certificateNumber} />
      </section>
      <footer className="mt-10 border-t pt-3 text-xs text-slate-500">
        Values are pulled from approved source records. This document is not a GMP or 21 CFR Part 11 certification.
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

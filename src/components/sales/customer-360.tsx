"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCustomer360, listSales } from "@/lib/sales/client";
import { publicMasterError } from "@/lib/masters/errors";

export function CustomerAccountsPage() {
  return (
    <RequirePermission permission="customers:read">
      <AccountsInner />
    </RequirePermission>
  );
}

function AccountsInner() {
  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listSales("orders", { pageSize: 30 })
        .then((result) => {
          const unique = new Map<string, Record<string, unknown> & { id: string }>();
          for (const row of result.rows) {
            const id = String(row.customerId || "");
            if (id && !unique.has(id)) unique.set(id, { ...row, id });
          }
          setRows([...unique.values()]);
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function loadProfile(id: string) {
    setCustomerId(id);
    try {
      const result = await getCustomer360(id);
      setProfile(result.result);
      setError(null);
    } catch (err) {
      setError(publicMasterError(err));
      setProfile(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customer accounts"
        description="Customer 360 combining master data with quotations, orders, credit, complaints, and documents."
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/masters/customers">Open customer master</Link>
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
        <Button className="min-h-11" onClick={() => void loadProfile(customerId)}>Load 360</Button>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="rounded-xl border p-4 text-left hover:bg-muted/40"
            onClick={() => void loadProfile(String(row.customerId))}
          >
            <p className="font-medium">{String(row.customerId)}</p>
            <p className="text-sm text-muted-foreground">Recent SO {String(row.salesOrderNumber || "—")}</p>
          </button>
        ))}
      </div>
      {!profile ? (
        <EmptyState title="Select a customer" description="Load a customer ID to view the commercial 360 profile." />
      ) : (
        <Customer360View data={profile} />
      )}
    </div>
  );
}

export function Customer360Page({ id }: { id: string }) {
  return (
    <RequirePermission permission="customers:read">
      <Customer360Loader id={id} />
    </RequirePermission>
  );
}

function Customer360Loader({ id }: { id: string }) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getCustomer360(id)
        .then((result) => setProfile(result.result))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!profile && !error) return <LoadingState />;
  if (error || !profile) return <EmptyState title="Unable to load customer" description={error || "Not found."} />;
  return (
    <div>
      <PageHeader title="Customer 360" description={`Commercial profile for ${id}`} />
      <Customer360View data={profile} />
    </div>
  );
}

function Customer360View({ data }: { data: Record<string, unknown> }) {
  const customer = (data.customer || {}) as Record<string, unknown>;
  const sections: Array<[string, unknown]> = [
    ["Quotations", data.quotations],
    ["Sales orders", data.orders],
    ["Requirements", data.requirements],
    ["Dispatches", data.dispatches],
    ["Complaints", data.complaints],
    ["Returns", data.returns],
    ["Communications", data.communications],
    ["Contracts", data.contracts],
    ["Documents", data.documents],
    ["Credit reviews", data.creditReviews],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
        {["customerCode", "customerName", "customerType", "status", "salesRepresentative", "paymentTerms", "creditHold", "minShelfLifeMonths"].map(
          (field) => (
            <div key={field}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
              <p className="mt-1 text-sm font-medium">{String(customer[field] ?? "—")}</p>
            </div>
          )
        )}
      </div>
      <div className="rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">Outstanding balances</p>
        <pre className="overflow-x-auto text-xs">{JSON.stringify(data.outstandingBalances || {}, null, 2)}</pre>
      </div>
      {sections.map(([title, value]) => {
        const rows = Array.isArray(value) ? value : [];
        return (
          <div key={title} className="rounded-xl border p-4">
            <p className="mb-2 text-sm font-medium">
              {title} ({rows.length})
            </p>
            {!rows.length ? (
              <p className="text-sm text-muted-foreground">No linked records.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {rows.slice(0, 8).map((row) => (
                  <li key={String((row as { id?: string }).id || JSON.stringify(row).slice(0, 24))}>
                    {String(
                      (row as { quotationNumber?: string; salesOrderNumber?: string; requirementNumber?: string; returnNumber?: string; shipmentNumber?: string; id?: string })
                        .quotationNumber ||
                        (row as { salesOrderNumber?: string }).salesOrderNumber ||
                        (row as { requirementNumber?: string }).requirementNumber ||
                        (row as { returnNumber?: string }).returnNumber ||
                        (row as { shipmentNumber?: string }).shipmentNumber ||
                        (row as { id?: string }).id
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDmsDashboard } from "@/lib/dms/client";
import { publicMasterError } from "@/lib/masters/errors";

const LINKS: Record<string, string> = {
  controlledDocuments: "/dms/registry",
  draftsAwaitingReview: "/dms/registry",
  pendingApprovals: "/dms/approvals",
  approvedNotEffective: "/dms/registry",
  effectiveDocuments: "/dms/registry",
  supersededDocuments: "/dms/registry",
  reviewsDue: "/dms/registry",
  reviewsOverdue: "/dms/periodic-reviews",
  externalExpiring: "/dms/external",
  changesAwaitingImplementation: "/dms/change-requests",
  trainingImpact: "/dms/training",
  trainingPending: "/hr/training",
};

function label(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export function DmsDashboard() {
  return (
    <RequirePermission permission="dms:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", departmentId: "", siteId: "", documentType: "", ownerId: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getDmsDashboard(filters)
        .then((result) => {
          setStats(result.stats);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters]);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load document control" description={error || "Sign in and try again."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number | null>;
  const notes = (stats.notes || {}) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Document control"
        description="Live counts from controlled documents, change requests, external files, and LMS training links."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/dms/documents/new">New document</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/dms/change-requests/new">Change request</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Input className="min-h-11" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <Input className="min-h-11" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <Input className="min-h-11" placeholder="Site ID" value={filters.siteId} onChange={(event) => setFilters({ ...filters, siteId: event.target.value })} />
        <Input className="min-h-11" placeholder="Department ID" value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })} />
        <Input className="min-h-11" placeholder="Document type" value={filters.documentType} onChange={(event) => setFilters({ ...filters, documentType: event.target.value })} />
        <Input className="min-h-11" placeholder="Owner ID" value={filters.ownerId} onChange={(event) => setFilters({ ...filters, ownerId: event.target.value })} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(kpis).map(([key, value]) => (
          <Link key={key} href={LINKS[key] || "/dms"} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
            <p className="text-xs text-muted-foreground">{label(key)}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value == null ? "—" : Number(value).toLocaleString()}</p>
          </Link>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        {Object.entries(notes).map(([key, note]) => (
          <p key={key}>{note}</p>
        ))}
      </div>
    </div>
  );
}

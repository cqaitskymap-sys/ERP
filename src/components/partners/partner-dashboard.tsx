"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPartnerDashboard } from "@/lib/partners/client";
import { publicMasterError } from "@/lib/masters/errors";
import { EXPIRY_WINDOWS_DAYS } from "@/lib/partners/expiry";

export function PartnerDashboard() {
  return (
    <RequirePermission
      permission="customers:read"
      fallback={
        <RequirePermission permission="vendors:read">
          <DashboardInner />
        </RequirePermission>
      }
    >
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<{
    window: number;
    customers: Record<string, number>;
    vendors: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPartnerDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load partner metrics" description={error || "Try again after signing in."} />;
  }

  return (
    <div>
      <PageHeader
        title="Customer & Vendor overview"
        description={`Live counts from the latest ${stats.window} records per collection. Expiry windows: ${EXPIRY_WINDOWS_DAYS.join(", ")} days.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/masters/customers">Customers</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/masters/vendors">Vendors</Link>
            </Button>
          </>
        }
      />
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Customers</h2>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Total customers" value={stats.customers.total} />
          <Metric label="Active customers" value={stats.customers.active} />
          <Metric label="Pending qualification" value={stats.customers.pendingQualification} />
          <Metric label="Expiring qualification" value={stats.customers.expiringQualification} />
          <Metric label="High / critical risk" value={stats.customers.highRisk} />
          <Metric label="Active customer products" value={stats.customers.activeProducts} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Vendors</h2>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Total vendors" value={stats.vendors.total} />
          <Metric label="Active vendors" value={stats.vendors.active} />
          <Metric label="Pending qualification" value={stats.vendors.pendingQualification} />
          <Metric label="Expiring qualification" value={stats.vendors.expiringQualification} />
          <Metric label="High / critical risk" value={stats.vendors.highRisk} />
          <Metric label="Approved materials" value={stats.vendors.approvedMaterials} />
          <Metric label="Suspended vendors" value={stats.vendors.suspended} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listProduction } from "@/lib/production/client";
import { labelFor, scheduleStatusOptions, workflowTone } from "@/lib/production/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Row = Record<string, unknown> & { id: string };

export function ProductionSchedulePage() {
  return (
    <RequirePermission permission="productionSchedule:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listProduction("schedules", { pageSize: 50 })
        .then((result) => setRows(result.rows))
        .catch((error) => toast.error("Unable to load schedule", publicMasterError(error)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const day = String(row.plannedStartDate || "unscheduled");
      map.set(day, [...(map.get(day) || []), row]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const byCenter = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const center = String(row.workCenterId || "unassigned");
      map.set(center, [...(map.get(center) || []), row]);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Production schedule"
        description="List, calendar, timeline, and work-center views from actual schedule records."
        actions={
          <Button className="min-h-11" onClick={() => router.push("/production/schedule/new")}>
            New schedule
          </Button>
        }
      />
      <Tabs defaultValue="list">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="center">Work Center</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <DataTable
            columns={[
              { key: "scheduleNumber", header: "Schedule" },
              { key: "productId", header: "Product" },
              { key: "workCenterId", header: "Work center", hideOnMobile: true },
              { key: "plannedStartDate", header: "Start" },
              { key: "plannedEndDate", header: "End", hideOnMobile: true },
              { key: "assignedSupervisor", header: "Supervisor", hideOnMobile: true },
              { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(scheduleStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
            ]}
            data={rows}
            loading={loading}
            searchable={false}
            paginate={false}
            onRowClick={(row) => router.push(`/production/schedule/${row.id}`)}
            emptyTitle="No schedules"
          />
        </TabsContent>
        <TabsContent value="calendar">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {byDate.map(([day, items]) => (
              <div key={day} className="rounded-xl border p-4">
                <p className="mb-3 text-sm font-semibold">{day}</p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button key={item.id} className="w-full rounded-lg border p-3 text-left text-sm" onClick={() => router.push(`/production/schedule/${item.id}`)}>
                      <p className="font-medium">{String(item.productId)}</p>
                      <p className="text-muted-foreground">{String(item.workCenterId || "No work center")}</p>
                      <StatusBadge label={labelFor(scheduleStatusOptions, item.status)} tone={workflowTone(item.status)} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!byDate.length ? <p className="text-sm text-muted-foreground">No scheduled dates.</p> : null}
          </div>
        </TabsContent>
        <TabsContent value="timeline">
          <div className="space-y-3">
            {rows.map((row) => (
              <button key={row.id} className="flex w-full flex-col gap-2 rounded-xl border p-4 text-left md:flex-row md:items-center md:justify-between" onClick={() => router.push(`/production/schedule/${row.id}`)}>
                <div>
                  <p className="font-medium">{String(row.productId)}</p>
                  <p className="text-sm text-muted-foreground">{String(row.workCenterId || "Unassigned")} · {String(row.assignedSupervisor || "No supervisor")}</p>
                </div>
                <div className="min-w-0 flex-1 rounded-full bg-muted px-3 py-2 text-xs">
                  {String(row.plannedStartDate)} → {String(row.plannedEndDate)}
                </div>
                <StatusBadge label={labelFor(scheduleStatusOptions, row.status)} tone={workflowTone(row.status)} />
              </button>
            ))}
            {!rows.length ? <p className="text-sm text-muted-foreground">No timeline records.</p> : null}
          </div>
        </TabsContent>
        <TabsContent value="center">
          <div className="space-y-4">
            {byCenter.map(([center, items]) => (
              <div key={center} className="rounded-xl border p-4">
                <p className="mb-3 text-sm font-semibold">{center}</p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      <span>{String(item.productId)} · {String(item.plannedStartDate)} → {String(item.plannedEndDate)}</span>
                      <StatusBadge label={labelFor(scheduleStatusOptions, item.status)} tone={workflowTone(item.status)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!byCenter.length ? <p className="text-sm text-muted-foreground">No work-center assignments.</p> : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

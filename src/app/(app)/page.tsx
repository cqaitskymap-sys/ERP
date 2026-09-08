"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseInitSnapshot } from "@/lib/firebase/client";
import { navigation } from "@/lib/config/navigation";
import { appConfig } from "@/lib/config/app";

const readinessSeries = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 16 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 28 },
  { label: "Sat", value: 24 },
  { label: "Sun", value: 31 },
];

export default function DashboardPage() {
  const { user, profile, firebaseReady } = useAuth();
  const firebase = getFirebaseInitSnapshot();
  const modules = navigation.flatMap((section) => section.items);
  const readyCount = modules.filter((item) => item.status === "ready").length;

  return (
    <div>
      <PageHeader
        title="Command center"
        description={`${appConfig.companyName}. The shell is live. Business modules will attach to this operating picture without changing the platform architecture.`}
        actions={
          <Button asChild>
            <Link href="/foundation">
              Review foundation
              <ArrowUpRight />
            </Link>
          </Button>
        }
      />

      <div className="mb-6 rounded-2xl border bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Plant workspace
            </p>
            <h2 className="mt-2 font-heading text-2xl font-semibold">
              {user
                ? `Welcome back, ${profile?.name || user.displayName || "operator"}`
                : "Foundation is ready for manufacturing modules"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              No commercial, inventory, or batch figures are hardcoded here.
              Cards below report platform readiness only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={firebaseReady ? "Firebase connected" : "Firebase incomplete"}
              tone={firebaseReady ? "success" : "warning"}
            />
            <StatusBadge
              label={appConfig.requireAuth ? "Auth required" : "Auth optional"}
              tone="info"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Platform status"
          value={firebase.ready ? "Ready" : "Setup"}
          detail={firebase.projectId ?? "Project id missing"}
        />
        <MetricCard
          label="Reusable modules"
          value={`${readyCount}/${modules.length}`}
          detail="Shell routes available, business logic deferred"
        />
        <MetricCard
          label="Identity"
          value={user ? "Signed in" : "Guest"}
          detail={user?.email ?? "Sign in to persist audit events"}
        />
        <MetricCard
          label="Compliance posture"
          value="Designed"
          detail="RBAC, audit trail, and validation are wired"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Foundation activity</CardTitle>
            <CardDescription>
              Illustrative platform signal only. Production charts will bind to
              live module collections later.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readinessSeries}>
                <defs>
                  <linearGradient id="readiness" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  fill="url(#readiness)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service checks</CardTitle>
            <CardDescription>Initialization snapshot for this session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ServiceRow
              label="Firebase app"
              ok={firebase.ready}
              detail={firebase.projectId ?? "Missing configuration"}
            />
            <ServiceRow
              label="Authentication"
              ok={firebase.ready}
              detail="Email and password provider ready"
            />
            <ServiceRow
              label="Firestore"
              ok={firebase.ready}
              detail="Generic document services available"
            />
            <ServiceRow
              label="Storage"
              ok={firebase.ready}
              detail="Upload helpers available for later modules"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules
          .filter((item) => item.id !== "dashboard")
          .map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} className="group">
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <StatusBadge
                        label={item.status === "ready" ? "Ready" : "Planned"}
                        tone={item.status === "ready" ? "success" : "neutral"}
                      />
                    </div>
                    <CardTitle className="mt-2">{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
      </div>

      <div className="mt-6">
        <EmptyState
          icon={ShieldCheck}
          title="No operational records in this phase"
          description="Inventory, batches, deviations, and commercial documents will appear here only after their modules are implemented."
          action={
            <Button asChild variant="outline">
              <Link href="/foundation">Open reusable component lab</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

function ServiceRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
      ) : (
        <CircleDashed className="mt-0.5 size-4 text-amber-600" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

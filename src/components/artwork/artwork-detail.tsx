"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { actOnArtwork, getArtwork, type ArtworkRow } from "@/lib/artwork/client";
import {
  ARTWORK_LANES,
  artworkDecisionLabel,
  artworkDecisionTone,
  artworkStatusLabel,
  artworkStatusTone,
  laneLabel,
} from "@/lib/artwork/status";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ArtworkDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="artwork:read">
      <Inner id={id} />
    </RequirePermission>
  );
}

function Inner({ id }: { id: string }) {
  const { can } = useAuth();
  const [record, setRecord] = useState<ArtworkRow | null>(null);
  const [approvals, setApprovals] = useState<ArtworkRow[]>([]);
  const [versions, setVersions] = useState<ArtworkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    return getArtwork("requests", id).then((result) => {
      setRecord(result.record);
      setApprovals(result.extra?.approvals || []);
      setVersions(result.extra?.versions || []);
    });
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action: string) {
    setPending(true);
    try {
      await actOnArtwork(id, action, comment);
      setComment("");
      await load();
      toast.success("Artwork updated");
    } catch (err) {
      toast.error("Unable to update artwork", publicMasterError(err));
    } finally {
      setPending(false);
    }
  }

  if (!record && !error) return <LoadingState variant="page" />;
  if (error || !record) return <EmptyState title="Artwork was not found" description={error || "Open the job list and pick another record."} />;

  const preview = record.createdBy === "demo-preview";
  const status = String(record.status || "");
  const canUpdate = can("artwork:update") && !preview;
  const canApprove = can("artwork:approve") && !preview;
  const inReview = ["packaging_review", "qa_review", "regulatory_review", "customer_review"].includes(status);

  return (
    <div>
      <PageHeader
        title={String(record.artworkNumber || "Artwork")}
        description={String(record.title || "")}
        actions={<StatusBadge label={artworkStatusLabel(status)} tone={artworkStatusTone(status)} />}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-border/80 bg-card p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Customer" value={record.customerId} />
            <Fact label="Product" value={record.productId} />
            <Fact label="Component" value={record.component} />
            <Fact label="Market" value={record.market} />
            <Fact label="Version" value={record.versionLabel} />
            <Fact label="Due" value={record.dueDate} />
            <Fact label="Owner" value={record.ownerName} />
            <Fact label="Current lane" value={laneLabel(record.currentLane)} />
          </dl>
          {record.remarks ? <p className="mt-5 text-sm text-muted-foreground">{String(record.remarks)}</p> : null}
          {preview ? (
            <p className="mt-5 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Preview job for the walkthrough. Raise a new artwork to run submit, changes, and approval.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comment for the next lane" />
              <div className="flex flex-wrap gap-2">
                {canUpdate && (status === "draft" || status === "changes_requested") ? (
                  <Button className="min-h-11" disabled={pending} onClick={() => void run("submit")}>Submit</Button>
                ) : null}
                {canApprove && inReview ? (
                  <Button className="min-h-11" disabled={pending} onClick={() => void run("approve")}>Approve</Button>
                ) : null}
                {canUpdate && inReview ? (
                  <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => void run("changes")}>Request changes</Button>
                ) : null}
                {canApprove && status === "approved" ? (
                  <Button className="min-h-11" disabled={pending} onClick={() => void run("effective")}>Make effective</Button>
                ) : null}
              </div>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-border/80 bg-card p-5">
          <h2 className="font-heading text-base font-semibold">Approval lane</h2>
          <ol className="mt-4 space-y-3">
            {ARTWORK_LANES.map((lane) => {
              const step = approvals.find((row) => row.lane === lane.key);
              const decision = step?.decision || "waiting";
              return (
                <li key={lane.key} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{lane.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {step?.actorName ? String(step.actorName) : "Not signed"}
                      {step?.comment ? ` · ${String(step.comment)}` : ""}
                    </p>
                  </div>
                  <StatusBadge label={artworkDecisionLabel(decision)} tone={artworkDecisionTone(decision)} />
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <section className="mt-4 rounded-2xl border border-border/80 bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Versions</h2>
          <Button asChild variant="outline" className="min-h-9">
            <Link href="/artwork/versions">All versions</Link>
          </Button>
        </div>
        <ul className="divide-y divide-border/70">
          {versions.length ? versions.map((version) => (
            <li key={version.id} className="py-3">
              <p className="text-sm font-medium">Version {String(version.versionLabel || "")}</p>
              <p className="text-sm text-muted-foreground">{String(version.summary || "")}</p>
            </li>
          )) : <li className="py-3 text-sm text-muted-foreground">No versions recorded yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{String(value || "—")}</dd>
    </div>
  );
}

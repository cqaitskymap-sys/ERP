"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { getDms, runDmsAction } from "@/lib/dms/client";
import { dcrStatusOptions, externalStatusOptions, labelFor, workflowTone } from "@/lib/dms/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ChangeRequestDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="dmsChangeRequest:read">
      <RequestInner id={id} />
    </RequirePermission>
  );
}

function RequestInner({ id }: { id: string }) {
  const { user, can } = useAuth();
  const confirm = useConfirm();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [signatureEmail, setSignatureEmail] = useState("");
  const [changeControlId, setChangeControlId] = useState("");
  const [impactAssessment, setImpactAssessment] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const result = await getDms("changeRequests", id);
      setRecord(result.record);
      setChangeControlId(String(result.record.changeControlId || ""));
      setImpactAssessment(String(result.record.impactAssessment || ""));
      setError(null);
    } catch (err) {
      setError(publicMasterError(err));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!record && !error) return <LoadingState variant="page" />;
  if (error || !record) return <EmptyState title="Change request unavailable" description={error || "Not found."} />;
  const status = String(record.status || "");

  async function act(action: string) {
    const accepted = await confirm({
      title: action,
      description: "Linked quality change control records stay open until they are closed in Quality Assurance.",
      confirmLabel: "Continue",
    });
    if (!accepted) return;
    setBusy(true);
    try {
      await runDmsAction("changeRequests", id, action, {
        reason,
        signatureEmail: signatureEmail || user?.email || "",
        changeControlId,
        impactAssessment,
        documentId: record?.documentId,
      });
      toast.success("Change request updated");
      await load();
    } catch (err) {
      toast.error("Action failed", publicMasterError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={String(record.requestNumber || "Change request")} description={String(record.title || "")} />
      <StatusBadge label={labelFor(dcrStatusOptions, status)} tone={workflowTone(status)} />
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p>Type: {String(record.requestType)}</p>
        <p>GMP impact: {record.gmpImpact ? "Yes" : "No"}</p>
        <p>Reason: {String(record.reason || "")}</p>
        <p>Expected impact: {String(record.expectedImpact || "")}</p>
      </div>
      {record.documentId ? <Link className="text-sm underline" href={`/dms/documents/${String(record.documentId)}`}>Open document</Link> : null}
      {changeControlId ? <Link className="block text-sm underline" href={`/qa/change-control/${changeControlId}`}>Open change control</Link> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Reason for this action</Label>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div>
          <Label>Confirm account email</Label>
          <Input className="min-h-11" value={signatureEmail} placeholder={user?.email || ""} onChange={(event) => setSignatureEmail(event.target.value)} />
        </div>
      <div>
          <Label>Document ID</Label>
          <Input className="min-h-11" value={String(record.documentId || "")} onChange={(event) => setRecord({ ...record, documentId: event.target.value })} />
        </div>
        <div>
          <Label>Change control ID</Label>
          <Input className="min-h-11" value={changeControlId} onChange={(event) => setChangeControlId(event.target.value)} />
        </div>
        <div>
          <Label>Impact assessment</Label>
          <Textarea value={impactAssessment} onChange={(event) => setImpactAssessment(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "draft" && can("dmsChangeRequest:submit") ? <Button className="min-h-11" disabled={busy} onClick={() => act("submit")}>Submit</Button> : null}
        {status === "submitted" && can("dmsChangeRequest:approve") ? <Button className="min-h-11" disabled={busy} onClick={() => act("review")}>Start review</Button> : null}
        {status === "in_review" && can("dmsChangeRequest:approve") ? <Button className="min-h-11" disabled={busy} onClick={() => act("approve")}>Approve</Button> : null}
        {status === "in_review" && can("dmsChangeRequest:reject") ? <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => act("reject")}>Reject</Button> : null}
        {status === "approved" && can("dmsChangeRequest:update") ? <Button className="min-h-11" disabled={busy} onClick={() => act("implement")}>Start implementation</Button> : null}
        {status === "in_implementation" && can("dmsChangeRequest:close") ? <Button className="min-h-11" disabled={busy} onClick={() => act("close")}>Close</Button> : null}
      </div>
      <p className="text-xs text-muted-foreground">Closing this request does not close the quality change control record.</p>
    </div>
  );
}

export function ExternalDocumentDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="dmsExternal:read">
      <ExternalInner id={id} />
    </RequirePermission>
  );
}

function ExternalInner({ id }: { id: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getDms("externalDocuments", id)
        .then((result) => {
          setRecord(result.record);
          setExpiryDate(String(result.record.expiryDate || "").slice(0, 10));
          setNotes(String(result.record.notes || ""));
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!record && !error) return <LoadingState variant="page" />;
  if (!record) return <EmptyState title="External document unavailable" description={error || "Not found."} />;
  const status = String(record.status || "");

  return (
    <div className="space-y-4">
      <PageHeader title={String(record.externalNumber || "External document")} description={String(record.title || "")} />
      <StatusBadge label={labelFor(externalStatusOptions, status)} tone={workflowTone(status)} />
      <p className="text-sm">Issuer: {String(record.issuer || "—")}</p>
      <p className="text-sm">Expiry: {String(record.expiryDate || "—")}</p>
      <form
        className="max-w-lg space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void runDmsAction("externalDocuments", id, "update", {
            title: record.title,
            documentType: record.documentType,
            issuer: record.issuer,
            expiryDate,
            notes,
            confidentiality: record.confidentiality || "internal",
          })
            .then(() => toast.success("Expiry updated"))
            .catch((err) => toast.error("Unable to update", publicMasterError(err)))
            .finally(() => setBusy(false));
        }}
      >
        <Label>Expiry date</Label>
        <Input className="min-h-11" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Button className="min-h-11" disabled={busy}>Save expiry</Button>
      </form>
    </div>
  );
}

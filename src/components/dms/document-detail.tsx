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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { confirmDmsFile, getDms, prepareDmsFile, runDmsAction } from "@/lib/dms/client";
import { documentStatusOptions, labelFor, periodicDecisionOptions, workflowTone } from "@/lib/dms/catalog";
import { diffLines, diffMetadata } from "@/lib/dms/lifecycle";
import { getFileUrl, uploadFile } from "@/lib/services/storage-service";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Row = Record<string, unknown> & { id?: string };

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function DocumentDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="dmsDocument:read">
      <Inner id={id} />
    </RequirePermission>
  );
}

function Inner({ id }: { id: string }) {
  const { user, can } = useAuth();
  const confirm = useConfirm();
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [signatureEmail, setSignatureEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);
  const [decision, setDecision] = useState("no_change");
  const [employeeIds, setEmployeeIds] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await getDms("documents", id);
      setRecord(result.record);
      setExtra(result.extra || {});
      const versionRows = ((result.extra || {}).versions as Row[]) || [];
      setLeftId((current) => current || String(versionRows[0]?.id || ""));
      setRightId((current) => current || String(versionRows[1]?.id || versionRows[0]?.id || ""));
      setError(null);
    } catch (err) {
      setError(publicMasterError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <LoadingState variant="page" />;
  if (error || !record) return <EmptyState title="Document unavailable" description={error || "The document was not found."} />;

  const versions = (extra.versions as Row[]) || [];
  const reviews = (extra.reviews as Row[]) || [];
  const approvals = (extra.approvals as Row[]) || [];
  const changes = (extra.changeRequests as Row[]) || [];
  const periodic = (extra.periodicReviews as Row[]) || [];
  const training = (extra.training as Row[]) || [];
  const status = String(record.status || "");
  const editable = status === "draft" || status === "changes_requested";
  const currentVersion = versions.find((row) => row.id === record.currentVersionId) || versions[0];
  const effectiveDifferent = record.effectiveVersionId && record.effectiveVersionId !== record.currentVersionId;

  async function act(action: string, payload: Record<string, unknown> = {}) {
    const accepted = await confirm({
      title: action.replaceAll("_", " "),
      description: "This action is checked on the server and written to the audit trail.",
      confirmLabel: "Continue",
    });
    if (!accepted) return;
    setBusy(true);
    try {
      const result = await runDmsAction("documents", id, action, {
        reason,
        comment: reason,
        signatureEmail: signatureEmail || user?.email || "",
        ...payload,
      });
      if (action === "compare") setComparison(result);
      else {
        toast.success("Document updated");
        await load();
      }
    } catch (err) {
      toast.error("Action failed", publicMasterError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    if (!currentVersion?.id) return;
    setUploadMessage("Checking file…");
    setBusy(true);
    try {
      const checksumSha256 = await sha256(file);
      const prepared = await prepareDmsFile({
        documentId: id,
        versionId: currentVersion.id,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        checksumSha256,
      });
      setUploadMessage("Uploading…");
      await uploadFile(prepared.storagePath, file, { contentType: file.type });
      await confirmDmsFile({
        documentId: id,
        versionId: currentVersion.id,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        checksumSha256,
        storagePath: prepared.storagePath,
      });
      setUploadMessage("File confirmed for this version.");
      toast.success("File confirmed");
      await load();
    } catch (err) {
      setUploadMessage("");
      toast.error("Upload failed", publicMasterError(err));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(versionId: string) {
    setBusy(true);
    try {
      const access = (await runDmsAction("documents", id, "authorize_file", { versionId })) as {
        storagePath?: string;
        contentType?: string;
        previewable?: boolean;
      };
      if (!access.storagePath) throw new Error("No file path was authorized.");
      const url = await getFileUrl(access.storagePath);
      if (access.previewable) setPreviewUrl(url);
      else window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Access authorized");
    } catch (err) {
      toast.error("File access denied", publicMasterError(err));
    } finally {
      setBusy(false);
    }
  }

  const localCompare = () => {
    const left = versions.find((row) => row.id === leftId);
    const right = versions.find((row) => row.id === rightId);
    if (!left || !right) return;
    setComparison({
      metadata: diffMetadata(left, right, ["title", "status", "versionLabel", "changeSummary", "fileName", "checksumSha256"]),
      textDiff: diffLines(String(left.textExtract || ""), String(right.textExtract || "")),
      limitation: "This comparison uses stored metadata and text extracts. PDF rendering is not compared.",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(record.documentNumber || "Document")}
        description={String(record.title || "")}
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/dms/registry">Registry</Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={labelFor(documentStatusOptions, status)} tone={workflowTone(status)} />
        <span className="text-sm text-muted-foreground">Working version {String(record.currentVersionLabel || "—")}</span>
        {record.effectiveVersionLabel ? (
          <span className="text-sm font-medium">Effective version {String(record.effectiveVersionLabel)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">No effective version</span>
        )}
      </div>
      {effectiveDifferent ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          A draft or in-process revision is open. The effective copy remains version {String(record.effectiveVersionLabel)} until the new revision is released.
        </p>
      ) : null}
      <div className="grid gap-3 rounded-xl border bg-card p-4 text-sm md:grid-cols-3">
        <Fact label="Type" value={String(record.documentType || "")} />
        <Fact label="Department" value={String(record.departmentId || "—")} />
        <Fact label="Site" value={String(record.siteId || "—")} />
        <Fact label="Owner" value={String(record.ownerId || "—")} />
        <Fact label="Author" value={String(record.authorId || "—")} />
        <Fact label="Classification" value={String(record.confidentiality || "")} />
        <Fact label="Effective date" value={String(record.effectiveDate || "—")} />
        <Fact label="Next review" value={String(record.nextReviewDate || "—")} />
        <Fact label="Training" value={String(record.trainingImpactStatus || "—")} />
      </div>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Workflow</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for review, approval, release, and withdrawal" />
          </div>
          <div>
            <Label>Confirm your account email</Label>
            <Input className="min-h-11" value={signatureEmail} placeholder={user?.email || "name@company.com"} onChange={(event) => setSignatureEmail(event.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Re-entering your email confirms the signature. A button click alone is not accepted for approval or release.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && can("dmsDocument:submit") ? <Action label="Submit for review" onClick={() => act("submit")} busy={busy} /> : null}
          {status === "in_review" && can("dmsReview:review") ? <Action label="Recommend approval" onClick={() => act("recommend")} busy={busy} /> : null}
          {status === "in_review" && can("dmsReview:review") ? <Action label="Request changes" onClick={() => act("request_changes")} busy={busy} /> : null}
          {status === "in_review" && can("dmsReview:reject") ? <Action label="Reject" onClick={() => act("reject")} busy={busy} /> : null}
          {status === "in_review" && can("dmsApproval:approve") ? <Action label="Approve" onClick={() => act("approve")} busy={busy} /> : null}
          {status === "approved" && can("dmsRelease:release") ? <Action label="Release effective" onClick={() => act("release")} busy={busy} /> : null}
          {status === "effective" && can("dmsDocument:update") ? <Action label="Open revision" onClick={() => act("revise", { revisionType: "minor" })} busy={busy} /> : null}
          {(status === "approved" || status === "effective") && can("dmsDocument:cancel") ? <Action label="Withdraw" onClick={() => act("withdraw")} busy={busy} /> : null}
          {["draft", "changes_requested", "in_review", "rejected"].includes(status) && can("dmsDocument:cancel") ? (
            <Action label="Cancel" onClick={() => act("cancel")} busy={busy} />
          ) : null}
          {["superseded", "withdrawn", "cancelled", "rejected"].includes(status) && can("dmsDocument:close") ? (
            <Action label="Archive" onClick={() => act("archive")} busy={busy} />
          ) : null}
          {["archived", "rejected"].includes(status) && can("dmsDocument:reopen") ? <Action label="Restore to draft" onClick={() => act("restore")} busy={busy} /> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Controlled file</h2>
        <p className="text-sm text-muted-foreground">
          {currentVersion?.fileName ? `Current file: ${String(currentVersion.fileName)}` : "No file confirmed on the working version."}
          {uploadMessage ? ` ${uploadMessage}` : ""}
        </p>
        {editable && can("dmsDocument:update") ? (
          <Input
            className="min-h-11 max-w-md"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,application/pdf"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">This version is locked. Open a revision before uploading a replacement file.</p>
        )}
        {previewUrl ? (
          <iframe title="Document preview" src={previewUrl} className="h-96 w-full rounded-lg border" />
        ) : null}
        <p className="text-xs text-muted-foreground">Preview uses a short-lived storage token after the server authorizes the version. It is not stored on the document. It cannot prevent screenshots.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Version history</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">File</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={String(version.id)} className="border-t">
                  <td className="px-3 py-2">
                    {String(version.versionLabel)}
                    {version.id === record.effectiveVersionId ? " · effective" : ""}
                  </td>
                  <td className="px-3 py-2">{String(version.status)}</td>
                  <td className="px-3 py-2">{String(version.changeSummary || "")}</td>
                  <td className="px-3 py-2">
                    {version.storagePath ? (
                      <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => void openFile(String(version.id))}>
                        Open
                      </Button>
                    ) : (
                      "No file"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {versions.length && leftId && rightId ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={leftId} onValueChange={setLeftId}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Compare from" /></SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={`l-${String(version.id)}`} value={String(version.id)}>{String(version.versionLabel)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rightId} onValueChange={setRightId}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Compare to" /></SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={`r-${String(version.id)}`} value={String(version.id)}>{String(version.versionLabel)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className="min-h-11" variant="outline" disabled={!leftId || !rightId} onClick={localCompare}>
            Compare metadata
          </Button>
        </div>
        ) : null}
        {comparison ? <ComparisonView comparison={comparison} /> : null}
      </section>

      <RecordList title="Reviews" rows={reviews} empty="No review decisions yet." fields={["decision", "reason", "versionLabel"]} />
      <RecordList title="Approvals" rows={approvals} empty="No approvals recorded." fields={["meaning", "reason", "versionLabel"]} />
      <RecordList title="Change requests" rows={changes} empty="No document change requests." fields={["requestNumber", "status", "requestType"]} hrefPrefix="/dms/change-requests/" />
      <RecordList title="Periodic reviews" rows={periodic} empty="No periodic review has been completed." fields={["reviewNumber", "decision", "nextReviewDate"]} />

      {status === "effective" && can("dmsPeriodicReview:review") ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-medium">Periodic review</h2>
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className="min-h-11 max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periodicDecisionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className="min-h-11" disabled={busy} onClick={() => act("periodic_review", { decision, evidenceNote: reason })}>
            Complete periodic review
          </Button>
        </section>
      ) : null}

      {status === "effective" && can("training:create") ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-medium">Assign SOP training</h2>
          <p className="text-sm text-muted-foreground">
            Assignments are written to the LMS against version {String(record.effectiveVersionLabel)}. Downloading this document does not complete training.
          </p>
          <Input className="min-h-11" placeholder="Employee IDs, comma separated" value={employeeIds} onChange={(event) => setEmployeeIds(event.target.value)} />
          <Button
            type="button"
            className="min-h-11"
            disabled={busy || !employeeIds.trim()}
            onClick={() =>
              act("assign_training", {
                employeeIds: employeeIds.split(",").map((item) => item.trim()).filter(Boolean),
              })
            }
          >
            Assign retraining
          </Button>
          <Link className="block text-sm underline" href="/hr/training">Open LMS training</Link>
        </section>
      ) : null}
      <RecordList title="LMS assignments for this SOP" rows={training} empty="No LMS assignments are linked to this document for your account." fields={["employeeId", "status", "sopVersionLabel", "dueDate"]} />
      {record.changeControlId ? (
        <p className="text-sm">
          Linked change control: <Link className="underline" href={`/qa/change-control/${String(record.changeControlId)}`}>{String(record.changeControlId)}</Link>
        </p>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function Action({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onClick}>
      {label}
    </Button>
  );
}

function RecordList({
  title,
  rows,
  empty,
  fields,
  hrefPrefix,
}: {
  title: string;
  rows: Row[];
  empty: string;
  fields: string[];
  hrefPrefix?: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-medium">{title}</h2>
      {!rows.length ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      {rows.map((row) => {
        const content = fields.map((field) => `${field}: ${String(row[field] ?? "—")}`).join(" · ");
        return hrefPrefix && row.id ? (
          <Link key={String(row.id)} href={`${hrefPrefix}${row.id}`} className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
            {content}
          </Link>
        ) : (
          <p key={String(row.id || content)} className="rounded-lg border px-3 py-2 text-sm">{content}</p>
        );
      })}
    </section>
  );
}

function ComparisonView({ comparison }: { comparison: Record<string, unknown> }) {
  const metadata = (comparison.metadata as Array<{ field: string; before: unknown; after: unknown }>) || [];
  const textDiff = (comparison.textDiff as Array<{ type: string; text: string }>) || [];
  return (
    <div className="rounded-xl border p-4 text-sm">
      <p className="mb-2 text-muted-foreground">{String(comparison.limitation || "")}</p>
      {metadata.map((row) => (
        <p key={row.field}>
          <span className="font-medium">{row.field}:</span> {String(row.before ?? "")} → {String(row.after ?? "")}
        </p>
      ))}
      {!metadata.length ? <p>No metadata differences in the compared fields.</p> : null}
      {textDiff.filter((row) => row.type !== "same").slice(0, 40).map((row, index) => (
        <p key={`${row.type}-${index}`} className={row.type === "add" ? "text-emerald-700" : "text-rose-700"}>
          {row.type === "add" ? "+ " : "− "}
          {row.text}
        </p>
      ))}
    </div>
  );
}

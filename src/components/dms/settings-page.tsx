"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDms, getDms } from "@/lib/dms/client";
import { DEFAULT_DMS_SETTINGS } from "@/lib/dms/config";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function DmsSettingsPage() {
  const [form, setForm] = useState({
    segregationOfDuties: true,
    requireSignatureEmailConfirmation: true,
    reviewSoonDays: 30,
    expirySoonDays: 30,
    defaultReviewIntervalDays: 730,
    retentionYears: 10,
    requireFileBeforeRelease: true,
    requireReviewBeforeApproval: true,
    requiredApprovals: 1,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getDms("settings", "default")
        .then((result) => {
          const saved = result.record;
          setForm({
            segregationOfDuties: Boolean(saved.segregationOfDuties),
            requireSignatureEmailConfirmation: Boolean(saved.requireSignatureEmailConfirmation),
            reviewSoonDays: Number(saved.reviewSoonDays || DEFAULT_DMS_SETTINGS.reviewSoonDays),
            expirySoonDays: Number(saved.expirySoonDays || DEFAULT_DMS_SETTINGS.expirySoonDays),
            defaultReviewIntervalDays: Number(saved.defaultReviewIntervalDays || DEFAULT_DMS_SETTINGS.defaultReviewIntervalDays),
            retentionYears: Number(saved.retentionYears || DEFAULT_DMS_SETTINGS.retentionYears),
            requireFileBeforeRelease: Boolean(saved.requireFileBeforeRelease),
            requireReviewBeforeApproval: Boolean(saved.requireReviewBeforeApproval),
            requiredApprovals: Number(saved.requiredApprovals || DEFAULT_DMS_SETTINGS.requiredApprovals),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle(key: keyof typeof form) {
    setForm((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <RequirePermission permission="dmsNumbering:update">
      <div>
        <PageHeader
          title="Document control settings"
          description="These controls configure the workflow. They do not certify 21 CFR Part 11 compliance."
        />
        <form
          className="max-w-xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void createDms("settings", form)
              .then(() => toast.success("Settings saved"))
              .catch((error) => toast.error("Unable to save settings", publicMasterError(error)))
              .finally(() => setBusy(false));
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.segregationOfDuties} onChange={() => toggle("segregationOfDuties")} />
            Segregation of duties (authors cannot approve or release their own documents)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireSignatureEmailConfirmation} onChange={() => toggle("requireSignatureEmailConfirmation")} />
            Require the signer to re-enter their authenticated email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireFileBeforeRelease} onChange={() => toggle("requireFileBeforeRelease")} />
            Require a confirmed file before release
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireReviewBeforeApproval} onChange={() => toggle("requireReviewBeforeApproval")} />
            Require a completed review before approval
          </label>
          <div className="space-y-1.5">
            <Label>Required approvals</Label>
            <Input className="min-h-11" type="number" min={1} max={5} value={form.requiredApprovals} onChange={(event) => setForm({ ...form, requiredApprovals: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Review due soon (days)</Label>
            <Input className="min-h-11" type="number" min={1} value={form.reviewSoonDays} onChange={(event) => setForm({ ...form, reviewSoonDays: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>External expiry reminder (days)</Label>
            <Input className="min-h-11" type="number" min={1} value={form.expirySoonDays} onChange={(event) => setForm({ ...form, expirySoonDays: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Default review interval (days)</Label>
            <Input className="min-h-11" type="number" min={30} value={form.defaultReviewIntervalDays} onChange={(event) => setForm({ ...form, defaultReviewIntervalDays: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Retention (years)</Label>
            <Input className="min-h-11" type="number" min={1} value={form.retentionYears} onChange={(event) => setForm({ ...form, retentionYears: Number(event.target.value) })} />
          </div>
          <Button className="min-h-11" disabled={busy}>
            Save settings
          </Button>
        </form>
        <div className="mt-6 max-w-xl space-y-2 text-sm text-muted-foreground">
          <p>Electronic signatures bind the authenticated session, a re-entered email, a meaning, and a server-generated reference. Password re-authentication against Firebase Auth is not wired in this phase.</p>
          <p>Watermarks and print restrictions are not implemented. A preview cannot stop screenshots or copies made outside the application.</p>
          <p>File checksums are calculated in the browser and checked when the upload is confirmed. The server does not re-download the object to recompute the hash.</p>
        </div>
      </div>
    </RequirePermission>
  );
}

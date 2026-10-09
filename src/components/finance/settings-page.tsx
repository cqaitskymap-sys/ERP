"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFinance, listFinance } from "@/lib/finance/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function FinanceSettingsPage() {
  return (
    <RequirePermission permission="finance:update">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [form, setForm] = useState({
    defaultCurrency: "INR",
    paymentApprovalThreshold: "100000",
    matchQtyTolerancePercent: "0",
    matchPriceTolerancePercent: "0",
    autoPostCustomerInvoices: "false",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listFinance("settings", { pageSize: 1 })
        .then((result) => {
          const row = result.rows[0];
          if (!row) return;
          setForm({
            defaultCurrency: String(row.defaultCurrency || "INR"),
            paymentApprovalThreshold: String(row.paymentApprovalThreshold ?? 100000),
            matchQtyTolerancePercent: String(row.matchQtyTolerancePercent ?? 0),
            matchPriceTolerancePercent: String(row.matchPriceTolerancePercent ?? 0),
            autoPostCustomerInvoices: String(row.autoPostCustomerInvoices ?? false),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    try {
      await createFinance("settings", {
        defaultCurrency: form.defaultCurrency,
        paymentApprovalThreshold: Number(form.paymentApprovalThreshold),
        matchQtyTolerancePercent: Number(form.matchQtyTolerancePercent),
        matchPriceTolerancePercent: Number(form.matchPriceTolerancePercent),
        autoPostCustomerInvoices: form.autoPostCustomerInvoices === "true",
      });
      toast.success("Finance settings saved");
    } catch (error) {
      toast.error("Unable to save settings", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="Finance settings" description="Matching tolerances, payment thresholds, and defaults." />
      <div className="mb-6 grid max-w-2xl gap-3">
        <div className="space-y-1.5">
          <Label>Default currency</Label>
          <Input className="min-h-11" value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Payment approval threshold</Label>
          <Input
            className="min-h-11"
            type="number"
            value={form.paymentApprovalThreshold}
            onChange={(e) => setForm({ ...form, paymentApprovalThreshold: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Match quantity tolerance (%)</Label>
          <Input
            className="min-h-11"
            type="number"
            value={form.matchQtyTolerancePercent}
            onChange={(e) => setForm({ ...form, matchQtyTolerancePercent: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Match price tolerance (%)</Label>
          <Input
            className="min-h-11"
            type="number"
            value={form.matchPriceTolerancePercent}
            onChange={(e) => setForm({ ...form, matchPriceTolerancePercent: e.target.value })}
          />
        </div>
      </div>
      <Button className="min-h-11" onClick={() => void save()}>
        Save settings
      </Button>
    </div>
  );
}

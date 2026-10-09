"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSales, listSales } from "@/lib/sales/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function SalesSettingsPage() {
  return (
    <RequirePermission permission="sales:update">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [form, setForm] = useState({
    discountApprovalThresholdPercent: "5",
    financeReviewOrderValue: "500000",
    creditUtilizationThresholdPercent: "90",
    defaultCurrency: "INR",
    defaultPaymentTerms: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listSales("settings", { pageSize: 1 })
        .then((result) => {
          const row = result.rows[0];
          if (!row) return;
          setForm({
            discountApprovalThresholdPercent: String(row.discountApprovalThresholdPercent ?? 5),
            financeReviewOrderValue: String(row.financeReviewOrderValue ?? 500000),
            creditUtilizationThresholdPercent: String(row.creditUtilizationThresholdPercent ?? 90),
            defaultCurrency: String(row.defaultCurrency || "INR"),
            defaultPaymentTerms: String(row.defaultPaymentTerms || ""),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    try {
      await createSales("settings", {
        discountApprovalThresholdPercent: Number(form.discountApprovalThresholdPercent),
        financeReviewOrderValue: Number(form.financeReviewOrderValue),
        creditUtilizationThresholdPercent: Number(form.creditUtilizationThresholdPercent),
        defaultCurrency: form.defaultCurrency,
        defaultPaymentTerms: form.defaultPaymentTerms,
        requireQaReviewForExport: true,
        requireRegulatoryReviewForExport: true,
      });
      toast.success("Sales settings saved");
    } catch (error) {
      toast.error("Unable to save settings", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="Sales settings" description="Configurable commercial thresholds used by approval and credit checks." />
      <div className="mb-6 grid max-w-2xl gap-3">
        <div className="space-y-1.5">
          <Label>Discount approval threshold (%)</Label>
          <Input className="min-h-11" type="number" value={form.discountApprovalThresholdPercent} onChange={(e) => setForm({ ...form, discountApprovalThresholdPercent: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Finance review order value</Label>
          <Input className="min-h-11" type="number" value={form.financeReviewOrderValue} onChange={(e) => setForm({ ...form, financeReviewOrderValue: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Credit utilization threshold (%)</Label>
          <Input className="min-h-11" type="number" value={form.creditUtilizationThresholdPercent} onChange={(e) => setForm({ ...form, creditUtilizationThresholdPercent: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Default currency</Label>
          <Input className="min-h-11" value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Default payment terms</Label>
          <Input className="min-h-11" value={form.defaultPaymentTerms} onChange={(e) => setForm({ ...form, defaultPaymentTerms: e.target.value })} />
        </div>
      </div>
      <Button className="min-h-11" onClick={() => void save()}>Save settings</Button>
    </div>
  );
}

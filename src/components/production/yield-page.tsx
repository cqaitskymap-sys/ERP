"use client";

import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { ProductionList } from "@/components/production/production-list";
import { ReconciliationForm, WastageForm, YieldForm } from "@/components/production/forms";
import { StatusBadge } from "@/components/feedback/status-badge";
import { labelFor, reconStatusOptions, workflowTone, yieldResultOptions } from "@/lib/production/catalog";

export function YieldReconciliationPage() {
  return (
    <RequirePermission permission="yield:read">
      <div>
        <PageHeader
          title="Yield & reconciliation"
          description="Actual / theoretical × 100. Unexplained material differences are flagged, never ignored."
        />
        <div className="mb-8 grid gap-4 xl:grid-cols-2">
          <YieldForm />
          <ReconciliationForm />
        </div>
        <div className="mb-8">
          <WastageForm />
        </div>
        <div className="mb-8">
          <ProductionList
            title="Yield records"
            description="Recorded yields from manufacturing orders."
            resource="yields"
            permission="yield:read"
            exportColumns={["manufacturingOrderId", "yieldPercentage", "result"]}
            rowHref={() => "/production/yield"}
            columns={[
              { key: "manufacturingOrderId", header: "Order" },
              { key: "yieldPercentage", header: "Yield %" },
              { key: "result", header: "Result", cell: (row) => <StatusBadge label={labelFor(yieldResultOptions, row.result)} tone={workflowTone(row.result)} /> },
            ]}
          />
        </div>
        <ProductionList
          title="Reconciliations"
          description="Issued, returned, consumed, and wastage must balance to expected quantity."
          resource="reconciliations"
          permission="reconciliation:read"
          exportColumns={["manufacturingOrderId", "materialId", "difference", "status"]}
          rowHref={() => "/production/yield"}
          columns={[
            { key: "materialId", header: "Material" },
            { key: "difference", header: "Difference" },
            { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(reconStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
          ]}
        />
      </div>
    </RequirePermission>
  );
}

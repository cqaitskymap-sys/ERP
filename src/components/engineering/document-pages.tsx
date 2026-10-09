"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { EngineeringList } from "@/components/engineering/engineering-list";
import { CalibrationResultsForm } from "@/components/engineering/forms";
import { EngineeringReportsPage } from "@/components/engineering/reports-page";
import {
  BREAKDOWN_ACTIONS,
  CALIBRATION_ACTIONS,
  EngineeringWorkflowActions,
  EquipmentTransitionActions,
  MAINTENANCE_PLAN_ACTIONS,
  MAINTENANCE_TASK_ACTIONS,
  QUALIFICATION_ACTIONS,
  UTILITY_ALERT_ACTIONS,
  WORK_ORDER_ACTIONS,
} from "@/components/engineering/workflow-actions";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getEngineering } from "@/lib/engineering/client";
import {
  breakdownStatusOptions,
  calibrationStatusOptions,
  equipmentStatusOptions,
  instrumentStatusOptions,
  labelFor,
  qualificationStatusOptions,
  workOrderStatusOptions,
  workflowTone,
} from "@/lib/engineering/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

const P = {
  equipment: "engineeringEquipment:read" as Permission,
  maintenance: "engineeringMaintenance:read" as Permission,
  workOrder: "engineeringWorkOrder:read" as Permission,
  calibration: "engineeringCalibration:read" as Permission,
  qualification: "engineeringQualification:read" as Permission,
  utilities: "engineeringUtilities:read" as Permission,
  monitoring: "engineeringMonitoring:read" as Permission,
  engineering: "engineering:read" as Permission,
  reports: "engineeringReports:read" as Permission,
};

const ALL_WO_ACTIONS = Object.values(WORK_ORDER_ACTIONS);
const ALL_BREAKDOWN_ACTIONS = Object.values(BREAKDOWN_ACTIONS);
const ALL_CALIBRATION_ACTIONS = Object.values(CALIBRATION_ACTIONS);
const ALL_QUALIFICATION_ACTIONS = Object.values(QUALIFICATION_ACTIONS);

export function EquipmentListPage() {
  return (
    <EngineeringList
      title="Equipment register"
      description="Plant equipment with status, criticality, and compliance links."
      resource="equipment"
      permission={P.equipment}
      createHref="/engineering/equipment/new"
      createLabel="New equipment"
      exportColumns={["equipmentNumber", "name", "category", "status", "criticality", "facilityId"]}
      columns={[
        { key: "equipmentNumber", header: "Number" },
        { key: "name", header: "Name" },
        { key: "category", header: "Category", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "criticality", header: "Criticality", hideOnMobile: true },
      ]}
      rowHref={(row) => `/engineering/equipment/${row.id}`}
    />
  );
}

export function EquipmentCategoriesListPage() {
  return (
    <EngineeringList
      title="Equipment by category"
      description="Same equipment register; use search or export to review by category column (manufacturing, HVAC, water, etc.)."
      resource="equipment"
      permission={P.equipment}
      exportColumns={["equipmentNumber", "name", "category", "status", "criticality"]}
      columns={[
        { key: "category", header: "Category" },
        { key: "equipmentNumber", header: "Number" },
        { key: "name", header: "Name" },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/equipment/${row.id}`}
    />
  );
}

export function MaintenanceTaskListPage() {
  return (
    <EngineeringList
      title="Preventive maintenance tasks"
      description="Scheduled PM tasks generated from maintenance plans."
      resource="maintenanceTasks"
      permission={P.maintenance}
      exportColumns={["taskNumber", "equipmentId", "dueDate", "status", "planId"]}
      columns={[
        { key: "taskNumber", header: "Task #" },
        { key: "equipmentId", header: "Equipment" },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/preventive/${row.id}`}
    />
  );
}

export function WorkOrderListPage() {
  return (
    <EngineeringList
      title="Maintenance work orders"
      description="Corrective and preventive work with multi-step approvals."
      resource="workOrders"
      permission={P.workOrder}
      createHref="/engineering/work-orders/new"
      createLabel="New work order"
      exportColumns={["workOrderNumber", "equipmentId", "workOrderType", "status", "priority"]}
      columns={[
        { key: "workOrderNumber", header: "WO #" },
        { key: "equipmentId", header: "Equipment" },
        { key: "workOrderType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "priority", header: "Priority", hideOnMobile: true },
      ]}
      rowHref={(row) => `/engineering/work-orders/${row.id}`}
    />
  );
}

export function BreakdownListPage() {
  return (
    <EngineeringList
      title="Equipment breakdowns"
      description="Downtime events with QA assessment when required."
      resource="breakdowns"
      permission={P.workOrder}
      createHref="/engineering/breakdowns/new"
      createLabel="Report breakdown"
      exportColumns={["breakdownNumber", "equipmentId", "severity", "status", "failureAt"]}
      columns={[
        { key: "breakdownNumber", header: "BRK #" },
        { key: "equipmentId", header: "Equipment" },
        { key: "severity", header: "Severity", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/breakdowns/${row.id}`}
    />
  );
}

export function CalibrationListPage() {
  return (
    <EngineeringList
      title="Calibration records"
      description="Instrument calibrations with results review and OOT handling."
      resource="calibrations"
      permission={P.calibration}
      createHref="/engineering/calibration/new"
      createLabel="Schedule calibration"
      exportColumns={["calibrationNumber", "instrumentId", "scheduledDate", "status", "outcome"]}
      columns={[
        { key: "calibrationNumber", header: "CAL #" },
        { key: "instrumentId", header: "Instrument" },
        { key: "scheduledDate", header: "Scheduled", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/calibration/${row.id}`}
    />
  );
}

export function InstrumentListPage() {
  return (
    <EngineeringList
      title="Instruments"
      description="Measurement instruments and calibration due dates."
      resource="instruments"
      permission={P.calibration}
      createHref="/engineering/instruments/new"
      createLabel="New instrument"
      exportColumns={["instrumentNumber", "name", "measurementType", "status", "nextCalibrationDueDate"]}
      columns={[
        { key: "instrumentNumber", header: "Number" },
        { key: "name", header: "Name" },
        { key: "measurementType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "nextCalibrationDueDate", header: "Next cal", hideOnMobile: true },
      ]}
      rowHref={(row) => `/engineering/instruments/${row.id}`}
    />
  );
}

export function QualificationListPage() {
  return (
    <EngineeringList
      title="Qualifications"
      description="IQ/OQ/PQ and requalification status by equipment."
      resource="qualifications"
      permission={P.qualification}
      createHref="/engineering/qualifications/new"
      createLabel="New qualification"
      exportColumns={["qualificationNumber", "equipmentId", "qualificationType", "status"]}
      columns={[
        { key: "qualificationNumber", header: "QUAL #" },
        { key: "equipmentId", header: "Equipment" },
        { key: "qualificationType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/qualifications/${row.id}`}
    />
  );
}

export function MaintenancePlanListPage() {
  return (
    <EngineeringList
      title="Maintenance plans"
      description="Preventive schedules; generate tasks from plan detail."
      resource="maintenancePlans"
      permission={P.maintenance}
      createHref="/engineering/plans/new"
      createLabel="New plan"
      exportColumns={["planNumber", "name", "equipmentId", "frequency", "status"]}
      columns={[
        { key: "planNumber", header: "Plan #" },
        { key: "name", header: "Name" },
        { key: "equipmentId", header: "Equipment", hideOnMobile: true },
        { key: "frequency", header: "Frequency", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/plans/${row.id}`}
    />
  );
}

export function ChecklistListPage() {
  return (
    <EngineeringList
      title="Maintenance checklists"
      description="Reusable PM checklists by equipment category."
      resource="checklists"
      permission={P.maintenance}
      createHref="/engineering/checklists/new"
      createLabel="New checklist"
      exportColumns={["name", "version", "equipmentCategory", "effectiveFrom", "status"]}
      columns={[
        { key: "name", header: "Name" },
        { key: "version", header: "Version", hideOnMobile: true },
        { key: "equipmentCategory", header: "Category", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/engineering/checklists"}
    />
  );
}

export function UtilitySystemListPage({ note }: { note?: string }) {
  return (
    <EngineeringList
      title="Utility systems"
      description={note || "HVAC, water, steam, and other utilities with configured limits."}
      resource="utilitySystems"
      permission={P.utilities}
      createHref="/engineering/utility-systems/new"
      createLabel="New utility system"
      exportColumns={["utilityNumber", "name", "systemType", "facilityId", "status"]}
      columns={[
        { key: "utilityNumber", header: "Number" },
        { key: "name", header: "Name" },
        { key: "systemType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/engineering/utility-systems"}
    />
  );
}

export function HvacUtilityListPage() {
  return (
    <UtilitySystemListPage note="HVAC-focused view: filter or search for system types hvac and ahu in the utility register." />
  );
}

export function WaterUtilityListPage() {
  return (
    <UtilitySystemListPage note="Water systems view: search for purified_water, wfi, and related utility system types." />
  );
}

export function MonitoringListPage({ note }: { note?: string }) {
  return (
    <EngineeringList
      title="Utility monitoring"
      description={note || "Recorded measurements against utility system limits."}
      resource="monitoring"
      permission={P.monitoring}
      createHref="/engineering/utility-monitoring/new"
      createLabel="Record measurement"
      exportColumns={["parameter", "value", "unit", "utilitySystemId", "measuredAt", "status"]}
      columns={[
        { key: "parameter", header: "Parameter" },
        { key: "value", header: "Value" },
        { key: "unit", header: "Unit", hideOnMobile: true },
        { key: "utilitySystemId", header: "System", hideOnMobile: true },
        { key: "measuredAt", header: "Measured", hideOnMobile: true },
      ]}
      rowHref={() => "/engineering/utility-monitoring"}
    />
  );
}

export function TemperatureHumidityMonitoringPage() {
  return (
    <MonitoringListPage note="Temperature and humidity monitoring: search parameter temperature or humidity in the monitoring register." />
  );
}

export function UtilityAlertListPage() {
  return (
    <EngineeringList
      title="Utility alerts"
      description="Out-of-limit monitoring alerts pending acknowledgement."
      resource="utilityAlerts"
      permission={P.monitoring}
      exportColumns={["alertNumber", "utilitySystemId", "parameter", "status", "createdAt"]}
      columns={[
        { key: "alertNumber", header: "Alert #" },
        { key: "utilitySystemId", header: "System" },
        { key: "parameter", header: "Parameter", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/engineering/utility-alerts/${row.id}`}
    />
  );
}

export function SparePartListPage() {
  return (
    <EngineeringList
      title="Spare parts"
      description="Critical spare links to materials; confirm stock in inventory."
      resource="spareParts"
      permission={P.engineering}
      createHref="/engineering/spare-parts/new"
      createLabel="Link spare"
      exportColumns={["materialId", "equipmentId", "partNumber", "criticalSpare", "reorderThreshold"]}
      columns={[
        { key: "materialId", header: "Material" },
        { key: "equipmentId", header: "Equipment", hideOnMobile: true },
        { key: "partNumber", header: "Part #", hideOnMobile: true },
        { key: "criticalSpare", header: "Critical" },
      ]}
      rowHref={() => "/engineering/spare-parts"}
    />
  );
}

export function EngineeringDocumentListPage() {
  return (
    <EngineeringList
      title="Engineering documents"
      description="Linked SOPs, manuals, and engineering document references."
      resource="documents"
      permission={P.engineering}
      exportColumns={["documentNumber", "title", "documentType", "equipmentId", "status"]}
      columns={[
        { key: "documentNumber", header: "Doc #" },
        { key: "title", header: "Title" },
        { key: "documentType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/engineering/documents"}
    />
  );
}

export function DowntimeReportPage() {
  return <EngineeringReportsPage defaultType="downtime_analysis" />;
}

export function MaintenanceCostReportPage() {
  return <EngineeringReportsPage defaultType="maintenance_cost" />;
}

export function QaChangeControlLinkPage() {
  return (
    <RequirePermission permission={P.engineering}>
      <div>
        <PageHeader
          title="Change control"
          description="Equipment and utility changes are managed in QA change control."
        />
        <Link href="/qa/change-control" className="text-primary underline-offset-4 hover:underline">
          Open QA change control →
        </Link>
      </div>
    </RequirePermission>
  );
}

export function QaDeviationsLinkPage() {
  return (
    <RequirePermission permission={P.engineering}>
      <div>
        <PageHeader title="Deviations" description="Link breakdowns and calibration OOT events to QA deviations from detail screens." />
        <Link href="/qa/deviations" className="text-primary underline-offset-4 hover:underline">
          Open QA deviations →
        </Link>
      </div>
    </RequirePermission>
  );
}

export function EquipmentDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.equipment} resource="equipment" id={id} titleKey="equipmentNumber" statusOptions={equipmentStatusOptions}>
      {({ record, extra, reload }) => (
        <div className="space-y-6">
          <EquipmentTransitionActions id={id} status={String(record.status || "")} onChanged={reload} />
          <RecordGrid record={record} fields={["name", "category", "criticality", "facilityId", "serialNumber", "assetNumber", "requiresCalibration", "requiresQualification"]} statusOptions={equipmentStatusOptions} />
          <RelatedList title="Risk assessments" rows={(extra.riskAssessments as Row[]) || []} columns={["riskScore", "criticalityBand", "reviewDueDate", "status"]} />
          <RelatedList title="Work orders" rows={(extra.workOrders as Row[]) || []} columns={["workOrderNumber", "workOrderType", "status"]} hrefPrefix="/engineering/work-orders" />
        </div>
      )}
    </DetailShell>
  );
}

export function WorkOrderDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.workOrder}
      resource="workOrders"
      id={id}
      titleKey="workOrderNumber"
      statusOptions={workOrderStatusOptions}
      workflowResource="workOrders"
      actions={ALL_WO_ACTIONS}
    >
      {({ record, extra }) => (
        <div className="space-y-6">
          <RecordGrid record={record} fields={["equipmentId", "workOrderType", "priority", "failureDescription", "assignedTechnicianId", "maintenanceCost", "requireQaReview"]} statusOptions={workOrderStatusOptions} />
          <RelatedList title="Work order lines" rows={(extra.lines as Row[]) || []} columns={["lineType", "description", "quantity", "uom"]} />
          {record.breakdownId ? (
            <Link href={`/engineering/breakdowns/${String(record.breakdownId)}`} className="text-sm text-primary underline-offset-4 hover:underline">
              Linked breakdown
            </Link>
          ) : null}
        </div>
      )}
    </DetailShell>
  );
}

export function BreakdownDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.workOrder}
      resource="breakdowns"
      id={id}
      titleKey="breakdownNumber"
      statusOptions={breakdownStatusOptions}
      workflowResource="breakdowns"
      actions={ALL_BREAKDOWN_ACTIONS}
    >
      {({ record }) => (
        <div className="space-y-4">
          <RecordGrid record={record} fields={["equipmentId", "severity", "symptoms", "failureAt", "downtimeMinutes", "requiresQaAssessment", "workOrderId"]} statusOptions={breakdownStatusOptions} />
          {record.workOrderId ? (
            <Link href={`/engineering/work-orders/${String(record.workOrderId)}`} className="text-sm text-primary underline-offset-4 hover:underline">
              Open linked work order
            </Link>
          ) : null}
        </div>
      )}
    </DetailShell>
  );
}

export function CalibrationDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.calibration}
      resource="calibrations"
      id={id}
      titleKey="calibrationNumber"
      statusOptions={calibrationStatusOptions}
      workflowResource="calibrations"
      actions={ALL_CALIBRATION_ACTIONS}
    >
      {({ record, extra, reload }) => (
        <div className="space-y-6">
          <RecordGrid record={record} fields={["instrumentId", "scheduledDate", "calibrationDate", "outcome", "certificateReference"]} statusOptions={calibrationStatusOptions} />
          {["in_progress", "results_review"].includes(String(record.status)) ? (
            <CalibrationResultsForm calibrationId={id} onSaved={reload} />
          ) : null}
          <RelatedList title="Calibration results" rows={(extra.results as Row[]) || []} columns={["calibrationDate", "outcome", "certificateReference"]} />
        </div>
      )}
    </DetailShell>
  );
}

export function InstrumentDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.calibration} resource="instruments" id={id} titleKey="instrumentNumber" statusOptions={instrumentStatusOptions}>
      {({ record }) => (
        <RecordGrid
          record={record}
          fields={["name", "equipmentId", "measurementType", "calibrationFrequency", "lastCalibrationDate", "nextCalibrationDueDate", "calibrationStatus"]}
          statusOptions={instrumentStatusOptions}
        />
      )}
    </DetailShell>
  );
}

export function QualificationDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.qualification}
      resource="qualifications"
      id={id}
      titleKey="qualificationNumber"
      statusOptions={qualificationStatusOptions}
      workflowResource="qualifications"
      actions={ALL_QUALIFICATION_ACTIONS}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["equipmentId", "qualificationType", "protocolDocumentId", "reportDocumentId", "effectiveFrom", "reviewDueDate"]} statusOptions={qualificationStatusOptions} />
      )}
    </DetailShell>
  );
}

export function MaintenancePlanDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.maintenance}
      resource="maintenancePlans"
      id={id}
      titleKey="planNumber"
      statusOptions={[{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }]}
      workflowResource="maintenancePlans"
      actions={[MAINTENANCE_PLAN_ACTIONS.generate_tasks]}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["name", "equipmentId", "frequency", "taskDescription", "nextDueDate", "startDate", "assignedTechnicianId"]} />
      )}
    </DetailShell>
  );
}

export function MaintenanceTaskDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.maintenance}
      resource="maintenanceTasks"
      id={id}
      titleKey="taskNumber"
      statusOptions={[
        { label: "Scheduled", value: "scheduled" },
        { label: "Due", value: "due" },
        { label: "Overdue", value: "overdue" },
        { label: "Completed", value: "completed" },
      ]}
      workflowResource="maintenanceTasks"
      actions={[MAINTENANCE_TASK_ACTIONS.complete]}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["equipmentId", "planId", "dueDate", "taskDescription", "assignedTechnicianId", "completedDate"]} />
      )}
    </DetailShell>
  );
}

export function UtilityAlertDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.monitoring}
      resource="utilityAlerts"
      id={id}
      titleKey="alertNumber"
      statusOptions={[
        { label: "Open", value: "open" },
        { label: "Acknowledged", value: "acknowledged" },
        { label: "Closed", value: "closed" },
      ]}
      workflowResource="utilityAlerts"
      actions={[UTILITY_ALERT_ACTIONS.acknowledge]}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["utilitySystemId", "parameter", "value", "unit", "message", "deviationId"]} />
      )}
    </DetailShell>
  );
}

function DetailShell({
  permission,
  resource,
  id,
  titleKey,
  statusOptions,
  workflowResource,
  actions,
  children,
}: {
  permission: Permission;
  resource: string;
  id: string;
  titleKey: string;
  statusOptions?: Array<{ label: string; value: string }>;
  workflowResource?: string;
  actions?: Parameters<typeof EngineeringWorkflowActions>[0]["actions"];
  children?: (ctx: { record: Row; extra: Record<string, unknown>; reload: () => void }) => ReactNode;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    void getEngineering(resource, id)
      .then((result) => {
        setRecord(result.record as Row);
        setExtra(result.extra || {});
        setError(null);
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Unable to load record" description={error || "Not found."} />;
  }

  const status = String(record.status || "");
  const opts = statusOptions || equipmentStatusOptions;

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={String(record[titleKey] || record.id)} description="Engineering record with audited workflow actions." />
        {workflowResource && actions?.length ? (
          <EngineeringWorkflowActions
            resource={workflowResource}
            id={id}
            status={status}
            statusOptions={opts}
            actions={actions}
            onChanged={load}
          />
        ) : statusOptions ? (
          <div className="mb-6 rounded-xl border bg-card p-4">
            <StatusBadge label={labelFor(opts, status)} tone={workflowTone(status)} />
          </div>
        ) : null}
        {children?.({ record, extra, reload: load })}
      </div>
    </RequirePermission>
  );
}

function RecordGrid({
  record,
  fields,
  statusOptions = equipmentStatusOptions,
}: {
  record: Row;
  fields: string[];
  statusOptions?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
          <p className="mt-1 text-sm font-medium break-all">{formatValue(record[field])}</p>
        </div>
      ))}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">status</p>
        <div className="mt-1">
          <StatusBadge label={labelFor(statusOptions, String(record.status || ""))} tone={workflowTone(String(record.status || ""))} />
        </div>
      </div>
    </div>
  );
}

function RelatedList({
  title,
  rows,
  columns,
  hrefPrefix,
}: {
  title: string;
  rows: Row[];
  columns: string[];
  hrefPrefix?: string;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No {title.toLowerCase()} linked.</p>;
  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3 text-sm font-medium">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((column) => (
                <th key={column} className="px-4 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b last:border-0">
                {columns.map((column, index) => (
                  <td key={column} className="px-4 py-2">
                    {hrefPrefix && row.id && index === 0 ? (
                      <Link href={`${hrefPrefix}/${row.id}`} className="text-primary underline-offset-4 hover:underline">
                        {formatValue(row[column])}
                      </Link>
                    ) : (
                      formatValue(row[column])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

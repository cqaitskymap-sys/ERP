"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEngineering, listEngineering, runEngineeringAction } from "@/lib/engineering/client";
import {
  breakdownSeverityOptions,
  criticalityOptions,
  equipmentCategoryOptions,
  monitoringParameterOptions,
  qualificationTypeOptions,
  utilityTypeOptions,
  workOrderTypeOptions,
} from "@/lib/engineering/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormShell({
  permission,
  title,
  description,
  onSubmit,
  children,
}: {
  permission: Permission;
  title: string;
  description: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description={description} />
        <form
          className="max-w-3xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void onSubmit()
              .catch((error) => toast.error("Unable to save", publicMasterError(error)))
              .finally(() => setBusy(false));
          }}
        >
          {children}
          <Button type="submit" className="min-h-11" disabled={busy}>
            Save
          </Button>
        </form>
      </div>
    </RequirePermission>
  );
}

export function EquipmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    category: "manufacturing",
    serialNumber: "",
    assetNumber: "",
    facilityId: "",
    criticality: "minor",
    requiresCalibration: "false",
    requiresQualification: "false",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringEquipment:create"
      title="New equipment"
      description="Register plant equipment with category, location, and criticality."
      onSubmit={async () => {
        const result = await createEngineering("equipment", {
          name: form.name,
          category: form.category,
          serialNumber: form.serialNumber || undefined,
          assetNumber: form.assetNumber || undefined,
          facilityId: form.facilityId || undefined,
          criticality: form.criticality,
          requiresCalibration: form.requiresCalibration === "true",
          requiresQualification: form.requiresQualification === "true",
          notes: form.notes || undefined,
        });
        toast.success("Equipment registered");
        router.push(`/engineering/equipment/${result.id}`);
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Category">
        <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {equipmentCategoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Serial number">
          <Input className="min-h-11" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
        </Field>
        <Field label="Asset number">
          <Input className="min-h-11" value={form.assetNumber} onChange={(e) => setForm({ ...form, assetNumber: e.target.value })} />
        </Field>
        <Field label="Facility ID">
          <Input className="min-h-11" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} />
        </Field>
        <Field label="Criticality">
          <Select value={form.criticality} onValueChange={(value) => setForm({ ...form, criticality: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {criticalityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <ToggleField
        label="Requires calibration"
        value={form.requiresCalibration}
        onChange={(value) => setForm({ ...form, requiresCalibration: value })}
      />
      <ToggleField
        label="Requires qualification"
        value={form.requiresQualification}
        onChange={(value) => setForm({ ...form, requiresQualification: value })}
      />
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function WorkOrderForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    equipmentId: "",
    workOrderType: "corrective",
    priority: "medium",
    failureDescription: "",
    assignedTechnicianId: "",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringWorkOrder:create"
      title="New maintenance work order"
      description="Corrective, preventive, or inspection work with approval workflow."
      onSubmit={async () => {
        const result = await createEngineering("workOrders", {
          equipmentId: form.equipmentId,
          workOrderType: form.workOrderType,
          priority: form.priority,
          failureDescription: form.failureDescription,
          assignedTechnicianId: form.assignedTechnicianId || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Work order created");
        router.push(`/engineering/work-orders/${result.id}`);
      }}
    >
      <Field label="Equipment ID">
        <Input
          className="min-h-11"
          value={form.equipmentId}
          onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
          required
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Work order type">
          <Select value={form.workOrderType} onValueChange={(value) => setForm({ ...form, workOrderType: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workOrderTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["critical", "high", "medium", "low"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Failure / work description">
        <Textarea
          value={form.failureDescription}
          onChange={(e) => setForm({ ...form, failureDescription: e.target.value })}
          required
        />
      </Field>
      <Field label="Assigned technician ID">
        <Input
          className="min-h-11"
          value={form.assignedTechnicianId}
          onChange={(e) => setForm({ ...form, assignedTechnicianId: e.target.value })}
        />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function BreakdownForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    equipmentId: "",
    failureAt: new Date().toISOString().slice(0, 16),
    symptoms: "",
    severity: "medium",
    productionImpact: "false",
    qualityImpact: "false",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringWorkOrder:create"
      title="Report equipment breakdown"
      description="Logs downtime, may auto-create a linked corrective work order."
      onSubmit={async () => {
        const result = await createEngineering("breakdowns", {
          equipmentId: form.equipmentId,
          failureAt: new Date(form.failureAt).toISOString(),
          symptoms: form.symptoms,
          severity: form.severity,
          productionImpact: form.productionImpact === "true",
          qualityImpact: form.qualityImpact === "true",
          notes: form.notes || undefined,
        });
        toast.success("Breakdown reported");
        router.push(`/engineering/breakdowns/${result.id}`);
      }}
    >
      <Field label="Equipment ID">
        <Input className="min-h-11" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} required />
      </Field>
      <Field label="Failure time">
        <Input
          className="min-h-11"
          type="datetime-local"
          value={form.failureAt}
          onChange={(e) => setForm({ ...form, failureAt: e.target.value })}
          required
        />
      </Field>
      <Field label="Severity">
        <Select value={form.severity} onValueChange={(value) => setForm({ ...form, severity: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {breakdownSeverityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Symptoms">
        <Textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} required />
      </Field>
      <ToggleField label="Production impact" value={form.productionImpact} onChange={(v) => setForm({ ...form, productionImpact: v })} />
      <ToggleField label="Quality impact" value={form.qualityImpact} onChange={(v) => setForm({ ...form, qualityImpact: v })} />
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function InstrumentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    equipmentId: "",
    measurementType: "",
    calibrationFrequency: "yearly",
    toleranceLower: "0",
    toleranceUpper: "0",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringCalibration:create"
      title="New instrument"
      description="Measurement instrument linked to calibration schedules."
      onSubmit={async () => {
        const result = await createEngineering("instruments", {
          name: form.name,
          equipmentId: form.equipmentId || undefined,
          measurementType: form.measurementType,
          calibrationFrequency: form.calibrationFrequency,
          toleranceLower: Number(form.toleranceLower),
          toleranceUpper: Number(form.toleranceUpper),
          notes: form.notes || undefined,
        });
        toast.success("Instrument created");
        router.push(`/engineering/instruments/${result.id}`);
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Equipment ID (optional)">
        <Input className="min-h-11" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} />
      </Field>
      <Field label="Measurement type">
        <Input
          className="min-h-11"
          value={form.measurementType}
          onChange={(e) => setForm({ ...form, measurementType: e.target.value })}
          required
        />
      </Field>
      <Field label="Calibration frequency">
        <Select value={form.calibrationFrequency} onValueChange={(value) => setForm({ ...form, calibrationFrequency: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["monthly", "quarterly", "half_yearly", "yearly", "custom"].map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tolerance lower">
          <Input className="min-h-11" type="number" value={form.toleranceLower} onChange={(e) => setForm({ ...form, toleranceLower: e.target.value })} />
        </Field>
        <Field label="Tolerance upper">
          <Input className="min-h-11" type="number" value={form.toleranceUpper} onChange={(e) => setForm({ ...form, toleranceUpper: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function CalibrationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    instrumentId: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    calibrationMethod: "",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringCalibration:create"
      title="Schedule calibration"
      description="Creates a calibration record for an instrument."
      onSubmit={async () => {
        const result = await createEngineering("calibrations", {
          instrumentId: form.instrumentId,
          scheduledDate: form.scheduledDate,
          calibrationMethod: form.calibrationMethod || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Calibration scheduled");
        router.push(`/engineering/calibration/${result.id}`);
      }}
    >
      <Field label="Instrument ID">
        <Input className="min-h-11" value={form.instrumentId} onChange={(e) => setForm({ ...form, instrumentId: e.target.value })} required />
      </Field>
      <Field label="Scheduled date">
        <Input className="min-h-11" type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required />
      </Field>
      <Field label="Calibration method">
        <Input className="min-h-11" value={form.calibrationMethod} onChange={(e) => setForm({ ...form, calibrationMethod: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function MaintenancePlanForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    equipmentId: "",
    name: "",
    taskDescription: "",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    estimatedDurationMinutes: "60",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringMaintenance:create"
      title="New maintenance plan"
      description="Preventive maintenance schedule for equipment."
      onSubmit={async () => {
        const result = await createEngineering("maintenancePlans", {
          equipmentId: form.equipmentId,
          name: form.name,
          taskDescription: form.taskDescription,
          frequency: form.frequency,
          startDate: form.startDate,
          estimatedDurationMinutes: Number(form.estimatedDurationMinutes),
        });
        toast.success("Maintenance plan created");
        router.push(`/engineering/plans/${result.id}`);
      }}
    >
      <Field label="Equipment ID">
        <Input className="min-h-11" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} required />
      </Field>
      <Field label="Plan name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Task description">
        <Textarea value={form.taskDescription} onChange={(e) => setForm({ ...form, taskDescription: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Frequency">
          <Select value={form.frequency} onValueChange={(value) => setForm({ ...form, frequency: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly", "custom"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date">
          <Input className="min-h-11" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        </Field>
      </div>
      <Field label="Estimated duration (minutes)">
        <Input
          className="min-h-11"
          type="number"
          min={0}
          value={form.estimatedDurationMinutes}
          onChange={(e) => setForm({ ...form, estimatedDurationMinutes: e.target.value })}
        />
      </Field>
    </FormShell>
  );
}

export function UtilitySystemForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    systemType: "hvac",
    facilityId: "",
    location: "",
    lowerLimit: "",
    upperLimit: "",
    limitUnit: "",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringUtilities:create"
      title="New utility system"
      description="HVAC, water, compressed air, and other utility systems with monitoring limits."
      onSubmit={async () => {
        await createEngineering("utilitySystems", {
          name: form.name,
          systemType: form.systemType,
          facilityId: form.facilityId || undefined,
          location: form.location || undefined,
          lowerLimit: form.lowerLimit ? Number(form.lowerLimit) : undefined,
          upperLimit: form.upperLimit ? Number(form.upperLimit) : undefined,
          limitUnit: form.limitUnit || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Utility system created");
        router.push("/engineering/utility-systems");
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="System type">
        <Select value={form.systemType} onValueChange={(value) => setForm({ ...form, systemType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {utilityTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Facility ID">
          <Input className="min-h-11" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input className="min-h-11" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Lower limit">
          <Input className="min-h-11" type="number" value={form.lowerLimit} onChange={(e) => setForm({ ...form, lowerLimit: e.target.value })} />
        </Field>
        <Field label="Upper limit">
          <Input className="min-h-11" type="number" value={form.upperLimit} onChange={(e) => setForm({ ...form, upperLimit: e.target.value })} />
        </Field>
      </div>
      <Field label="Limit unit">
        <Input className="min-h-11" value={form.limitUnit} onChange={(e) => setForm({ ...form, limitUnit: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function MonitoringForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    utilitySystemId: "",
    parameter: "temperature",
    value: "",
    unit: "°C",
    measuredAt: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringMonitoring:create"
      title="Record utility measurement"
      description="Manual monitoring reading; out-of-limit values may raise utility alerts."
      onSubmit={async () => {
        await createEngineering("monitoring", {
          utilitySystemId: form.utilitySystemId,
          parameter: form.parameter,
          value: Number(form.value),
          unit: form.unit,
          measuredAt: new Date(form.measuredAt).toISOString(),
          notes: form.notes || undefined,
        });
        toast.success("Measurement recorded");
        router.push("/engineering/utility-monitoring");
      }}
    >
      <Field label="Utility system ID">
        <Input
          className="min-h-11"
          value={form.utilitySystemId}
          onChange={(e) => setForm({ ...form, utilitySystemId: e.target.value })}
          required
        />
      </Field>
      <Field label="Parameter">
        <Select value={form.parameter} onValueChange={(value) => setForm({ ...form, parameter: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monitoringParameterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Value">
          <Input className="min-h-11" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
        </Field>
        <Field label="Unit">
          <Input className="min-h-11" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
        </Field>
      </div>
      <Field label="Measured at">
        <Input
          className="min-h-11"
          type="datetime-local"
          value={form.measuredAt}
          onChange={(e) => setForm({ ...form, measuredAt: e.target.value })}
          required
        />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function SparePartForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    materialId: "",
    equipmentId: "",
    partNumber: "",
    criticalSpare: "false",
    reorderThreshold: "0",
    notes: "",
  });

  return (
    <FormShell
      permission="engineering:update"
      title="Link spare part"
      description="Associates inventory material with equipment; stock levels come from warehouse."
      onSubmit={async () => {
        await createEngineering("spareParts", {
          materialId: form.materialId,
          equipmentId: form.equipmentId || undefined,
          partNumber: form.partNumber || undefined,
          criticalSpare: form.criticalSpare === "true",
          reorderThreshold: Number(form.reorderThreshold),
          notes: form.notes || undefined,
        });
        toast.success("Spare part link saved");
        router.push("/engineering/spare-parts");
      }}
    >
      <Field label="Material ID">
        <Input className="min-h-11" value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })} required />
      </Field>
      <Field label="Equipment ID">
        <Input className="min-h-11" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} />
      </Field>
      <Field label="Part number">
        <Input className="min-h-11" value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
      </Field>
      <ToggleField label="Critical spare" value={form.criticalSpare} onChange={(v) => setForm({ ...form, criticalSpare: v })} />
      <Field label="Reorder threshold">
        <Input className="min-h-11" type="number" min={0} value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function QualificationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    equipmentId: "",
    qualificationType: "iq",
    protocolDocumentId: "",
    effectiveFrom: "",
    notes: "",
  });

  return (
    <FormShell
      permission="engineeringQualification:create"
      title="New qualification record"
      description="URS/DQ/IQ/OQ/PQ qualification with protocol and approval workflow."
      onSubmit={async () => {
        const result = await createEngineering("qualifications", {
          equipmentId: form.equipmentId,
          qualificationType: form.qualificationType,
          protocolDocumentId: form.protocolDocumentId || undefined,
          effectiveFrom: form.effectiveFrom || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Qualification created");
        router.push(`/engineering/qualifications/${result.id}`);
      }}
    >
      <Field label="Equipment ID">
        <Input className="min-h-11" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} required />
      </Field>
      <Field label="Qualification type">
        <Select value={form.qualificationType} onValueChange={(value) => setForm({ ...form, qualificationType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {qualificationTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Protocol document ID">
        <Input className="min-h-11" value={form.protocolDocumentId} onChange={(e) => setForm({ ...form, protocolDocumentId: e.target.value })} />
      </Field>
      <Field label="Effective from">
        <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function ChecklistForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    equipmentCategory: "",
    version: "1.0",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    stepsJson: JSON.stringify([{ sequence: 1, instruction: "Inspect guards and interlocks", passFail: true }], null, 2),
  });

  return (
    <FormShell
      permission="engineeringMaintenance:create"
      title="New maintenance checklist"
      description="Step-by-step checklist for PM execution."
      onSubmit={async () => {
        const steps = JSON.parse(form.stepsJson) as Array<Record<string, unknown>>;
        await createEngineering("checklists", {
          name: form.name,
          equipmentCategory: form.equipmentCategory || undefined,
          version: form.version,
          effectiveFrom: form.effectiveFrom,
          steps,
        });
        toast.success("Checklist created");
        router.push("/engineering/checklists");
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Equipment category (optional)">
        <Select value={form.equipmentCategory || "none"} onValueChange={(value) => setForm({ ...form, equipmentCategory: value === "none" ? "" : value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue placeholder="Any category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Any category</SelectItem>
            {equipmentCategoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Version">
          <Input className="min-h-11" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} required />
        </Field>
        <Field label="Effective from">
          <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
        </Field>
      </div>
      <Field label="Steps (JSON array)">
        <Textarea className="min-h-[200px] font-mono text-xs" value={form.stepsJson} onChange={(e) => setForm({ ...form, stepsJson: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function EngineeringSettingsForm() {
  const [form, setForm] = useState({
    pmDueSoonDays: "7",
    calibrationDueSoonDays: "14",
    requireQaReviewForCriticalBreakdowns: "true",
    requireQaReviewForCalibrationFailure: "true",
    restrictEquipmentOnCalibrationFailure: "true",
    currency: "INR",
    allowEstimatedCostsInTotals: "false",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listEngineering("settings", { pageSize: 1 })
        .then((result) => {
          const row = result.rows[0];
          if (!row) return;
          setForm({
            pmDueSoonDays: String(row.pmDueSoonDays ?? 7),
            calibrationDueSoonDays: String(row.calibrationDueSoonDays ?? 14),
            requireQaReviewForCriticalBreakdowns: String(row.requireQaReviewForCriticalBreakdowns ?? true),
            requireQaReviewForCalibrationFailure: String(row.requireQaReviewForCalibrationFailure ?? true),
            restrictEquipmentOnCalibrationFailure: String(row.restrictEquipmentOnCalibrationFailure ?? true),
            currency: String(row.currency || "INR"),
            allowEstimatedCostsInTotals: String(row.allowEstimatedCostsInTotals ?? false),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    try {
      await createEngineering("settings", {
        pmDueSoonDays: Number(form.pmDueSoonDays),
        calibrationDueSoonDays: Number(form.calibrationDueSoonDays),
        requireQaReviewForCriticalBreakdowns: form.requireQaReviewForCriticalBreakdowns === "true",
        requireQaReviewForCalibrationFailure: form.requireQaReviewForCalibrationFailure === "true",
        restrictEquipmentOnCalibrationFailure: form.restrictEquipmentOnCalibrationFailure === "true",
        currency: form.currency,
        allowEstimatedCostsInTotals: form.allowEstimatedCostsInTotals === "true",
      });
      toast.success("Engineering settings saved");
    } catch (error) {
      toast.error("Unable to save settings", publicMasterError(error));
    }
  }

  return (
    <RequirePermission permission="engineering:update">
      <div>
        <PageHeader title="Engineering settings" description="PM/calibration thresholds, QA rules, and costing preferences." />
        <div className="mb-6 grid max-w-2xl gap-3">
          <Field label="PM due soon (days)">
            <Input className="min-h-11" type="number" value={form.pmDueSoonDays} onChange={(e) => setForm({ ...form, pmDueSoonDays: e.target.value })} />
          </Field>
          <Field label="Calibration due soon (days)">
            <Input
              className="min-h-11"
              type="number"
              value={form.calibrationDueSoonDays}
              onChange={(e) => setForm({ ...form, calibrationDueSoonDays: e.target.value })}
            />
          </Field>
          <Field label="Default currency">
            <Input className="min-h-11" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Field>
          <ToggleField
            label="Require QA review for critical breakdowns"
            value={form.requireQaReviewForCriticalBreakdowns}
            onChange={(value) => setForm({ ...form, requireQaReviewForCriticalBreakdowns: value })}
          />
          <ToggleField
            label="Require QA review for calibration failure"
            value={form.requireQaReviewForCalibrationFailure}
            onChange={(value) => setForm({ ...form, requireQaReviewForCalibrationFailure: value })}
          />
          <ToggleField
            label="Restrict equipment on calibration failure"
            value={form.restrictEquipmentOnCalibrationFailure}
            onChange={(value) => setForm({ ...form, restrictEquipmentOnCalibrationFailure: value })}
          />
          <ToggleField
            label="Allow estimated costs in totals"
            value={form.allowEstimatedCostsInTotals}
            onChange={(value) => setForm({ ...form, allowEstimatedCostsInTotals: value })}
          />
        </div>
        <Button className="min-h-11" onClick={() => void save()}>
          Save settings
        </Button>
      </div>
    </RequirePermission>
  );
}

export function CalibrationResultsForm({ calibrationId, onSaved }: { calibrationId: string; onSaved: () => void }) {
  const [readingsJson, setReadingsJson] = useState(
    JSON.stringify([{ point: "100%", asFound: 0, asLeft: 0, lowerLimit: -1, upperLimit: 1 }], null, 2)
  );
  const [calibrationDate, setCalibrationDate] = useState(new Date().toISOString().slice(0, 10));
  const [certificateReference, setCertificateReference] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-medium">Submit calibration results</p>
      <div className="space-y-3">
        <Field label="Calibration date">
          <Input className="min-h-11" type="date" value={calibrationDate} onChange={(e) => setCalibrationDate(e.target.value)} />
        </Field>
        <Field label="Certificate reference">
          <Input className="min-h-11" value={certificateReference} onChange={(e) => setCertificateReference(e.target.value)} />
        </Field>
        <Field label="Readings (JSON array)">
          <Textarea className="min-h-[180px] font-mono text-xs" value={readingsJson} onChange={(e) => setReadingsJson(e.target.value)} />
        </Field>
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const readings = JSON.parse(readingsJson) as Array<Record<string, unknown>>;
            void runEngineeringAction("calibrations", calibrationId, "submit_results", {
              readings,
              calibrationDate,
              certificateReference: certificateReference || undefined,
            })
              .then(() => {
                toast.success("Results submitted");
                onSaved();
              })
              .catch((error) => toast.error("Unable to submit results", publicMasterError(error)))
              .finally(() => setBusy(false));
          }}
        >
          Submit results
        </Button>
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

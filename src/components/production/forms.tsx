"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { MasterPick } from "@/components/warehouse/master-pick";
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
import { createProduction, listProduction } from "@/lib/production/client";
import { materialStageOptions, priorityOptions, wastageReasonOptions, workCenterTypeOptions } from "@/lib/production/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import { DEFAULT_PROCESS_STEPS } from "@/types/production";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ResourcePick({
  resource,
  label,
  value,
  onChange,
  nameKey,
  required,
}: {
  resource: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  nameKey: string;
  required?: boolean;
}) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listProduction(resource, { pageSize: 100 })
        .then((result) => setRows(result.rows))
        .catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource]);
  return (
    <Field label={`${label}${required ? " *" : ""}`}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {String(row[nameKey] || row.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function LineEditor<T extends object>({
  items,
  onChange,
  blank,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  render: (item: T, index: number, update: (index: number, patch: Partial<T>) => void) => ReactNode;
}) {
  function update(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
          {render(item, index, update)}
        </div>
      ))}
      <Button variant="outline" className="min-h-11" onClick={() => onChange([...items, { ...blank }])}>
        Add line
      </Button>
    </div>
  );
}

export function ProductionPlanForm() {
  return (
    <RequirePermission permission="productionPlan:create">
      <PlanInner />
    </RequirePermission>
  );
}

function PlanInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    plantId: "",
    departmentId: "",
    productionPeriod: new Date().toISOString().slice(0, 7),
    priority: "normal",
    customerId: "",
    targetDate: new Date().toISOString().slice(0, 10),
    requestedDate: "",
    planningNotes: "",
  });
  const [items, setItems] = useState([{ productId: "", customerId: "", quantity: "", uom: "", targetDate: "", priority: "normal", batchSize: "", remarks: "" }]);

  async function submit() {
    try {
      const result = await createProduction("plans", {
        ...header,
        idempotencyKey: crypto.randomUUID(),
        items: items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          batchSize: item.batchSize ? Number(item.batchSize) : undefined,
        })),
      });
      toast.success("Draft production plan created");
      router.push(`/production/plans/${result.id}`);
    } catch (error) {
      toast.error("Unable to save plan", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New production plan" description="Plan customer demand against active, manufacturing-eligible products." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="plants" label="Plant" required value={header.plantId} onChange={(plantId) => setHeader({ ...header, plantId })} />
        <MasterPick entity="departments" label="Department" value={header.departmentId} onChange={(departmentId) => setHeader({ ...header, departmentId })} />
        <Field label="Production period">
          <Input className="min-h-11" value={header.productionPeriod} onChange={(event) => setHeader({ ...header, productionPeriod: event.target.value })} />
        </Field>
        <Field label="Priority">
          <Select value={header.priority} onValueChange={(priority) => setHeader({ ...header, priority })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <MasterPick entity="customers" label="Customer" value={header.customerId} onChange={(customerId) => setHeader({ ...header, customerId })} />
        <Field label="Target date">
          <Input className="min-h-11" type="date" value={header.targetDate} onChange={(event) => setHeader({ ...header, targetDate: event.target.value })} />
        </Field>
        <Field label="Requested date">
          <Input className="min-h-11" type="date" value={header.requestedDate} onChange={(event) => setHeader({ ...header, requestedDate: event.target.value })} />
        </Field>
        <Field label="Planning notes">
          <Textarea value={header.planningNotes} onChange={(event) => setHeader({ ...header, planningNotes: event.target.value })} />
        </Field>
      </div>
      <LineEditor
        items={items}
        blank={{ productId: "", customerId: "", quantity: "", uom: "", targetDate: "", priority: "normal", batchSize: "", remarks: "" }}
        onChange={setItems}
        render={(item, index, update) => (
          <>
            <MasterPick entity="products" label="Product" required value={item.productId} onChange={(productId) => update(index, { productId })} />
            <MasterPick entity="customers" label="Customer" value={item.customerId} onChange={(customerId) => update(index, { customerId })} />
            <Field label="Quantity">
              <Input className="min-h-11" type="number" value={item.quantity} onChange={(event) => update(index, { quantity: event.target.value })} />
            </Field>
            <MasterPick entity="uoms" label="UOM" required value={item.uom} onChange={(uom) => update(index, { uom })} />
            <Field label="Batch size">
              <Input className="min-h-11" type="number" value={item.batchSize} onChange={(event) => update(index, { batchSize: event.target.value })} />
            </Field>
            <Field label="Target date">
              <Input className="min-h-11" type="date" value={item.targetDate} onChange={(event) => update(index, { targetDate: event.target.value })} />
            </Field>
          </>
        )}
      />
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save draft</Button>
    </div>
  );
}

export function ProductionScheduleForm() {
  return (
    <RequirePermission permission="productionSchedule:create">
      <ScheduleInner />
    </RequirePermission>
  );
}

function ScheduleInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    productionPlanId: "",
    productId: "",
    batchSize: "",
    plannedStartDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date().toISOString().slice(0, 10),
    workCenterId: "",
    priority: "normal",
    assignedSupervisor: "",
    remarks: "",
  });

  async function submit() {
    try {
      const result = await createProduction("schedules", { ...header, batchSize: Number(header.batchSize), idempotencyKey: crypto.randomUUID() });
      toast.success("Schedule created");
      router.push(`/production/schedule/${result.id}`);
    } catch (error) {
      toast.error("Unable to save schedule", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New production schedule" description="Assign a product window to a work center without a complex scheduling engine." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <ResourcePick resource="plans" label="Production plan" value={header.productionPlanId} onChange={(productionPlanId) => setHeader({ ...header, productionPlanId })} nameKey="planNumber" />
        <MasterPick entity="products" label="Product" required value={header.productId} onChange={(productId) => setHeader({ ...header, productId })} />
        <Field label="Batch size">
          <Input className="min-h-11" type="number" value={header.batchSize} onChange={(event) => setHeader({ ...header, batchSize: event.target.value })} />
        </Field>
        <ResourcePick resource="workCenters" label="Work center" value={header.workCenterId} onChange={(workCenterId) => setHeader({ ...header, workCenterId })} nameKey="workCenterName" />
        <Field label="Planned start">
          <Input className="min-h-11" type="date" value={header.plannedStartDate} onChange={(event) => setHeader({ ...header, plannedStartDate: event.target.value })} />
        </Field>
        <Field label="Planned end">
          <Input className="min-h-11" type="date" value={header.plannedEndDate} onChange={(event) => setHeader({ ...header, plannedEndDate: event.target.value })} />
        </Field>
        <Field label="Supervisor user ID">
          <Input className="min-h-11" value={header.assignedSupervisor} onChange={(event) => setHeader({ ...header, assignedSupervisor: event.target.value })} />
        </Field>
        <Field label="Remarks">
          <Textarea value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save schedule</Button>
    </div>
  );
}

export function BatchPlanForm() {
  return (
    <RequirePermission permission="batchPlan:create">
      <BatchPlanInner />
    </RequirePermission>
  );
}

function BatchPlanInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    productionPlanId: "",
    productId: "",
    requiredQuantity: "",
    batchSize: "",
    uom: "",
    targetYield: "100",
    manufacturingSite: "",
    plannedStart: "",
    plannedEnd: "",
    roundingRule: "ceil",
    remarks: "",
  });

  async function submit() {
    try {
      const result = await createProduction("batchPlans", {
        ...header,
        requiredQuantity: Number(header.requiredQuantity),
        batchSize: Number(header.batchSize),
        targetYield: Number(header.targetYield),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Batch plan created");
      router.push(`/production/batch-planning/${result.id}`);
    } catch (error) {
      toast.error("Unable to save batch plan", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New batch plan" description="Required quantity and batch size determine planned batch count using configurable rounding." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <ResourcePick resource="plans" label="Production plan" value={header.productionPlanId} onChange={(productionPlanId) => setHeader({ ...header, productionPlanId })} nameKey="planNumber" />
        <MasterPick entity="products" label="Product" required value={header.productId} onChange={(productId) => setHeader({ ...header, productId })} />
        <Field label="Required quantity">
          <Input className="min-h-11" type="number" value={header.requiredQuantity} onChange={(event) => setHeader({ ...header, requiredQuantity: event.target.value })} />
        </Field>
        <Field label="Batch size">
          <Input className="min-h-11" type="number" value={header.batchSize} onChange={(event) => setHeader({ ...header, batchSize: event.target.value })} />
        </Field>
        <MasterPick entity="uoms" label="UOM" required value={header.uom} onChange={(uom) => setHeader({ ...header, uom })} />
        <Field label="Rounding">
          <Select value={header.roundingRule} onValueChange={(roundingRule) => setHeader({ ...header, roundingRule })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ceil">Ceil</SelectItem>
              <SelectItem value="floor">Floor</SelectItem>
              <SelectItem value="nearest">Nearest</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Target yield %">
          <Input className="min-h-11" type="number" value={header.targetYield} onChange={(event) => setHeader({ ...header, targetYield: event.target.value })} />
        </Field>
        <Field label="Remarks">
          <Textarea value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save batch plan</Button>
    </div>
  );
}

export function BomForm() {
  return (
    <RequirePermission permission="bom:create">
      <BomInner />
    </RequirePermission>
  );
}

function BomInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    productId: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    batchSize: "",
    uom: "",
    remarks: "",
    processSteps: DEFAULT_PROCESS_STEPS.join("\n"),
  });
  const [items, setItems] = useState([{ materialId: "", quantity: "", uom: "", percentage: "", sequence: "1", materialStage: "raw_material", processStep: "", wastageAllowance: "0", remarks: "" }]);

  async function submit() {
    try {
      const result = await createProduction("boms", {
        ...header,
        batchSize: Number(header.batchSize),
        processSteps: header.processSteps.split("\n").map((step) => step.trim()).filter(Boolean),
        idempotencyKey: crypto.randomUUID(),
        items: items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          percentage: item.percentage ? Number(item.percentage) : undefined,
          sequence: Number(item.sequence || 1),
          wastageAllowance: Number(item.wastageAllowance || 0),
        })),
      });
      toast.success("Draft BOM created");
      router.push(`/production/boms/${result.id}`);
    } catch (error) {
      toast.error("Unable to save BOM", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New BOM / formula" description="Version-controlled manufacturing formula. Approved versions are never overwritten." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="products" label="Product" required value={header.productId} onChange={(productId) => setHeader({ ...header, productId })} />
        <Field label="Batch size">
          <Input className="min-h-11" type="number" value={header.batchSize} onChange={(event) => setHeader({ ...header, batchSize: event.target.value })} />
        </Field>
        <MasterPick entity="uoms" label="UOM" required value={header.uom} onChange={(uom) => setHeader({ ...header, uom })} />
        <Field label="Effective date">
          <Input className="min-h-11" type="date" value={header.effectiveDate} onChange={(event) => setHeader({ ...header, effectiveDate: event.target.value })} />
        </Field>
        <Field label="Expiry date">
          <Input className="min-h-11" type="date" value={header.expiryDate} onChange={(event) => setHeader({ ...header, expiryDate: event.target.value })} />
        </Field>
        <Field label="Process steps (one per line)">
          <Textarea rows={6} value={header.processSteps} onChange={(event) => setHeader({ ...header, processSteps: event.target.value })} />
        </Field>
      </div>
      <LineEditor
        items={items}
        blank={{ materialId: "", quantity: "", uom: "", percentage: "", sequence: String(items.length + 1), materialStage: "raw_material", processStep: "", wastageAllowance: "0", remarks: "" }}
        onChange={setItems}
        render={(item, index, update) => (
          <>
            <MasterPick entity="materials" label="Material" required value={item.materialId} onChange={(materialId) => update(index, { materialId })} />
            <Field label="Quantity">
              <Input className="min-h-11" type="number" value={item.quantity} onChange={(event) => update(index, { quantity: event.target.value })} />
            </Field>
            <MasterPick entity="uoms" label="UOM" required value={item.uom} onChange={(uom) => update(index, { uom })} />
            <Field label="Stage">
              <Select value={item.materialStage} onValueChange={(materialStage) => update(index, { materialStage })}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {materialStageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Wastage %">
              <Input className="min-h-11" type="number" value={item.wastageAllowance} onChange={(event) => update(index, { wastageAllowance: event.target.value })} />
            </Field>
            <Field label="Sequence">
              <Input className="min-h-11" type="number" value={item.sequence} onChange={(event) => update(index, { sequence: event.target.value })} />
            </Field>
          </>
        )}
      />
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save draft BOM</Button>
    </div>
  );
}

export function ManufacturingOrderForm() {
  return (
    <RequirePermission permission="manufacturingOrder:create">
      <MoInner />
    </RequirePermission>
  );
}

function MoInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    productionPlanId: "",
    scheduleId: "",
    productId: "",
    customerId: "",
    plannedQuantity: "",
    batchSize: "",
    uom: "",
    plannedStartDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date().toISOString().slice(0, 10),
    workCenterId: "",
    warehouseId: "",
    priority: "normal",
    supervisor: "",
    remarks: "",
  });

  async function submit() {
    try {
      const result = await createProduction("orders", {
        ...header,
        plannedQuantity: Number(header.plannedQuantity),
        batchSize: Number(header.batchSize),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(`Manufacturing order created with batch ${String((result.record as { batchNumber?: string }).batchNumber || "")}`);
      router.push(`/production/orders/${result.id}`);
    } catch (error) {
      toast.error("Unable to save manufacturing order", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New manufacturing order" description="Server-generated unique batch number. An effective BOM is required." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="products" label="Product" required value={header.productId} onChange={(productId) => setHeader({ ...header, productId })} />
        <MasterPick entity="customers" label="Customer" value={header.customerId} onChange={(customerId) => setHeader({ ...header, customerId })} />
        <Field label="Planned quantity">
          <Input className="min-h-11" type="number" value={header.plannedQuantity} onChange={(event) => setHeader({ ...header, plannedQuantity: event.target.value })} />
        </Field>
        <Field label="Batch size">
          <Input className="min-h-11" type="number" value={header.batchSize} onChange={(event) => setHeader({ ...header, batchSize: event.target.value })} />
        </Field>
        <MasterPick entity="uoms" label="UOM" required value={header.uom} onChange={(uom) => setHeader({ ...header, uom })} />
        <ResourcePick resource="workCenters" label="Work center" value={header.workCenterId} onChange={(workCenterId) => setHeader({ ...header, workCenterId })} nameKey="workCenterName" />
        <MasterPick entity="warehouses" label="Warehouse" value={header.warehouseId} onChange={(warehouseId) => setHeader({ ...header, warehouseId })} />
        <Field label="Planned start">
          <Input className="min-h-11" type="date" value={header.plannedStartDate} onChange={(event) => setHeader({ ...header, plannedStartDate: event.target.value })} />
        </Field>
        <Field label="Planned end">
          <Input className="min-h-11" type="date" value={header.plannedEndDate} onChange={(event) => setHeader({ ...header, plannedEndDate: event.target.value })} />
        </Field>
        <ResourcePick resource="plans" label="Production plan" value={header.productionPlanId} onChange={(productionPlanId) => setHeader({ ...header, productionPlanId })} nameKey="planNumber" />
        <ResourcePick resource="schedules" label="Schedule" value={header.scheduleId} onChange={(scheduleId) => setHeader({ ...header, scheduleId })} nameKey="scheduleNumber" />
        <Field label="Supervisor user ID">
          <Input className="min-h-11" value={header.supervisor} onChange={(event) => setHeader({ ...header, supervisor: event.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Create order</Button>
    </div>
  );
}

export function DispensingForm() {
  return (
    <RequirePermission permission="dispensingRequest:create">
      <DispensingInner />
    </RequirePermission>
  );
}

function DispensingInner() {
  const router = useRouter();
  const [header, setHeader] = useState({ manufacturingOrderId: "", warehouseId: "", requiredDate: new Date().toISOString().slice(0, 10), remarks: "" });

  async function submit() {
    try {
      const result = await createProduction("dispensing", { ...header, idempotencyKey: crypto.randomUUID() });
      toast.success("Dispensing request created. Stock was not consumed.");
      router.push(`/production/dispensing/${result.id}`);
    } catch (error) {
      toast.error("Unable to save dispensing request", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New dispensing request" description="Planning foundation only. Inventory is not issued at request creation." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <ResourcePick resource="orders" label="Manufacturing order" required value={header.manufacturingOrderId} onChange={(manufacturingOrderId) => setHeader({ ...header, manufacturingOrderId })} nameKey="manufacturingOrderNumber" />
        <MasterPick entity="warehouses" label="Warehouse" required value={header.warehouseId} onChange={(warehouseId) => setHeader({ ...header, warehouseId })} />
        <Field label="Required date">
          <Input className="min-h-11" type="date" value={header.requiredDate} onChange={(event) => setHeader({ ...header, requiredDate: event.target.value })} />
        </Field>
        <Field label="Remarks">
          <Textarea value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Create request</Button>
    </div>
  );
}

export function WorkCenterForm() {
  return (
    <RequirePermission permission="production:create">
      <WorkCenterInner />
    </RequirePermission>
  );
}

function WorkCenterInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    workCenterCode: "",
    workCenterName: "",
    plantId: "",
    departmentId: "",
    workCenterType: "other",
    capacity: "",
    uom: "",
    supervisor: "",
    description: "",
  });

  async function submit() {
    try {
      const result = await createProduction("workCenters", { ...header, capacity: header.capacity ? Number(header.capacity) : undefined });
      toast.success("Work center created");
      router.push(`/production/work-centers/${result.id}`);
    } catch (error) {
      toast.error("Unable to save work center", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New work center" description="Configurable manufacturing work center types." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="Code"><Input className="min-h-11" value={header.workCenterCode} onChange={(event) => setHeader({ ...header, workCenterCode: event.target.value })} /></Field>
        <Field label="Name"><Input className="min-h-11" value={header.workCenterName} onChange={(event) => setHeader({ ...header, workCenterName: event.target.value })} /></Field>
        <MasterPick entity="plants" label="Plant" required value={header.plantId} onChange={(plantId) => setHeader({ ...header, plantId })} />
        <MasterPick entity="departments" label="Department" value={header.departmentId} onChange={(departmentId) => setHeader({ ...header, departmentId })} />
        <Field label="Type">
          <Select value={header.workCenterType} onValueChange={(workCenterType) => setHeader({ ...header, workCenterType })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {workCenterTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Capacity"><Input className="min-h-11" type="number" value={header.capacity} onChange={(event) => setHeader({ ...header, capacity: event.target.value })} /></Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save work center</Button>
    </div>
  );
}

export function EquipmentForm() {
  return (
    <RequirePermission permission="production:create">
      <EquipmentInner />
    </RequirePermission>
  );
}

function EquipmentInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    equipmentCode: "",
    equipmentName: "",
    workCenterId: "",
    qualificationStatus: "qualified",
    calibrationStatus: "current",
    status: "active",
  });

  async function submit() {
    try {
      const result = await createProduction("equipment", header);
      toast.success("Equipment created");
      router.push(`/production/equipment/${result.id}`);
    } catch (error) {
      toast.error("Unable to save equipment", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New equipment" description="Assignment foundation. Inactive, unqualified, or calibration-expired equipment cannot be selected later." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="Code"><Input className="min-h-11" value={header.equipmentCode} onChange={(event) => setHeader({ ...header, equipmentCode: event.target.value })} /></Field>
        <Field label="Name"><Input className="min-h-11" value={header.equipmentName} onChange={(event) => setHeader({ ...header, equipmentName: event.target.value })} /></Field>
        <ResourcePick resource="workCenters" label="Work center" value={header.workCenterId} onChange={(workCenterId) => setHeader({ ...header, workCenterId })} nameKey="workCenterName" />
        <Field label="Qualification">
          <Input className="min-h-11" value={header.qualificationStatus} onChange={(event) => setHeader({ ...header, qualificationStatus: event.target.value })} />
        </Field>
        <Field label="Calibration">
          <Input className="min-h-11" value={header.calibrationStatus} onChange={(event) => setHeader({ ...header, calibrationStatus: event.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save equipment</Button>
    </div>
  );
}

export function BmrForm() {
  return (
    <RequirePermission permission="bmr:create">
      <BmrInner />
    </RequirePermission>
  );
}

function BmrInner() {
  const router = useRouter();
  const [manufacturingOrderId, setManufacturingOrderId] = useState("");

  async function submit() {
    try {
      const result = await createProduction("bmrs", { manufacturingOrderId, idempotencyKey: crypto.randomUUID() });
      toast.success("BMR issued");
      router.push(`/production/records/${result.id}`);
    } catch (error) {
      toast.error("Unable to create BMR", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="Issue BMR" description="Creates a batch manufacturing record linked to the manufacturing order and BOM version." />
      <div className="mb-6 max-w-xl">
        <ResourcePick resource="orders" label="Manufacturing order" required value={manufacturingOrderId} onChange={setManufacturingOrderId} nameKey="manufacturingOrderNumber" />
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Issue BMR</Button>
    </div>
  );
}

export function IpcForm() {
  return (
    <RequirePermission permission="ipc:create">
      <IpcInner />
    </RequirePermission>
  );
}

function IpcInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    bmrId: "",
    processStepId: "",
    parameter: "",
    specification: "",
    target: "",
    actual: "",
    uom: "",
    result: "pending",
    remarks: "",
  });

  async function submit() {
    try {
      await createProduction("ipc", header);
      toast.success("IPC recorded. No QC specification was invented.");
      router.push("/production/ipc");
    } catch (error) {
      toast.error("Unable to record IPC", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="Record in-process check" description="Foundation only. Specifications should come from a future QC module." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <ResourcePick resource="bmrs" label="BMR" required value={header.bmrId} onChange={(bmrId) => setHeader({ ...header, bmrId })} nameKey="bmrNumber" />
        <Field label="Parameter"><Input className="min-h-11" value={header.parameter} onChange={(event) => setHeader({ ...header, parameter: event.target.value })} /></Field>
        <Field label="Specification"><Input className="min-h-11" value={header.specification} onChange={(event) => setHeader({ ...header, specification: event.target.value })} /></Field>
        <Field label="Target"><Input className="min-h-11" value={header.target} onChange={(event) => setHeader({ ...header, target: event.target.value })} /></Field>
        <Field label="Actual"><Input className="min-h-11" value={header.actual} onChange={(event) => setHeader({ ...header, actual: event.target.value })} /></Field>
        <MasterPick entity="uoms" label="UOM" value={header.uom} onChange={(uom) => setHeader({ ...header, uom })} />
        <Field label="Result">
          <Select value={header.result} onValueChange={(result) => setHeader({ ...header, result })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Record IPC</Button>
    </div>
  );
}

export function YieldForm() {
  return (
    <RequirePermission permission="yield:create">
      <YieldInner />
    </RequirePermission>
  );
}

function YieldInner() {
  const [header, setHeader] = useState({
    manufacturingOrderId: "",
    theoreticalQuantity: "",
    actualQuantity: "",
    acceptableMin: "95",
    acceptableMax: "105",
    remarks: "",
  });

  async function submit() {
    try {
      await createProduction("yields", {
        ...header,
        theoreticalQuantity: Number(header.theoreticalQuantity),
        actualQuantity: Number(header.actualQuantity),
        acceptableMin: Number(header.acceptableMin),
        acceptableMax: Number(header.acceptableMax),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Yield recorded");
    } catch (error) {
      toast.error("Unable to record yield", publicMasterError(error));
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-4 text-base font-semibold">Record yield</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <ResourcePick resource="orders" label="Manufacturing order" required value={header.manufacturingOrderId} onChange={(manufacturingOrderId) => setHeader({ ...header, manufacturingOrderId })} nameKey="manufacturingOrderNumber" />
        <Field label="Theoretical"><Input className="min-h-11" type="number" value={header.theoreticalQuantity} onChange={(event) => setHeader({ ...header, theoreticalQuantity: event.target.value })} /></Field>
        <Field label="Actual"><Input className="min-h-11" type="number" value={header.actualQuantity} onChange={(event) => setHeader({ ...header, actualQuantity: event.target.value })} /></Field>
        <Field label="Acceptable min %"><Input className="min-h-11" type="number" value={header.acceptableMin} onChange={(event) => setHeader({ ...header, acceptableMin: event.target.value })} /></Field>
        <Field label="Acceptable max %"><Input className="min-h-11" type="number" value={header.acceptableMax} onChange={(event) => setHeader({ ...header, acceptableMax: event.target.value })} /></Field>
      </div>
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save yield</Button>
    </div>
  );
}

export function ReconciliationForm() {
  return (
    <RequirePermission permission="reconciliation:create">
      <ReconInner />
    </RequirePermission>
  );
}

function ReconInner() {
  const [header, setHeader] = useState({
    manufacturingOrderId: "",
    materialId: "",
    issuedQuantity: "",
    returnedQuantity: "0",
    consumedQuantity: "",
    wastageQuantity: "0",
    expectedQuantity: "",
    remarks: "",
  });

  async function submit() {
    try {
      await createProduction("reconciliations", {
        ...header,
        issuedQuantity: Number(header.issuedQuantity),
        returnedQuantity: Number(header.returnedQuantity),
        consumedQuantity: Number(header.consumedQuantity),
        wastageQuantity: Number(header.wastageQuantity),
        expectedQuantity: Number(header.expectedQuantity),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Reconciliation recorded");
    } catch (error) {
      toast.error("Unable to record reconciliation", publicMasterError(error));
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-4 text-base font-semibold">Record reconciliation</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <ResourcePick resource="orders" label="Manufacturing order" required value={header.manufacturingOrderId} onChange={(manufacturingOrderId) => setHeader({ ...header, manufacturingOrderId })} nameKey="manufacturingOrderNumber" />
        <MasterPick entity="materials" label="Material" required value={header.materialId} onChange={(materialId) => setHeader({ ...header, materialId })} />
        <Field label="Issued"><Input className="min-h-11" type="number" value={header.issuedQuantity} onChange={(event) => setHeader({ ...header, issuedQuantity: event.target.value })} /></Field>
        <Field label="Returned"><Input className="min-h-11" type="number" value={header.returnedQuantity} onChange={(event) => setHeader({ ...header, returnedQuantity: event.target.value })} /></Field>
        <Field label="Consumed"><Input className="min-h-11" type="number" value={header.consumedQuantity} onChange={(event) => setHeader({ ...header, consumedQuantity: event.target.value })} /></Field>
        <Field label="Wastage"><Input className="min-h-11" type="number" value={header.wastageQuantity} onChange={(event) => setHeader({ ...header, wastageQuantity: event.target.value })} /></Field>
        <Field label="Expected"><Input className="min-h-11" type="number" value={header.expectedQuantity} onChange={(event) => setHeader({ ...header, expectedQuantity: event.target.value })} /></Field>
      </div>
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save reconciliation</Button>
    </div>
  );
}

export function WastageForm() {
  const [header, setHeader] = useState({
    bmrId: "",
    materialId: "",
    quantity: "",
    uom: "",
    reason: "process_loss",
    remarks: "",
  });

  async function submit() {
    try {
      await createProduction("wastage", {
        ...header,
        quantity: Number(header.quantity),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Wastage recorded");
    } catch (error) {
      toast.error("Unable to record wastage", publicMasterError(error));
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-4 text-base font-semibold">Record wastage</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <ResourcePick resource="bmrs" label="BMR" required value={header.bmrId} onChange={(bmrId) => setHeader({ ...header, bmrId })} nameKey="bmrNumber" />
        <MasterPick entity="materials" label="Material" value={header.materialId} onChange={(materialId) => setHeader({ ...header, materialId })} />
        <Field label="Quantity"><Input className="min-h-11" type="number" value={header.quantity} onChange={(event) => setHeader({ ...header, quantity: event.target.value })} /></Field>
        <MasterPick entity="uoms" label="UOM" required value={header.uom} onChange={(uom) => setHeader({ ...header, uom })} />
        <Field label="Reason">
          <Select value={header.reason} onValueChange={(reason) => setHeader({ ...header, reason })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {wastageReasonOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save wastage</Button>
    </div>
  );
}

export function DeviationForm() {
  return (
    <RequirePermission permission="productionDeviation:create">
      <DeviationInner />
    </RequirePermission>
  );
}

function DeviationInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    manufacturingOrderId: "",
    bmrId: "",
    batchNumber: "",
    processStep: "",
    description: "",
    severity: "minor",
    immediateAction: "",
    remarks: "",
  });

  async function submit() {
    try {
      const result = await createProduction("deviations", header);
      toast.success("Deviation recorded. Full CAPA is a future QA module.");
      router.push(`/production/deviations/${result.id}`);
    } catch (error) {
      toast.error("Unable to save deviation", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New production deviation" description="Foundation only. CAPA belongs to a future QA module." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <ResourcePick resource="orders" label="Manufacturing order" value={header.manufacturingOrderId} onChange={(manufacturingOrderId) => setHeader({ ...header, manufacturingOrderId })} nameKey="manufacturingOrderNumber" />
        <ResourcePick resource="bmrs" label="BMR" value={header.bmrId} onChange={(bmrId) => setHeader({ ...header, bmrId })} nameKey="bmrNumber" />
        <Field label="Batch number"><Input className="min-h-11" value={header.batchNumber} onChange={(event) => setHeader({ ...header, batchNumber: event.target.value })} /></Field>
        <Field label="Process step"><Input className="min-h-11" value={header.processStep} onChange={(event) => setHeader({ ...header, processStep: event.target.value })} /></Field>
        <Field label="Severity">
          <Select value={header.severity} onValueChange={(severity) => setHeader({ ...header, severity })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea value={header.description} onChange={(event) => setHeader({ ...header, description: event.target.value })} />
        </Field>
        <Field label="Immediate action">
          <Textarea value={header.immediateAction} onChange={(event) => setHeader({ ...header, immediateAction: event.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save deviation</Button>
    </div>
  );
}

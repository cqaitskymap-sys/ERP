import { queryMasterDocuments, type AtomicWrite, type MasterRecord } from "@/lib/masters/firestore";
import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { WORKFLOW_MODULES } from "@/lib/procurement/config";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/procurement/helpers";
import { hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { WorkflowStep } from "@/types/masters";
import type { AppRole } from "@/types/permissions";

export type ProcurementWorkflowModule = (typeof WORKFLOW_MODULES)[keyof typeof WORKFLOW_MODULES];

const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  purchase_requisition: [
    { sequence: 1, role: "department_head", approvalType: "approve", required: true, label: "Department Head" },
    { sequence: 2, role: "purchase", approvalType: "approve", required: true, label: "Purchase" },
  ],
  purchase_order: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Finance" },
    { sequence: 2, role: "management", approvalType: "approve", required: true, label: "Management" },
  ],
  vendor_selection: [
    { sequence: 1, role: "department_head", approvalType: "approve", required: true, label: "Department Review" },
  ],
  purchase_order_amendment: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Finance" },
  ],
};

export async function loadWorkflowConfig(module: string, idToken: string) {
  const rows = await queryMasterDocuments("approvalWorkflows", idToken, {
    filters: [
      { field: "module", value: module },
      { field: "status", value: "active" },
    ],
    limit: 5,
  });
  const configured = rows[0];
  const steps = Array.isArray(configured?.steps) && configured.steps.length
    ? (configured.steps as WorkflowStep[]).slice().sort((a, b) => Number(a.sequence) - Number(b.sequence))
    : DEFAULT_STEPS[module] || DEFAULT_STEPS.purchase_requisition;
  return {
    workflowId: configured ? String(configured.id) : `default:${module}`,
    allowSelfApproval: Boolean(configured?.allowSelfApproval),
    steps,
  };
}

export function assertSeparationOfDuties(
  session: SessionPayload,
  requestedBy: string,
  allowSelfApproval: boolean
) {
  if (!allowSelfApproval && requestedBy && requestedBy === session.uid) {
    fail("Separation of duties: the requester cannot approve this record unless the workflow allows self-approval.");
  }
}

export function createApprovalWrites(options: {
  documentType: string;
  documentId: string;
  documentNumber: string;
  requestedBy: string;
  steps: WorkflowStep[];
  session: SessionPayload;
}) {
  return options.steps.map((step, index) => {
    const id = crypto.randomUUID();
    return writeOf(
      PROCUREMENT_COLLECTIONS.approvals,
      id,
      {
        approvalId: id,
        documentType: options.documentType,
        documentId: options.documentId,
        documentNumber: options.documentNumber,
        step: step.sequence || index + 1,
        role: step.role,
        label: step.label || step.role,
        approvalType: step.approvalType || "approve",
        required: step.required !== false,
        status: "pending",
        action: "",
        comment: "",
        approver: "",
        requestedBy: options.requestedBy,
        timestamp: "",
        ...actorStamp(options.session),
      },
      { exists: false }
    );
  });
}

export async function loadApprovals(documentId: string, idToken: string) {
  const rows = await listByField(PROCUREMENT_COLLECTIONS.approvals, "documentId", documentId, idToken, 50);
  return rows.slice().sort((a, b) => Number(a.step || 0) - Number(b.step || 0));
}

export function currentPendingStep(approvals: MasterRecord[]) {
  return approvals.find((row) => text(row.status) === "pending");
}

export function applyApprovalAction(options: {
  approvals: MasterRecord[];
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  allowSelfApproval: boolean;
  requestedBy: string;
}): { writes: AtomicWrite[]; completed: boolean; rejected: boolean; returned: boolean; current?: MasterRecord } {
  assertSeparationOfDuties(options.session, options.requestedBy, options.allowSelfApproval);
  const pending = currentPendingStep(options.approvals);
  if (!pending) fail("There is no pending approval step.");
  if (!hasRole(options.session.roles, String(pending.role) as AppRole) && !hasRole(options.session.roles, ["admin", "super_admin"])) {
    fail(`This step requires the ${pending.label || pending.role} role.`);
  }
  if (options.action !== "approve" && !text(options.comment)) {
    fail("A comment is required when rejecting or returning a request.");
  }
  const now = new Date().toISOString();
  const current = {
    ...pending,
    status: options.action === "approve" ? "approved" : options.action === "reject" ? "rejected" : "returned",
    action: options.action,
    comment: options.comment || "",
    approver: options.session.uid,
    timestamp: now,
    updatedBy: options.session.uid,
    updatedAt: now,
  };
  const writes = [writeOf(PROCUREMENT_COLLECTIONS.approvals, String(pending.id), current)];
  if (options.action === "reject") {
    return { writes, completed: false, rejected: true, returned: false, current };
  }
  if (options.action === "return") {
    return { writes, completed: false, rejected: false, returned: true, current };
  }
  const remaining = options.approvals.filter(
    (row) => String(row.id) !== String(pending.id) && text(row.status) === "pending"
  );
  return { writes, completed: remaining.length === 0, rejected: false, returned: false, current };
}

import { queryMasterDocuments, type AtomicWrite, type MasterRecord } from "@/lib/masters/firestore";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { WORKFLOW_MODULES } from "@/lib/production/config";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/production/helpers";
import { hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { WorkflowStep } from "@/types/masters";
import type { AppRole } from "@/types/permissions";

const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  production_plan: [
    { sequence: 1, role: "department_head", approvalType: "approve", required: true, label: "Department Head" },
    { sequence: 2, role: "production", approvalType: "approve", required: true, label: "Production" },
  ],
  bom: [
    { sequence: 1, role: "production", approvalType: "approve", required: true, label: "Production Review" },
    { sequence: 2, role: "qa", approvalType: "approve", required: true, label: "QA Review" },
  ],
  manufacturing_order: [
    { sequence: 1, role: "department_head", approvalType: "approve", required: true, label: "Department Head" },
    { sequence: 2, role: "qa", approvalType: "approve", required: true, label: "QA" },
  ],
  dispensing_request: [
    { sequence: 1, role: "warehouse", approvalType: "approve", required: true, label: "Warehouse" },
  ],
  yield: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA" }],
  reconciliation: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA" }],
  wastage: [{ sequence: 1, role: "department_head", approvalType: "approve", required: true, label: "Department Head" }],
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
  const steps =
    Array.isArray(configured?.steps) && configured.steps.length
      ? (configured.steps as WorkflowStep[]).slice().sort((a, b) => Number(a.sequence) - Number(b.sequence))
      : DEFAULT_STEPS[module] || DEFAULT_STEPS.production_plan;
  return {
    workflowId: configured ? String(configured.id) : `default:${module}`,
    allowSelfApproval: Boolean(configured?.allowSelfApproval),
    steps,
  };
}

export function approvalCollection(documentType: string) {
  return documentType === "bom" ? PRODUCTION_COLLECTIONS.bomApprovals : PRODUCTION_COLLECTIONS.approvals;
}

export function createApprovalWrites(options: {
  documentType: string;
  documentId: string;
  documentNumber: string;
  requestedBy: string;
  steps: WorkflowStep[];
  session: SessionPayload;
}) {
  const collection = approvalCollection(options.documentType);
  return options.steps.map((step, index) => {
    const id = crypto.randomUUID();
    return writeOf(
      collection,
      id,
      {
        approvalId: id,
        documentType: options.documentType,
        documentId: options.documentId,
        documentNumber: options.documentNumber,
        step: step.sequence || index + 1,
        role: step.role,
        label: step.label || step.role,
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

export async function loadApprovals(documentType: string, documentId: string, idToken: string) {
  const rows = await listByField(approvalCollection(documentType), "documentId", documentId, idToken, 50);
  return rows.slice().sort((a, b) => Number(a.step || 0) - Number(b.step || 0));
}

export function applyApprovalAction(options: {
  documentType: string;
  approvals: MasterRecord[];
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  allowSelfApproval: boolean;
  requestedBy: string;
}): { writes: AtomicWrite[]; completed: boolean; rejected: boolean; returned: boolean } {
  if (!options.allowSelfApproval && options.requestedBy && options.requestedBy === options.session.uid) {
    fail("Separation of duties: the requester cannot approve this record unless the workflow allows self-approval.");
  }
  const pending = options.approvals.find((row) => text(row.status) === "pending");
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
  const writes = [writeOf(approvalCollection(options.documentType), String(pending.id), current)];
  if (options.action === "reject") return { writes, completed: false, rejected: true, returned: false };
  if (options.action === "return") return { writes, completed: false, rejected: false, returned: true };
  const remaining = options.approvals.filter((row) => String(row.id) !== String(pending.id) && text(row.status) === "pending");
  return { writes, completed: remaining.length === 0, rejected: false, returned: false };
}

export { WORKFLOW_MODULES };

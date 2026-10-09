import { queryMasterDocuments, type MasterRecord } from "@/lib/masters/firestore";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { WORKFLOW_MODULES } from "@/lib/sales/config";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/sales/helpers";
import { hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { WorkflowStep } from "@/types/masters";
import type { AppRole } from "@/types/permissions";

export type SalesWorkflowModule = (typeof WORKFLOW_MODULES)[keyof typeof WORKFLOW_MODULES];

const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  sales_quotation: [
    { sequence: 1, role: "sales", approvalType: "approve", required: true, label: "Sales Manager" },
  ],
  sales_order: [
    { sequence: 1, role: "sales", approvalType: "approve", required: true, label: "Sales Manager" },
    { sequence: 2, role: "finance", approvalType: "approve", required: false, label: "Finance Review" },
    { sequence: 3, role: "qa", approvalType: "approve", required: false, label: "QA / Regulatory Review" },
  ],
  sales_return: [
    { sequence: 1, role: "sales", approvalType: "approve", required: true, label: "Sales Review" },
    { sequence: 2, role: "qa", approvalType: "approve", required: false, label: "QA Assessment" },
  ],
  contract_manufacturing_order: [
    { sequence: 1, role: "production", approvalType: "approve", required: true, label: "Technical Review" },
    { sequence: 2, role: "regulatory", approvalType: "approve", required: false, label: "Regulatory Review" },
    { sequence: 3, role: "qa", approvalType: "approve", required: true, label: "QA Review" },
    { sequence: 4, role: "sales", approvalType: "approve", required: true, label: "Commercial Confirmation" },
  ],
  sales_credit_override: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Finance Credit Override" },
    { sequence: 2, role: "management", approvalType: "approve", required: true, label: "Management" },
  ],
  sales_price_list: [
    { sequence: 1, role: "sales", approvalType: "approve", required: true, label: "Sales Pricing" },
    { sequence: 2, role: "finance", approvalType: "approve", required: false, label: "Finance" },
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
  const steps =
    Array.isArray(configured?.steps) && configured.steps.length
      ? (configured.steps as WorkflowStep[]).slice().sort((a, b) => Number(a.sequence) - Number(b.sequence))
      : DEFAULT_STEPS[module] || DEFAULT_STEPS.sales_order;
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
      SALES_COLLECTIONS.orderApprovals,
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
  const rows = await listByField(SALES_COLLECTIONS.orderApprovals, "documentId", documentId, idToken, 50);
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
}) {
  const pending = currentPendingStep(options.approvals);
  if (!pending) fail("There is no pending approval step.");
  assertSeparationOfDuties(options.session, text(pending.requestedBy), options.allowSelfApproval);
  const role = text(pending.role) as AppRole;
  if (role && !hasRole(options.session.roles, [role, "admin", "super_admin", "management"])) {
    fail(`This approval step requires the ${pending.label || role} role.`);
  }
  const now = new Date().toISOString();
  const updated = options.approvals.map((row) => {
    if (String(row.id) !== String(pending.id)) return row;
    return {
      ...row,
      status: options.action === "approve" ? "approved" : options.action === "reject" ? "rejected" : "returned",
      action: options.action,
      comment: options.comment || "",
      approver: options.session.uid,
      timestamp: now,
      updatedBy: options.session.uid,
      updatedAt: now,
    };
  });
  const writes = [
    writeOf(SALES_COLLECTIONS.orderApprovals, String(pending.id), {
      ...updated.find((row) => String(row.id) === String(pending.id))!,
    }),
  ];
  const remainingRequired = updated.filter(
    (row) => text(row.status) === "pending" && row.required !== false
  );
  return {
    writes,
    approvals: updated,
    completed: options.action === "approve" && remainingRequired.length === 0,
    rejected: options.action === "reject",
    returned: options.action === "return",
    pendingNext: remainingRequired[0] || null,
  };
}

/** Filter default steps based on order risk flags. */
export function filterOrderApprovalSteps(
  steps: WorkflowStep[],
  flags: {
    requireFinance?: boolean;
    requireQa?: boolean;
    requireRegulatory?: boolean;
  }
) {
  return steps.filter((step) => {
    const role = text(step.role);
    if (role === "finance" && !flags.requireFinance && step.required === false) return false;
    if ((role === "qa" || role === "regulatory") && !flags.requireQa && !flags.requireRegulatory && step.required === false) {
      return false;
    }
    if (role === "regulatory" && !flags.requireRegulatory && step.required === false) return false;
    return true;
  });
}

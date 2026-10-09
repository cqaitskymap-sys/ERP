import { queryMasterDocuments, type MasterRecord } from "@/lib/masters/firestore";
import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import { WORKFLOW_MODULES } from "@/lib/finance/config";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/finance/helpers";
import { hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { WorkflowStep } from "@/types/masters";
import type { AppRole } from "@/types/permissions";

export type FinanceWorkflowModule = (typeof WORKFLOW_MODULES)[keyof typeof WORKFLOW_MODULES];

const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  finance_journal_entry: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Finance Review" },
  ],
  finance_supplier_invoice: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "AP Approval" },
  ],
  finance_payment_proposal: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Payment Approval" },
    { sequence: 2, role: "management", approvalType: "approve", required: false, label: "Management" },
  ],
  finance_payment_execution: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Payment Execution Confirmation" },
  ],
  finance_customer_invoice: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "AR Approval" },
  ],
  finance_credit_note: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Credit Note Approval" },
  ],
  finance_bank_reconciliation: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Reconciliation Approval" },
  ],
  finance_budget: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Budget Approval" },
    { sequence: 2, role: "management", approvalType: "approve", required: true, label: "Management" },
  ],
  finance_expense_claim: [
    { sequence: 1, role: "department_head", approvalType: "approve", required: true, label: "Department Head" },
    { sequence: 2, role: "finance", approvalType: "approve", required: true, label: "Finance" },
  ],
  finance_period_close: [
    { sequence: 1, role: "finance", approvalType: "approve", required: true, label: "Period Close" },
    { sequence: 2, role: "management", approvalType: "approve", required: true, label: "Management" },
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
      : DEFAULT_STEPS[module] || DEFAULT_STEPS.finance_journal_entry;
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
  collection?: string;
}) {
  const collection = options.collection || FINANCE_COLLECTIONS.audit;
  return options.steps.map((step, index) => {
    const id = crypto.randomUUID();
    return writeOf(
      collection === FINANCE_COLLECTIONS.audit ? "financeApprovals" : collection,
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

/** Dedicated approvals collection used by finance workflows. */
export const FINANCE_APPROVALS_COLLECTION = "financeApprovals";

export async function loadApprovals(documentId: string, idToken: string) {
  const rows = await listByField(FINANCE_APPROVALS_COLLECTION, "documentId", documentId, idToken, 50);
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
    writeOf(FINANCE_APPROVALS_COLLECTION, String(pending.id), {
      ...updated.find((row) => String(row.id) === String(pending.id))!,
    }),
  ];
  const remainingRequired = updated.filter((row) => text(row.status) === "pending" && row.required !== false);
  return {
    writes,
    approvals: updated,
    completed: options.action === "approve" && remainingRequired.length === 0,
    rejected: options.action === "reject",
    returned: options.action === "return",
    pendingNext: remainingRequired[0] || null,
  };
}

export function createFinanceApprovalWrites(options: {
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
      FINANCE_APPROVALS_COLLECTION,
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

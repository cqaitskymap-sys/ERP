import { queryMasterDocuments, type AtomicWrite } from "@/lib/masters/firestore";
import { QC_COLLECTIONS } from "@/lib/qc/collections";
import { QC_WORKFLOW_MODULES } from "@/lib/qc/config";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/qc/helpers";
import { hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { WorkflowStep } from "@/types/masters";
import type { AppRole } from "@/types/permissions";

const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  qc_sample_request: [{ sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC" }],
  qc_specification: [
    { sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC Review" },
    { sequence: 2, role: "qa", approvalType: "approve", required: true, label: "QA Review" },
  ],
  qc_test_method: [
    { sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC Review" },
    { sequence: 2, role: "qa", approvalType: "approve", required: true, label: "QA Review" },
  ],
  qc_test: [{ sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC Reviewer" }],
  qc_coa: [{ sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC Approval" }],
  qc_resampling: [{ sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC" }],
  qc_retest: [{ sequence: 1, role: "qc", approvalType: "approve", required: true, label: "QC" }],
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
      : DEFAULT_STEPS[module] || DEFAULT_STEPS.qc_test;
  return {
    workflowId: configured ? String(configured.id) : `default:${module}`,
    allowSelfApproval: Boolean(configured?.allowSelfApproval),
    steps,
  };
}

export function createApprovalWrites(options: {
  documentType: string;
  documentId: string;
  documentNumber: string;
  requestedBy: string;
  steps: WorkflowStep[];
  session: SessionPayload;
}): AtomicWrite[] {
  return options.steps.map((step, index) => {
    const id = crypto.randomUUID();
    return writeOf(
      QC_COLLECTIONS.approvals,
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
        ...actorStamp(options.session),
      },
      { exists: false }
    );
  });
}

export async function loadApprovals(documentType: string, documentId: string, idToken: string) {
  return listByField(QC_COLLECTIONS.approvals, "documentId", documentId, idToken);
}

export function applyApprovalAction(options: {
  documentType: string;
  approvals: Array<Record<string, unknown> & { id: string }>;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  allowSelfApproval: boolean;
  requestedBy: string;
}) {
  const pending = options.approvals
    .filter((row) => text(row.status) === "pending")
    .sort((a, b) => Number(a.step || 0) - Number(b.step || 0));
  const current = pending[0];
  if (!current) fail("No pending approval step was found.");
  if (!options.allowSelfApproval && options.requestedBy === options.session.uid && options.action === "approve") {
    fail("Separation of duties prevents self-approval.");
  }
  const requiredRole = text(current.role) as AppRole;
  if (requiredRole && !hasRole(options.session.roles, requiredRole) && !hasRole(options.session.roles, ["admin", "super_admin"])) {
    fail(`This step requires the ${requiredRole} role.`);
  }
  const nextStatus = options.action === "approve" ? "approved" : options.action === "return" ? "returned" : "rejected";
  const writes = [
    writeOf(QC_COLLECTIONS.approvals, current.id, {
      ...current,
      status: nextStatus,
      action: options.action,
      comment: options.comment || "",
      approver: options.session.uid,
      ...actorStamp(options.session, current),
    }),
  ];
  return {
    writes,
    completed: options.action === "approve" && pending.length === 1,
    rejected: options.action !== "approve",
  };
}

export { QC_WORKFLOW_MODULES };

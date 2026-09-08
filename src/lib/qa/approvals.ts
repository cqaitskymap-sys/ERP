import { queryMasterDocuments, type AtomicWrite } from "@/lib/masters/firestore";
import { QA_COLLECTIONS } from "@/lib/qa/collections";
import { QA_WORKFLOW_MODULES } from "@/lib/qa/config";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/qa/helpers";
import { hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { WorkflowStep } from "@/types/masters";
import type { AppRole } from "@/types/permissions";

const DEFAULT_STEPS: Record<string, WorkflowStep[]> = {
  qa_batch_release: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA Release" }],
  qa_batch_hold: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA Hold" }],
  qa_batch_reject: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA Rejection" }],
  qa_capa: [
    { sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA Review" },
    { sequence: 2, role: "qa", approvalType: "approve", required: true, label: "Effectiveness" },
  ],
  qa_change_control: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "QA Approval" }],
  qa_document: [{ sequence: 1, role: "qa", approvalType: "approve", required: true, label: "Document Approval" }],
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
      : DEFAULT_STEPS[module] || DEFAULT_STEPS.qa_batch_release;
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
      QA_COLLECTIONS.approvals,
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

export async function loadApprovals(documentId: string, idToken: string) {
  return listByField(QA_COLLECTIONS.approvals, "documentId", documentId, idToken);
}

export function assertSeparationOfDuties(options: {
  session: SessionPayload;
  manufacturedBy?: string;
  qcAnalystId?: string;
  qcApproverId?: string;
  allowSelfApproval: boolean;
}) {
  if (options.allowSelfApproval) return;
  const uid = options.session.uid;
  if (options.manufacturedBy && options.manufacturedBy === uid) {
    fail("Separation of duties prevents the manufacturing user from releasing this batch.");
  }
  if (options.qcAnalystId && options.qcAnalystId === uid) {
    fail("Separation of duties prevents the QC analyst from releasing this batch.");
  }
  if (options.qcApproverId && options.qcApproverId === uid) {
    fail("Separation of duties prevents the QC approver from performing QA release.");
  }
}

export function assertApproverRole(session: SessionPayload, role: string) {
  const required = text(role) as AppRole;
  if (required && !hasRole(session.roles, required) && !hasRole(session.roles, ["admin", "super_admin"])) {
    fail(`This step requires the ${required} role.`);
  }
}

export { QA_WORKFLOW_MODULES };

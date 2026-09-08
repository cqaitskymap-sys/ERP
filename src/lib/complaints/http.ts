import { COMPLAINT_COLLECTIONS } from "@/lib/complaints/collections";
import type { Permission } from "@/types/permissions";

export const COMPLAINT_RESOURCES = {
  cases: { collection: COMPLAINT_COLLECTIONS.complaints, read: "complaintCase:read" as Permission, create: "complaintIntake:create" as Permission },
  categories: { collection: COMPLAINT_COLLECTIONS.categories, read: "complaints:read" as Permission, create: "complaints:update" as Permission },
  sla: { collection: COMPLAINT_COLLECTIONS.sla, read: "complaints:read" as Permission, create: "complaints:update" as Permission },
  investigations: { collection: COMPLAINT_COLLECTIONS.investigations, read: "complaintInvestigation:read" as Permission, create: "complaintInvestigation:create" as Permission },
  tasks: { collection: COMPLAINT_COLLECTIONS.tasks, read: "complaintInvestigation:read" as Permission, create: "complaintInvestigation:update" as Permission },
  samples: { collection: COMPLAINT_COLLECTIONS.samples, read: "complaintSample:read" as Permission, create: "complaintSample:create" as Permission },
  rootCauses: { collection: COMPLAINT_COLLECTIONS.rootCauses, read: "complaintRootCause:read" as Permission, create: "complaintRootCause:create" as Permission },
  risks: { collection: COMPLAINT_COLLECTIONS.risks, read: "complaintRiskAssessment:read" as Permission, create: "complaintRiskAssessment:create" as Permission },
  communications: { collection: COMPLAINT_COLLECTIONS.communications, read: "complaintCommunication:read" as Permission, create: "complaintCommunication:create" as Permission },
  notifications: { collection: COMPLAINT_COLLECTIONS.notifications, read: "complaintRegulatory:read" as Permission, create: "complaintRegulatory:create" as Permission },
  recalls: { collection: COMPLAINT_COLLECTIONS.recalls, read: "complaintRecall:read" as Permission, create: "complaintRecall:create" as Permission },
  withdrawals: { collection: COMPLAINT_COLLECTIONS.withdrawals, read: "complaintWithdrawal:read" as Permission, create: "complaintWithdrawal:create" as Permission },
} as const;

export type ComplaintResource = keyof typeof COMPLAINT_RESOURCES;

export function isComplaintResource(value: string): value is ComplaintResource {
  return value in COMPLAINT_RESOURCES;
}

export const READ_ALIASES: Record<ComplaintResource, Permission[]> = {
  cases: ["complaintCase:read", "complaints:read", "complaintIntake:read"],
  categories: ["complaints:read"],
  sla: ["complaints:read"],
  investigations: ["complaintInvestigation:read", "complaints:read"],
  tasks: ["complaintInvestigation:read", "complaints:read"],
  samples: ["complaintSample:read", "complaints:read"],
  rootCauses: ["complaintRootCause:read", "complaints:read"],
  risks: ["complaintRiskAssessment:read", "complaints:read"],
  communications: ["complaintCommunication:read", "complaints:read"],
  notifications: ["complaintRegulatory:read", "complaints:read"],
  recalls: ["complaintRecall:read", "complaints:read"],
  withdrawals: ["complaintWithdrawal:read", "complaints:read"],
};

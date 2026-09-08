import { writeMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  module?: string;
  resource?: string;
  resourceId?: string;
  severity?: NotificationSeverity;
  audienceRoles?: string[];
}

export async function writeNotification(
  idToken: string,
  session: SessionPayload,
  input: NotificationInput
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await writeMasterDocument(
      "notifications",
      id,
      {
        notificationId: id,
        type: input.type,
        title: input.title,
        message: input.message,
        module: input.module || "warehouse",
        resource: input.resource || "",
        resourceId: input.resourceId || "",
        severity: input.severity || "info",
        audienceRoles: input.audienceRoles || ["warehouse", "qa", "department_head"],
        read: false,
        createdBy: session.uid,
        createdAt: now,
        updatedBy: session.uid,
        updatedAt: now,
      },
      idToken
    );
  } catch (error) {
    console.warn("Notification write skipped:", error);
  }
}

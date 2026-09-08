import { createDocument, listDocuments, orderBy, limit } from "@/lib/services/firestore-service";
import type { AuditEvent, AuditEventInput } from "@/types/audit";
import type { AuthUser } from "@/types/auth";

const AUDIT_COLLECTION = "audit_logs";

export async function writeAuditEvent(
  actor: AuthUser | null,
  input: AuditEventInput
) {
  if (!actor) return null;

  const event: AuditEvent = {
    actorId: actor.uid,
    actorEmail: actor.email,
    action: input.action,
    module: input.module,
    resource: input.resource,
    resourceId: input.resourceId,
    description: input.description,
    severity: input.severity ?? "info",
    metadata: input.metadata,
    oldData: input.oldData,
    newData: input.newData,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };

  try {
    const id = await createDocument<AuditEvent>(AUDIT_COLLECTION, event);
    return { ...event, id };
  } catch (error) {
    console.warn("Audit write skipped:", error);
    return event;
  }
}

export async function listRecentAuditEvents(max = 25) {
  return listDocuments<AuditEvent>(AUDIT_COLLECTION, [
    orderBy("createdAt", "desc"),
    limit(max),
  ]);
}

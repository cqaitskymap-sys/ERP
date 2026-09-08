export type AuditSeverity = "info" | "notice" | "warning" | "critical";

export interface AuditEvent {
  id?: string;
  actorId: string;
  actorEmail?: string | null;
  action: string;
  module: string;
  resource: string;
  resourceId?: string;
  description: string;
  severity: AuditSeverity;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

export interface AuditEventInput {
  action: string;
  module: string;
  resource: string;
  resourceId?: string;
  description: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  reason?: string;
}

import { PV_COLLECTIONS } from "@/lib/pv/collections";
import type { Permission } from "@/types/permissions";

export const PV_RESOURCES = {
  intakes: { collection: PV_COLLECTIONS.intakes, read: "pvIntake:read" as Permission, create: "pvIntake:create" as Permission },
  cases: { collection: PV_COLLECTIONS.cases, read: "pvCase:read" as Permission, create: "pvCase:create" as Permission },
  followups: { collection: PV_COLLECTIONS.followups, read: "pvFollowup:read" as Permission, create: "pvFollowup:create" as Permission },
  reviews: { collection: PV_COLLECTIONS.reviews, read: "pvMedicalReview:read" as Permission, create: "pvMedicalReview:update" as Permission },
  reports: { collection: PV_COLLECTIONS.reports, read: "pvRegulatoryReport:read" as Permission, create: "pvRegulatoryReport:create" as Permission },
  rules: { collection: PV_COLLECTIONS.rules, read: "pvRegulatoryReport:read" as Permission, create: "pvRegulatoryReport:create" as Permission },
  signals: { collection: PV_COLLECTIONS.signals, read: "pvSignal:read" as Permission, create: "pvSignal:create" as Permission },
  commitments: { collection: PV_COLLECTIONS.commitments, read: "pvCommitment:read" as Permission, create: "pvCommitment:create" as Permission },
  retention: { collection: PV_COLLECTIONS.retention, read: "pv:read" as Permission, create: "pv:update" as Permission },
} as const;

export type PvResource = keyof typeof PV_RESOURCES;

export function isPvResource(value: string): value is PvResource {
  return value in PV_RESOURCES;
}

export const READ_ALIASES: Record<PvResource, Permission[]> = {
  intakes: ["pvIntake:read", "pv:read"],
  cases: ["pvCase:read", "pv:read"],
  followups: ["pvFollowup:read", "pv:read"],
  reviews: ["pvMedicalReview:read", "pv:read"],
  reports: ["pvRegulatoryReport:read", "pv:read"],
  rules: ["pvRegulatoryReport:read", "pv:read"],
  signals: ["pvSignal:read", "pv:read"],
  commitments: ["pvCommitment:read", "pv:read"],
  retention: ["pv:read"],
};

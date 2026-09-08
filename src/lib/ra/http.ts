import { RA_COLLECTIONS } from "@/lib/ra/collections";
import type { Permission } from "@/types/permissions";

export const RA_RESOURCES = {
  profiles: { collection: RA_COLLECTIONS.profiles, read: "raProduct:read" as Permission, create: "raProduct:update" as Permission },
  markets: { collection: RA_COLLECTIONS.markets, read: "raMarket:read" as Permission, create: "raMarket:create" as Permission },
  authorities: { collection: RA_COLLECTIONS.authorities, read: "raAuthority:read" as Permission, create: "raAuthority:create" as Permission },
  registrations: { collection: RA_COLLECTIONS.registrations, read: "raRegistration:read" as Permission, create: "raRegistration:create" as Permission },
  submissions: { collection: RA_COLLECTIONS.submissions, read: "raSubmission:read" as Permission, create: "raSubmission:create" as Permission },
  dossiers: { collection: RA_COLLECTIONS.dossiers, read: "raDossier:read" as Permission, create: "raDossier:create" as Permission },
  documents: { collection: RA_COLLECTIONS.documents, read: "raDocument:read" as Permission, create: "raDocument:create" as Permission },
  licenses: { collection: RA_COLLECTIONS.licenses, read: "raLicense:read" as Permission, create: "raLicense:create" as Permission },
  renewals: { collection: RA_COLLECTIONS.renewals, read: "raRenewal:read" as Permission, create: "raRenewal:create" as Permission },
  queries: { collection: RA_COLLECTIONS.queries, read: "raQuery:read" as Permission, create: "raQuery:create" as Permission },
  commitments: { collection: RA_COLLECTIONS.commitments, read: "raCommitment:read" as Permission, create: "raCommitment:create" as Permission },
  communications: { collection: RA_COLLECTIONS.communications, read: "raCommunication:read" as Permission, create: "raCommunication:create" as Permission },
  requirements: { collection: RA_COLLECTIONS.requirements, read: "raProduct:read" as Permission, create: "raProduct:update" as Permission },
  artworks: { collection: RA_COLLECTIONS.artworks, read: "raArtwork:read" as Permission, create: "raArtwork:create" as Permission },
  changes: { collection: RA_COLLECTIONS.changes, read: "raRegulatoryChange:read" as Permission, create: "raRegulatoryChange:create" as Permission },
} as const;

export type RaResource = keyof typeof RA_RESOURCES;

export function isRaResource(value: string): value is RaResource {
  return value in RA_RESOURCES;
}

export const READ_ALIASES: Record<RaResource, Permission[]> = {
  profiles: ["raProduct:read", "ra:read", "regulatory:read"],
  markets: ["raMarket:read", "ra:read", "regulatory:read"],
  authorities: ["raAuthority:read", "ra:read", "regulatory:read"],
  registrations: ["raRegistration:read", "ra:read", "regulatory:read"],
  submissions: ["raSubmission:read", "ra:read", "regulatory:read"],
  dossiers: ["raDossier:read", "ra:read", "regulatory:read"],
  documents: ["raDocument:read", "ra:read", "regulatory:read"],
  licenses: ["raLicense:read", "ra:read", "regulatory:read"],
  renewals: ["raRenewal:read", "ra:read", "regulatory:read"],
  queries: ["raQuery:read", "ra:read", "regulatory:read"],
  commitments: ["raCommitment:read", "ra:read", "regulatory:read"],
  communications: ["raCommunication:read", "ra:read", "regulatory:read"],
  requirements: ["raProduct:read", "ra:read", "regulatory:read"],
  artworks: ["raArtwork:read", "ra:read", "regulatory:read"],
  changes: ["raRegulatoryChange:read", "ra:read", "regulatory:read"],
};

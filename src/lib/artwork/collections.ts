export const ARTWORK_COLLECTIONS = {
  requests: "artworkRequests",
  approvals: "artworkApprovals",
  versions: "artworkVersions",
} as const;

export const ARTWORK_RESOURCES = ["requests", "approvals", "versions"] as const;

export type ArtworkResource = (typeof ARTWORK_RESOURCES)[number];

export function isArtworkResource(value: string): value is ArtworkResource {
  return (ARTWORK_RESOURCES as readonly string[]).includes(value);
}

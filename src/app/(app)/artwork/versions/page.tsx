"use client";

import { ArtworkList } from "@/components/artwork/artwork-list";

export default function Page() {
  return (
    <ArtworkList
      title="Versions"
      description="What changed between proofs, from the first draft to the effective file."
      resource="versions"
      emptyTitle="No versions"
      rowHref={(row) => `/artwork/requests/${String(row.requestId || "")}`}
      columns={[
        { key: "artworkNumber", header: "Job", accessor: "artworkNumber" },
        { key: "title", header: "Title", accessor: "title", hideOnMobile: true },
        { key: "versionLabel", header: "Version", accessor: "versionLabel" },
        { key: "summary", header: "What changed", accessor: "summary" },
        { key: "preparedBy", header: "Prepared by", accessor: "preparedBy", hideOnMobile: true },
      ]}
    />
  );
}

"use client";

import { ArtworkDecisionCell, ArtworkList } from "@/components/artwork/artwork-list";
import { laneLabel } from "@/lib/artwork/status";

export default function Page() {
  return (
    <ArtworkList
      title="Approval lane"
      description="Packaging, QA, regulatory, and the customer. Each row is one signature on a job."
      resource="approvals"
      emptyTitle="No approval steps"
      rowHref={(row) => `/artwork/requests/${String(row.requestId || "")}`}
      columns={[
        { key: "artworkNumber", header: "Job", accessor: "artworkNumber" },
        { key: "title", header: "Title", accessor: "title", hideOnMobile: true },
        { key: "customerId", header: "Customer", accessor: "customerId", hideOnMobile: true },
        { key: "lane", header: "Lane", cell: (row) => laneLabel(row.lane) },
        { key: "actorName", header: "Signed by", accessor: "actorName", hideOnMobile: true },
        { key: "decision", header: "Decision", cell: (row) => <ArtworkDecisionCell decision={row.decision} /> },
      ]}
    />
  );
}

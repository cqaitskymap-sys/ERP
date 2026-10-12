"use client";

import { ArtworkDecisionCell, ArtworkList, ArtworkStatusCell } from "@/components/artwork/artwork-list";

export function ArtworkRequestsPage() {
  return (
    <ArtworkList
      title="Artwork jobs"
      description="Carton, label, foil, leaflet, and shipper jobs moving through approval."
      resource="requests"
      createHref="/artwork/requests/new"
      emptyTitle="No artwork jobs"
      rowHref={(row) => `/artwork/requests/${row.id}`}
      columns={[
        { key: "artworkNumber", header: "Number", accessor: "artworkNumber" },
        { key: "title", header: "Title", accessor: "title" },
        { key: "customerId", header: "Customer", accessor: "customerId", hideOnMobile: true },
        { key: "component", header: "Component", accessor: "component" },
        { key: "versionLabel", header: "Version", accessor: "versionLabel", hideOnMobile: true },
        { key: "dueDate", header: "Due", accessor: "dueDate", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <ArtworkStatusCell status={row.status} /> },
      ]}
    />
  );
}

export function ArtworkApprovalsPage() {
  return (
    <ArtworkList
      title="Approval lane"
      description="Packaging, QA, regulatory, and customer decisions on each job."
      resource="approvals"
      emptyTitle="No approval steps"
      rowHref={(row) => `/artwork/requests/${String(row.requestId || "")}`}
      columns={[
        { key: "artworkNumber", header: "Job", accessor: "artworkNumber" },
        { key: "title", header: "Title", accessor: "title", hideOnMobile: true },
        { key: "lane", header: "Lane", cell: (row) => String(row.lane || "").replaceAll("_", " ") },
        { key: "actorName", header: "Signed by", accessor: "actorName", hideOnMobile: true },
        { key: "decision", header: "Decision", cell: (row) => <ArtworkDecisionCell decision={row.decision} /> },
      ]}
    />
  );
}

export function ArtworkVersionsPage() {
  return (
    <ArtworkList
      title="Versions"
      description="What changed on each carton, foil, label, and leaflet."
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

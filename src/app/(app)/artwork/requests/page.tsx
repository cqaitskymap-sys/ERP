"use client";

import { ArtworkList, ArtworkStatusCell } from "@/components/artwork/artwork-list";

export default function Page() {
  return (
    <ArtworkList
      title="Artwork jobs"
      description="Carton, label, foil, leaflet, and shipper jobs moving through the approval lane."
      resource="requests"
      createHref="/artwork/requests/new"
      emptyTitle="No artwork jobs"
      rowHref={(row) => `/artwork/requests/${row.id}`}
      columns={[
        { key: "artworkNumber", header: "Number", accessor: "artworkNumber", sortable: true },
        { key: "title", header: "Title", accessor: "title" },
        { key: "customerId", header: "Customer", accessor: "customerId", hideOnMobile: true },
        { key: "productId", header: "Product", accessor: "productId", hideOnMobile: true },
        { key: "component", header: "Component", accessor: "component" },
        { key: "versionLabel", header: "Version", accessor: "versionLabel", hideOnMobile: true },
        { key: "dueDate", header: "Due", accessor: "dueDate", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <ArtworkStatusCell status={row.status} /> },
      ]}
    />
  );
}

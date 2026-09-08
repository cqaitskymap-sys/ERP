"use client";

import { CatalogList } from "@/components/products/catalog-list";
import {
  partnerStatusOptions,
  qualificationStatusOptions,
  riskOptions,
  vendorTypeOptions,
} from "@/lib/partners/catalog";

export default function VendorsPage() {
  return (
    <CatalogList
      entity="vendors"
      title="Vendors"
      description="Qualified vendors and service providers. Codes are issued by the server number series."
      permission="vendors:read"
      writePermission="vendors:create"
      editPermission="vendors:update"
      deactivatePermission="vendors:delete"
      exportPermission="vendors:export"
      createHref="/masters/vendors/new"
      detailHref={(id) => `/masters/vendors/${id}`}
      statusOptions={partnerStatusOptions}
      recordActions={[
        { label: "Qualify", tab: "qualification", permission: "vendors:qualify" },
        { label: "Materials", tab: "materials", permission: "vendors:read" },
        { label: "Documents", tab: "documents", permission: "vendors:read" },
        { label: "Performance", tab: "performance", permission: "vendors:read" },
      ]}
      filters={[
        { key: "vendorType", label: "Vendor type", options: vendorTypeOptions },
        { key: "qualificationStatus", label: "Qualification", options: qualificationStatusOptions },
        { key: "riskCategory", label: "Risk", options: riskOptions },
        { key: "materialId", label: "Material", relation: "materials" },
        { key: "country", label: "Country" },
      ]}
      columns={[
        { key: "vendorCode", header: "Vendor Code" },
        { key: "vendorName", header: "Vendor Name" },
        { key: "vendorType", header: "Type" },
        { key: "qualificationStatus", header: "Qualification" },
        { key: "riskCategory", header: "Risk" },
        { key: "status", header: "Status" },
      ]}
      exportColumns={[
        "vendorCode",
        "vendorName",
        "vendorType",
        "qualificationStatus",
        "riskCategory",
        "status",
        "updatedAt",
      ]}
    />
  );
}

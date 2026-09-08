"use client";

import { CatalogList } from "@/components/products/catalog-list";
import {
  customerTypeOptions,
  partnerStatusOptions,
  qualificationStatusOptions,
  riskOptions,
} from "@/lib/partners/catalog";

export default function CustomersPage() {
  return (
    <CatalogList
      entity="customers"
      title="Customers"
      description="Contract manufacturing customers. Codes are issued by the server number series."
      permission="customers:read"
      writePermission="customers:create"
      editPermission="customers:update"
      deactivatePermission="customers:delete"
      exportPermission="customers:export"
      createHref="/masters/customers/new"
      detailHref={(id) => `/masters/customers/${id}`}
      statusOptions={partnerStatusOptions}
      recordActions={[
        { label: "Qualify", tab: "qualification", permission: "customers:qualify" },
        { label: "Products", tab: "products", permission: "customers:read" },
        { label: "Contracts", tab: "contracts", permission: "customers:read" },
        { label: "Documents", tab: "documents", permission: "customers:read" },
      ]}
      filters={[
        { key: "customerType", label: "Customer type", options: customerTypeOptions },
        { key: "qualificationStatus", label: "Qualification", options: qualificationStatusOptions },
        { key: "riskCategory", label: "Risk", options: riskOptions },
        { key: "country", label: "Country" },
      ]}
      columns={[
        { key: "customerCode", header: "Customer Code" },
        { key: "customerName", header: "Customer Name" },
        { key: "customerType", header: "Type" },
        { key: "country", header: "Country", hideOnMobile: true },
        { key: "primaryContactName", header: "Contact", hideOnMobile: true },
        { key: "qualificationStatus", header: "Qualification" },
        { key: "riskCategory", header: "Risk" },
        { key: "status", header: "Status" },
      ]}
      exportColumns={[
        "customerCode",
        "customerName",
        "customerType",
        "country",
        "qualificationStatus",
        "riskCategory",
        "status",
        "updatedAt",
      ]}
    />
  );
}

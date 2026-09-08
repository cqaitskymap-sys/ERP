"use client";

import { CatalogList } from "@/components/products/catalog-list";
import { materialStatusOptions, materialTypeOptions } from "@/lib/products/catalog";

export default function MaterialsPage() {
  return (
    <CatalogList
      entity="materials"
      title="Materials"
      description="APIs, excipients, packaging, and other input materials. Lot quality status is configured separately."
      permission="materials:read"
      writePermission="materials:create"
      editPermission="materials:update"
      deactivatePermission="materials:delete"
      exportPermission="materials:export"
      createHref="/masters/materials/new"
      detailHref={(id) => `/masters/materials/${id}`}
      statusOptions={materialStatusOptions}
      recordActions={[
        { label: "Supplier Mapping", tab: "suppliers", permission: "materials:read" },
        { label: "Specification", tab: "specifications", permission: "materials:read" },
        { label: "Storage", tab: "storage", permission: "materials:read" },
        { label: "Product Mapping", tab: "products", permission: "products:read" },
      ]}
      filters={[
        { key: "materialType", label: "Material type", options: materialTypeOptions },
        { key: "supplierId", label: "Supplier", relation: "suppliers" },
        { key: "uom", label: "UOM", relation: "uoms" },
      ]}
      columns={[
        { key: "materialCode", header: "Material Code" },
        { key: "materialName", header: "Material Name" },
        { key: "materialType", header: "Material Type" },
        { key: "specification", header: "Specification", hideOnMobile: true },
        { key: "uom", header: "UOM" },
        { key: "supplierLabel", header: "Supplier", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      exportColumns={[
        "materialCode",
        "materialName",
        "materialType",
        "specification",
        "uom",
        "status",
        "updatedAt",
      ]}
    />
  );
}

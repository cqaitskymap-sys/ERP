"use client";

import { CatalogList } from "@/components/products/catalog-list";
import { dosageFormOptions, productStatusOptions, productTypeOptions } from "@/lib/products/catalog";

export default function ProductsPage() {
  return (
    <CatalogList
      entity="products"
      title="Products"
      description="Internal pharmaceutical products. Customer-facing names are mapped separately."
      permission="products:read"
      writePermission="products:create"
      editPermission="products:update"
      deactivatePermission="products:delete"
      exportPermission="products:export"
      createHref="/masters/products/new"
      detailHref={(id) => `/masters/products/${id}`}
      statusOptions={productStatusOptions}
      recordActions={[
        { label: "Version", tab: "versions", permission: "products:read" },
        { label: "Customer Mapping", tab: "customers", permission: "products:read" },
        { label: "Packaging", tab: "packaging", permission: "products:read" },
        { label: "Storage", tab: "storage", permission: "products:read" },
      ]}
      filters={[
        { key: "productType", label: "Product type", options: productTypeOptions },
        { key: "dosageForm", label: "Dosage form", options: dosageFormOptions },
      ]}
      columns={[
        { key: "productCode", header: "Product Code" },
        { key: "productName", header: "Product Name" },
        { key: "genericName", header: "Generic Name", hideOnMobile: true },
        { key: "dosageForm", header: "Dosage Form" },
        { key: "strength", header: "Strength", hideOnMobile: true },
        { key: "customerLabel", header: "Customer", hideOnMobile: true },
        { key: "productType", header: "Product Type" },
        { key: "status", header: "Status" },
      ]}
      exportColumns={[
        "productCode",
        "productName",
        "genericName",
        "productType",
        "dosageForm",
        "strength",
        "status",
        "updatedAt",
      ]}
    />
  );
}

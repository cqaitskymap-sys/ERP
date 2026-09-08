import type { MasterEntity } from "@/types/masters";

export const MASTER_ROUTES: Array<{
  entity: MasterEntity;
  href: string;
  label: string;
}> = [
  { entity: "companies", href: "/admin/company", label: "Company" },
  { entity: "plants", href: "/admin/plants", label: "Plants" },
  { entity: "departments", href: "/admin/departments", label: "Departments" },
  { entity: "areas", href: "/admin/areas", label: "Areas" },
  { entity: "warehouses", href: "/admin/warehouses", label: "Warehouses" },
  { entity: "storageLocations", href: "/admin/locations", label: "Storage Locations" },
  { entity: "uoms", href: "/admin/uom", label: "UOM" },
  { entity: "financialYears", href: "/admin/financial-years", label: "Financial Years" },
  { entity: "currencies", href: "/admin/currency", label: "Currency" },
  { entity: "taxes", href: "/admin/tax", label: "Tax" },
  { entity: "documentNumbering", href: "/admin/numbering", label: "Document Numbering" },
  { entity: "approvalWorkflows", href: "/admin/workflows", label: "Approval Workflows" },
];

export function getMasterRoute(entity: MasterEntity) {
  return MASTER_ROUTES.find((item) => item.entity === entity);
}

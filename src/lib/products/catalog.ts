import {
  DOSAGE_FORMS,
  EXPIRY_RULES,
  FORMULA_STATUSES,
  MATERIAL_STATUSES,
  MATERIAL_TYPES,
  PACKAGING_LEVELS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  QUALITY_DISPOSITIONS,
  ROUTES_OF_ADMIN,
  SHELF_LIFE_UNITS,
  SPECIFICATION_TYPES,
  SUPPLIER_ROLES,
  VERSION_STATUSES,
} from "@/types/products";

function options(
  values: readonly string[],
  labels: Record<string, string>
): Array<{ label: string; value: string }> {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export const productTypeOptions = options(PRODUCT_TYPES, {
  finished: "Finished Product",
  semi_finished: "Semi Finished Product",
  bulk: "Bulk Product",
  intermediate: "Intermediate Product",
  trial: "Trial Product",
  other: "Other",
});

export const productStatusOptions = options(PRODUCT_STATUSES, {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
  discontinued: "Discontinued",
  under_development: "Under Development",
  blocked: "Blocked",
});

export const dosageFormOptions = options(DOSAGE_FORMS, {
  tablet: "Tablet",
  capsule: "Capsule",
  syrup: "Syrup",
  suspension: "Suspension",
  cream: "Cream",
  ointment: "Ointment",
  injection: "Injection",
  powder: "Powder",
  drops: "Drops",
  other: "Other",
});

export const routeOptions = options(ROUTES_OF_ADMIN, {
  oral: "Oral",
  topical: "Topical",
  injectable: "Injectable",
  ophthalmic: "Ophthalmic",
  otic: "Otic",
  nasal: "Nasal",
  other: "Other",
});

export const versionStatusOptions = options(VERSION_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  obsolete: "Obsolete",
});

export const materialTypeOptions = options(MATERIAL_TYPES, {
  api: "API",
  raw_material: "Raw Material",
  excipient: "Excipient",
  packaging_material: "Packaging Material",
  printed_packaging: "Printed Packaging Material",
  consumable: "Consumable",
  chemical: "Chemical",
  solvent: "Solvent",
  cleaning_material: "Cleaning Material",
  spare: "Spare",
  other: "Other",
});

export const materialStatusOptions = options(MATERIAL_STATUSES, {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
  blocked: "Blocked",
  discontinued: "Discontinued",
});

export const qualityDispositionOptions = options(QUALITY_DISPOSITIONS, {
  quarantine: "Quarantine",
  under_testing: "Under Testing",
  approved: "Approved",
  rejected: "Rejected",
  blocked: "Blocked",
  expired: "Expired",
});

export const packagingLevelOptions = options(PACKAGING_LEVELS, {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
});

export const supplierRoleOptions = options(SUPPLIER_ROLES, {
  preferred: "Preferred Supplier",
  approved: "Approved Supplier",
  alternate: "Alternate Supplier",
});

export const specificationTypeOptions = options(SPECIFICATION_TYPES, {
  raw_material: "Raw Material Specification",
  api: "API Specification",
  packaging: "Packaging Specification",
  printed_material: "Printed Material Specification",
  other: "Other",
});

export const formulaStatusOptions = options(FORMULA_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  obsolete: "Obsolete",
});

export const shelfLifeUnitOptions = options(SHELF_LIFE_UNITS, {
  days: "Days",
  months: "Months",
  years: "Years",
});

export const expiryRuleOptions = options(EXPIRY_RULES, {
  manufacturing_date_plus_shelf_life: "Manufacturing date + shelf life",
  packing_date_plus_shelf_life: "Packing date + shelf life",
  retest_then_expiry: "Retest date, then expiry",
  manual: "Manual entry",
});

export const storageConditionOptions = [
  { label: "Room Temperature", value: "room_temperature" },
  { label: "Controlled Room Temperature", value: "controlled_room_temperature" },
  { label: "Below 25°C", value: "below_25" },
  { label: "2–8°C", value: "2_to_8" },
  { label: "Refrigerated", value: "refrigerated" },
  { label: "Frozen", value: "frozen" },
  { label: "Dry Place", value: "dry_place" },
  { label: "Protect from Light", value: "protect_from_light" },
  { label: "Other", value: "other" },
];

export const warehouseTypeOptions = [
  { label: "Raw Material", value: "raw_material" },
  { label: "Packaging Material", value: "packaging_material" },
  { label: "Finished Goods", value: "finished_goods" },
  { label: "Cold Storage", value: "cold_storage" },
  { label: "Quarantine", value: "quarantine" },
  { label: "Rejected", value: "rejected" },
  { label: "Returned Goods", value: "returned_goods" },
  { label: "Controlled Temperature", value: "controlled_temperature" },
  { label: "Dispatch", value: "dispatch" },
  { label: "General", value: "general" },
  { label: "Other", value: "other" },
];

export const materialCategoryOptions = [
  { label: "API", value: "api" },
  { label: "Excipient", value: "excipient" },
  { label: "Raw Material", value: "raw_material" },
  { label: "Packaging Material", value: "packaging_material" },
  { label: "Printed Material", value: "printed_material" },
  { label: "Other", value: "other" },
];

export const PHARMA_MATERIAL_TYPES = [
  "api",
  "raw_material",
  "excipient",
  "chemical",
  "solvent",
];

export function labelFor(
  optionsList: Array<{ label: string; value: string }>,
  value: unknown
) {
  return optionsList.find((item) => item.value === value)?.label || String(value || "—");
}

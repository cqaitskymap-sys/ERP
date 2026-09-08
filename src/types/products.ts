export const PRODUCT_TYPES = [
  "finished",
  "semi_finished",
  "bulk",
  "intermediate",
  "trial",
  "other",
] as const;

export const PRODUCT_STATUSES = [
  "draft",
  "active",
  "inactive",
  "discontinued",
  "under_development",
  "blocked",
] as const;

export const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "cream",
  "ointment",
  "injection",
  "powder",
  "drops",
  "other",
] as const;

export const ROUTES_OF_ADMIN = [
  "oral",
  "topical",
  "injectable",
  "ophthalmic",
  "otic",
  "nasal",
  "other",
] as const;

export const VERSION_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "obsolete",
] as const;

export const MATERIAL_TYPES = [
  "api",
  "raw_material",
  "excipient",
  "packaging_material",
  "printed_packaging",
  "consumable",
  "chemical",
  "solvent",
  "cleaning_material",
  "spare",
  "other",
] as const;

export const MATERIAL_STATUSES = [
  "draft",
  "active",
  "inactive",
  "blocked",
  "discontinued",
] as const;

export const QUALITY_DISPOSITIONS = [
  "quarantine",
  "under_testing",
  "approved",
  "rejected",
  "blocked",
  "expired",
] as const;

export const PACKAGING_LEVELS = ["primary", "secondary", "tertiary"] as const;

export const SUPPLIER_ROLES = ["preferred", "approved", "alternate"] as const;

export const SPECIFICATION_TYPES = [
  "raw_material",
  "api",
  "packaging",
  "printed_material",
  "other",
] as const;

export const FORMULA_STATUSES = VERSION_STATUSES;

export const SHELF_LIFE_UNITS = ["days", "months", "years"] as const;

export const EXPIRY_RULES = [
  "manufacturing_date_plus_shelf_life",
  "packing_date_plus_shelf_life",
  "retest_then_expiry",
  "manual",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type DosageForm = (typeof DOSAGE_FORMS)[number];
export type RouteOfAdmin = (typeof ROUTES_OF_ADMIN)[number];
export type VersionStatus = (typeof VERSION_STATUSES)[number];
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];
export type QualityDisposition = (typeof QUALITY_DISPOSITIONS)[number];
export type PackagingLevel = (typeof PACKAGING_LEVELS)[number];
export type SupplierRole = (typeof SUPPLIER_ROLES)[number];
export type SpecificationType = (typeof SPECIFICATION_TYPES)[number];
export type ShelfLifeUnit = (typeof SHELF_LIFE_UNITS)[number];
export type ExpiryRule = (typeof EXPIRY_RULES)[number];

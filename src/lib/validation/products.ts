import { z } from "zod";
import {
  DOSAGE_FORMS,
  EXPIRY_RULES,
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

const optionalText = z.string().trim().optional().or(z.literal(""));
const nonNegative = z.coerce.number().min(0, "Value cannot be negative.");
const percentage = z.coerce.number().min(0, "Percentage cannot be negative.").max(100);

export const dateRangeRefine = <T extends { effectiveFrom?: string; effectiveTo?: string }>(
  schema: z.ZodType<T>
) =>
  schema.refine(
    (value) => !value.effectiveTo || !value.effectiveFrom || value.effectiveTo >= value.effectiveFrom,
    {
      message: "Effective to cannot be earlier than effective from.",
      path: ["effectiveTo"],
    }
  );

export { customerSchema } from "@/lib/validation/partners";

export const supplierSchema = z.object({
  supplierCode: z.string().trim().min(2, "Supplier code is required.").max(30),
  supplierName: z.string().trim().min(2, "Supplier name is required."),
  country: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const productSchema = z.object({
  productCode: z.string().trim().min(2, "Product code is required.").max(40),
  productName: z.string().trim().min(2, "Product name is required."),
  genericName: optionalText,
  brandName: optionalText,
  productType: z.enum(PRODUCT_TYPES),
  dosageForm: z.enum(DOSAGE_FORMS),
  strength: optionalText,
  strengthUnit: optionalText,
  description: optionalText,
  routeOfAdministration: z.enum(ROUTES_OF_ADMIN).optional().or(z.literal("")),
  therapeuticCategory: optionalText,
  pharmacologicalCategory: optionalText,
  productCategory: optionalText,
  storageCondition: optionalText,
  shelfLifeValue: z.coerce.number().min(0).optional(),
  shelfLifeUnit: z.enum(SHELF_LIFE_UNITS).optional().or(z.literal("")),
  retestPeriodValue: z.coerce.number().min(0).optional(),
  retestPeriodUnit: z.enum(SHELF_LIFE_UNITS).optional().or(z.literal("")),
  expiryCalculationRule: z.enum(EXPIRY_RULES).optional().or(z.literal("")),
  manufacturingSiteId: optionalText,
  productOwner: optionalText,
  qaResponsible: optionalText,
  status: z.enum(PRODUCT_STATUSES).default("draft"),
});

export const productVersionSchema = dateRangeRefine(
  z.object({
    productId: z.string().trim().min(1, "Product is required."),
    versionNumber: z.string().trim().min(1, "Version number is required."),
    effectiveFrom: z.string().trim().optional(),
    effectiveTo: z.string().trim().optional(),
    changeReason: z.string().trim().min(2, "Change reason is required."),
    status: z.enum(VERSION_STATUSES).default("draft"),
  })
);

export const productCustomerMappingSchema = dateRangeRefine(
  z.object({
    customerId: z.string().trim().min(1, "Customer is required."),
    productId: z.string().trim().min(1, "Internal product is required."),
    customerProductCode: z.string().trim().min(1, "Customer product code is required."),
    customerProductName: z.string().trim().min(1, "Customer product name is required."),
    customerSpecification: optionalText,
    packSize: optionalText,
    market: optionalText,
    country: optionalText,
    contractReference: optionalText,
    artworkReference: optionalText,
    labelReference: optionalText,
    specialInstructions: optionalText,
    dosageForm: optionalText,
    strength: optionalText,
    remarks: optionalText,
    status: z.enum(["active", "inactive", "expired"]).default("active"),
    effectiveFrom: z.string().trim().optional(),
    effectiveTo: z.string().trim().optional(),
  })
);

export const productPackagingSchema = dateRangeRefine(
  z.object({
    productId: z.string().trim().min(1, "Product is required."),
    packagingLevel: z.enum(PACKAGING_LEVELS),
    materialId: optionalText,
    quantityPerPack: nonNegative,
    uom: optionalText,
    description: optionalText,
    version: optionalText,
    effectiveFrom: z.string().trim().optional(),
    effectiveTo: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]).default("active"),
  })
);

export const productStorageSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  temperatureMin: z.coerce.number().optional(),
  temperatureMax: z.coerce.number().optional(),
  humidityMin: z.coerce.number().min(0).max(100).optional(),
  humidityMax: z.coerce.number().min(0).max(100).optional(),
  lightProtection: z.boolean().default(false),
  specialStorageInstruction: optionalText,
  warehouseType: optionalText,
  storageCondition: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const productRegulatorySchema = z
  .object({
    productId: z.string().trim().min(1, "Product is required."),
    regulatoryProductCode: optionalText,
    drugLicenseReference: optionalText,
    marketAuthorizationReference: optionalText,
    registrationNumber: optionalText,
    country: optionalText,
    regulatoryStatus: optionalText,
    approvalDate: optionalText,
    expiryDate: optionalText,
    remarks: optionalText,
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .refine((value) => !value.expiryDate || !value.approvalDate || value.expiryDate >= value.approvalDate, {
    message: "Expiry date cannot be earlier than approval date.",
    path: ["expiryDate"],
  });

export const materialSchema = z.object({
  materialCode: z.string().trim().min(2, "Material code is required.").max(40),
  materialName: z.string().trim().min(2, "Material name is required."),
  materialType: z.enum(MATERIAL_TYPES),
  materialSubType: optionalText,
  description: optionalText,
  specification: optionalText,
  uom: z.string().trim().min(1, "UOM is required."),
  genericName: optionalText,
  chemicalName: optionalText,
  casNumber: optionalText,
  grade: optionalText,
  manufacturer: optionalText,
  manufacturerReference: optionalText,
  storageCondition: optionalText,
  shelfLifeValue: z.coerce.number().min(0).optional(),
  shelfLifeUnit: z.enum(SHELF_LIFE_UNITS).optional().or(z.literal("")),
  retestPeriodValue: z.coerce.number().min(0).optional(),
  retestPeriodUnit: z.enum(SHELF_LIFE_UNITS).optional().or(z.literal("")),
  expiryCalculationRule: z.enum(EXPIRY_RULES).optional().or(z.literal("")),
  hazardClassification: optionalText,
  specialHandlingInstruction: optionalText,
  defaultQualityStatus: z.enum(QUALITY_DISPOSITIONS).optional().or(z.literal("")),
  minimumStock: z.coerce.number().min(0).optional(),
  maximumStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
  batchRequired: z.boolean().default(false),
  lotRequired: z.boolean().default(false),
  expiryRequired: z.boolean().default(false),
  manufacturingDateRequired: z.boolean().default(false),
  retestDateRequired: z.boolean().default(false),
  supplierBatchRequired: z.boolean().default(false),
  manufacturerBatchRequired: z.boolean().default(false),
  status: z.enum(MATERIAL_STATUSES).default("draft"),
});

export const materialSupplierMappingSchema = dateRangeRefine(
  z.object({
    supplierId: z.string().trim().min(1, "Supplier is required."),
    materialId: z.string().trim().min(1, "Material is required."),
    supplierMaterialCode: optionalText,
    manufacturerName: optionalText,
    manufacturerCode: optionalText,
    supplierRole: z.enum(SUPPLIER_ROLES),
    approvedSupplier: z.boolean().default(false),
    supplierPriority: z.coerce.number().int().min(1).default(1),
    leadTimeDays: z.coerce.number().min(0).optional(),
    moq: z.coerce.number().min(0).optional(),
    priceReference: optionalText,
    currency: optionalText,
    effectiveFrom: z.string().trim().optional(),
    effectiveTo: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]).default("active"),
  })
);

export const testParameterSchema = z.object({
  name: z.string().trim().min(1, "Parameter name is required."),
  specification: z.string().trim().min(1, "Specification is required."),
  uom: optionalText,
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
});

export const materialSpecificationSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  specificationNumber: z.string().trim().min(1, "Specification number is required."),
  specificationVersion: z.string().trim().min(1, "Version is required."),
  effectiveDate: optionalText,
  reviewDate: optionalText,
  specificationType: z.enum(SPECIFICATION_TYPES),
  testParameters: z.array(testParameterSchema).default([]),
  status: z.enum(VERSION_STATUSES).default("draft"),
});

export const materialStorageSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  temperatureMin: z.coerce.number().optional(),
  temperatureMax: z.coerce.number().optional(),
  humidityMin: z.coerce.number().min(0).max(100).optional(),
  humidityMax: z.coerce.number().min(0).max(100).optional(),
  lightProtection: z.boolean().default(false),
  specialInstruction: optionalText,
  storageAreaType: optionalText,
  storageCondition: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const productMaterialSchema = dateRangeRefine(
  z.object({
    productId: z.string().trim().min(1, "Product is required."),
    productVersionId: optionalText,
    materialId: z.string().trim().min(1, "Material is required."),
    materialCategory: z.string().trim().min(1, "Material category is required."),
    quantity: nonNegative,
    uom: z.string().trim().min(1, "UOM is required."),
    percentage: percentage.optional(),
    sequence: z.coerce.number().int().min(1).default(1),
    wastagePercentage: percentage.optional(),
    effectiveFrom: z.string().trim().optional(),
    effectiveTo: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]).default("active"),
  })
);

export const productFormulaSchema = dateRangeRefine(
  z.object({
    productId: z.string().trim().min(1, "Product is required."),
    productVersionId: optionalText,
    formulaVersion: z.string().trim().min(1, "Formula version is required."),
    batchSize: nonNegative,
    batchSizeUom: z.string().trim().min(1, "Batch size UOM is required."),
    status: z.enum(VERSION_STATUSES).default("draft"),
    effectiveFrom: z.string().trim().optional(),
    effectiveTo: z.string().trim().optional(),
    remarks: optionalText,
  })
);

export const productFormulaLineSchema = z.object({
  formulaId: z.string().trim().min(1, "Formula is required."),
  materialId: z.string().trim().min(1, "Material is required."),
  quantity: nonNegative,
  uom: z.string().trim().min(1, "UOM is required."),
  percentage: percentage.optional(),
  overage: percentage.optional(),
  wastage: percentage.optional(),
  sequence: z.coerce.number().int().min(1).default(1),
  status: z.enum(["active", "inactive"]).default("active"),
});

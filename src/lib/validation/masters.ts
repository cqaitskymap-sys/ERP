import { z } from "zod";

export const masterStatusSchema = z.enum(["active", "inactive", "closed"]);

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .optional()
  .or(z.literal(""));

const gstSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    "Enter a valid GSTIN."
  )
  .optional();

const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN.")
  .optional();

export const companySchema = z.object({
  companyCode: z.string().trim().min(2, "Company code must be at least 2 characters.").max(20),
  companyName: z.string().trim().min(2, "Company name is required."),
  legalName: z.string().trim().min(2, "Legal name is required."),
  registrationNumber: z.string().trim().optional(),
  gstNumber: gstSchema,
  panNumber: panSchema,
  cinNumber: z.string().trim().optional(),
  drugLicenseNumber: z.string().trim().optional(),
  manufacturingLicenseNumber: z.string().trim().optional(),
  addressLine1: z.string().trim().min(3, "Address is required."),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  country: z.string().trim().min(2, "Country is required."),
  postalCode: z.string().trim().min(4, "Postal code is required."),
  phone: z.string().trim().optional(),
  email: optionalEmail,
  website: z.string().trim().optional(),
  logo: z.string().trim().optional(),
  status: masterStatusSchema.default("active"),
});

export const plantSchema = z.object({
  companyId: z.string().trim().min(1, "Company is required."),
  plantCode: z.string().trim().min(2, "Plant code is required.").max(20),
  plantName: z.string().trim().min(2, "Plant name is required."),
  plantType: z.enum([
    "manufacturing",
    "warehouse",
    "qc_laboratory",
    "rd",
    "corporate",
    "other",
  ]),
  address: z.string().trim().min(3, "Address is required."),
  city: z.string().trim().min(2, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  country: z.string().trim().min(2, "Country is required."),
  postalCode: z.string().trim().min(4, "Postal code is required."),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: optionalEmail,
  manufacturingLicense: z.string().trim().optional(),
  licenseExpiryDate: z.string().trim().optional(),
  status: masterStatusSchema.default("active"),
});

export const departmentSchema = z.object({
  plantId: z.string().trim().min(1, "Plant is required."),
  departmentCode: z.string().trim().min(2, "Department code is required."),
  departmentName: z.string().trim().min(2, "Department name is required."),
  departmentHead: z.string().trim().optional(),
  description: z.string().trim().optional(),
  status: masterStatusSchema.default("active"),
});

export const areaSchema = z.object({
  plantId: z.string().trim().min(1, "Plant is required."),
  areaCode: z.string().trim().min(2, "Area code is required."),
  areaName: z.string().trim().min(2, "Area name is required."),
  areaType: z.enum([
    "production",
    "dispensing",
    "packaging",
    "qc_laboratory",
    "microbiology",
    "warehouse",
    "quarantine",
    "approved",
    "rejected",
    "finished_goods",
    "cold_storage",
    "other",
  ]),
  departmentId: z.string().trim().optional(),
  temperatureRequirement: z.string().trim().optional(),
  humidityRequirement: z.string().trim().optional(),
  description: z.string().trim().optional(),
  status: masterStatusSchema.default("active"),
});

export const warehouseSchema = z.object({
  plantId: z.string().trim().min(1, "Plant is required."),
  warehouseCode: z.string().trim().min(2, "Warehouse code is required."),
  warehouseName: z.string().trim().min(2, "Warehouse name is required."),
  warehouseType: z.enum([
    "raw_material",
    "packaging_material",
    "finished_goods",
    "cold_storage",
    "quarantine",
    "rejected",
    "returned_goods",
    "controlled_temperature",
    "dispatch",
    "general",
    "other",
  ]),
  areaId: z.string().trim().optional(),
  address: z.string().trim().optional(),
  manager: z.string().trim().optional(),
  contactNumber: z.string().trim().optional(),
  status: masterStatusSchema.default("active"),
});

export const storageLocationSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  locationCode: z.string().trim().min(2, "Location code is required."),
  rack: z.string().trim().optional(),
  shelf: z.string().trim().optional(),
  bin: z.string().trim().optional(),
  locationType: z.enum(["zone", "aisle", "bin", "rack", "shelf", "cold_room", "floor", "other"]),
  parentLocationId: z.string().trim().optional(),
  capacity: z.coerce.number().min(0).optional(),
  uom: z.string().trim().optional(),
  temperatureZone: z.string().trim().optional(),
  temperatureRange: z.string().trim().optional(),
  humidityRange: z.string().trim().optional(),
  status: masterStatusSchema.default("active"),
});

export const uomSchema = z.object({
  uomCode: z.string().trim().min(1, "UOM code is required.").max(12),
  uomName: z.string().trim().min(2, "UOM name is required."),
  category: z.enum(["weight", "volume", "quantity", "length", "area", "other"]),
  decimalPrecision: z.coerce.number().int().min(0).max(6),
  status: masterStatusSchema.default("active"),
});

export const uomConversionSchema = z.object({
  fromUomId: z.string().trim().min(1, "From UOM is required."),
  toUomId: z.string().trim().min(1, "To UOM is required."),
  factor: z.coerce.number().positive("Conversion factor must be greater than zero."),
  status: masterStatusSchema.default("active"),
}).refine((value) => value.fromUomId !== value.toUomId, {
  message: "From and To UOM must be different.",
  path: ["toUomId"],
});

export const financialYearSchema = z
  .object({
    name: z.string().trim().min(4, "Financial year name is required."),
    startDate: z.string().trim().min(1, "Start date is required."),
    endDate: z.string().trim().min(1, "End date is required."),
    status: masterStatusSchema.default("active"),
    isCurrent: z.boolean().default(false),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export const currencySchema = z.object({
  currencyCode: z.string().trim().min(3, "Currency code is required.").max(3),
  currencyName: z.string().trim().min(2, "Currency name is required."),
  symbol: z.string().trim().min(1, "Symbol is required."),
  decimalPlaces: z.coerce.number().int().min(0).max(4),
  status: masterStatusSchema.default("active"),
});

export const taxSchema = z
  .object({
    taxCode: z.string().trim().min(2, "Tax code is required."),
    taxName: z.string().trim().min(2, "Tax name is required."),
    taxType: z.enum(["gst", "cgst", "sgst", "igst", "tds", "other"]),
    percentage: z.coerce.number().min(0).max(100, "Percentage cannot exceed 100."),
    applicableFrom: z.string().trim().min(1, "Applicable from date is required."),
    applicableTo: z.string().trim().optional(),
    status: masterStatusSchema.default("active"),
  })
  .refine(
    (value) => !value.applicableTo || value.applicableTo >= value.applicableFrom,
    {
      message: "Applicable to must be on or after the from date.",
      path: ["applicableTo"],
    }
  );

export const documentNumberingSchema = z.object({
  documentType: z.string().trim().min(2, "Document type is required."),
  prefix: z.string().trim().min(1, "Prefix is required."),
  financialYear: z.string().trim().optional(),
  startingNumber: z.coerce.number().int().min(1),
  currentNumber: z.coerce.number().int().min(0).optional(),
  numberLength: z.coerce.number().int().min(3).max(10),
  separator: z.string().trim().max(3).default("-"),
  resetFrequency: z.enum(["never", "yearly", "monthly"]),
  status: masterStatusSchema.default("active"),
});

export const workflowStepSchema = z.object({
  sequence: z.coerce.number().int().min(1),
  role: z.string().trim().min(1, "Role is required."),
  approvalType: z.enum(["approve", "reject", "review", "acknowledge"]),
  required: z.boolean().default(true),
  label: z.string().trim().min(1, "Step label is required."),
});

export const approvalWorkflowSchema = z.object({
  module: z.string().trim().min(2, "Module is required."),
  workflowName: z.string().trim().min(2, "Workflow name is required."),
  steps: z.array(workflowStepSchema).min(1, "Add at least one approval step."),
  status: masterStatusSchema.default("active"),
});

export const nextNumberSchema = z.object({
  documentType: z.string().trim().min(2),
  financialYear: z.string().trim().optional(),
});

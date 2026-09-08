import type { ZodType } from "zod";
import {
  approvalWorkflowSchema,
  areaSchema,
  companySchema,
  currencySchema,
  departmentSchema,
  documentNumberingSchema,
  financialYearSchema,
  plantSchema,
  storageLocationSchema,
  taxSchema,
  uomConversionSchema,
  uomSchema,
  warehouseSchema,
} from "@/lib/validation/masters";
import { PRODUCT_MASTER_DEFINITIONS } from "@/lib/products/definitions";
import { PARTNER_MASTER_DEFINITIONS } from "@/lib/partners/definitions";
import type { MasterEntity } from "@/types/masters";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "date"
  | "select"
  | "toggle"
  | "relation"
  | "steps"
  | "parameters";

export interface MasterField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  span?: 1 | 2;
  options?: Array<{ label: string; value: string }>;
  relation?: MasterEntity;
  relationLabel?: string;
  activeOnly?: boolean;
  hint?: string;
  section?: string;
  visibleWhen?: { field: string; values: string[] };
}

export interface MasterDefinition {
  entity: MasterEntity;
  collection: string;
  title: string;
  description: string;
  idField: string;
  codeField: string;
  nameField: string;
  uniqueScope?:
    | "companyId"
    | "plantId"
    | "warehouseId"
    | "documentType"
    | "customerId"
    | "productId"
    | "materialId"
    | "formulaId"
    | "vendorId"
    | "parentId";
  schema: ZodType;
  filters: Array<
    | "status"
    | "companyId"
    | "plantId"
    | "warehouseId"
    | "departmentId"
    | "productId"
    | "materialId"
    | "customerId"
    | "supplierId"
    | "productType"
    | "materialType"
    | "dosageForm"
    | "formulaId"
    | "vendorId"
    | "customerType"
    | "vendorType"
    | "qualificationStatus"
    | "riskCategory"
    | "country"
  >;
  statusOptions?: Array<{ label: string; value: string }>;
  defaultStatus?: string;
  permissionModule?: "masters" | "products" | "materials" | "customers" | "vendors";
  columns: Array<{ key: string; header: string; hideOnMobile?: boolean }>;
  fields: MasterField[];
}

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const ORGANIZATION_DEFINITIONS = {
  companies: {
    entity: "companies",
    collection: "companies",
    title: "Company Master",
    description: "Legal entities that own plants, licenses, and commercial documents.",
    idField: "companyId",
    codeField: "companyCode",
    nameField: "companyName",
    schema: companySchema,
    filters: ["status"],
    columns: [
      { key: "companyCode", header: "Code" },
      { key: "companyName", header: "Company" },
      { key: "legalName", header: "Legal name", hideOnMobile: true },
      { key: "gstNumber", header: "GSTIN", hideOnMobile: true },
      { key: "city", header: "City", hideOnMobile: true },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "companyCode", label: "Company code", type: "text", required: true },
      { name: "companyName", label: "Company name", type: "text", required: true },
      { name: "legalName", label: "Legal name", type: "text", required: true },
      { name: "registrationNumber", label: "Registration number", type: "text" },
      { name: "gstNumber", label: "GSTIN", type: "text", hint: "Indian GST format when provided." },
      { name: "panNumber", label: "PAN", type: "text" },
      { name: "cinNumber", label: "CIN", type: "text" },
      { name: "drugLicenseNumber", label: "Drug license", type: "text" },
      { name: "manufacturingLicenseNumber", label: "Manufacturing license", type: "text" },
      { name: "addressLine1", label: "Address line 1", type: "text", required: true, span: 2 },
      { name: "addressLine2", label: "Address line 2", type: "text", span: 2 },
      { name: "city", label: "City", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "postalCode", label: "Postal code", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "website", label: "Website", type: "text" },
      { name: "logo", label: "Logo URL", type: "text" },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  plants: {
    entity: "plants",
    collection: "plants",
    title: "Plant Master",
    description: "Manufacturing, warehouse, laboratory, and corporate sites.",
    idField: "plantId",
    codeField: "plantCode",
    nameField: "plantName",
    uniqueScope: "companyId",
    schema: plantSchema,
    filters: ["status", "companyId"],
    columns: [
      { key: "plantCode", header: "Code" },
      { key: "plantName", header: "Plant" },
      { key: "plantType", header: "Type" },
      { key: "city", header: "City", hideOnMobile: true },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "companyId", label: "Company", type: "relation", relation: "companies", required: true, activeOnly: true },
      { name: "plantCode", label: "Plant code", type: "text", required: true },
      { name: "plantName", label: "Plant name", type: "text", required: true },
      {
        name: "plantType",
        label: "Plant type",
        type: "select",
        required: true,
        options: [
          { label: "Manufacturing", value: "manufacturing" },
          { label: "Warehouse", value: "warehouse" },
          { label: "QC Laboratory", value: "qc_laboratory" },
          { label: "R&D", value: "rd" },
          { label: "Corporate", value: "corporate" },
          { label: "Other", value: "other" },
        ],
      },
      { name: "address", label: "Address", type: "textarea", required: true, span: 2 },
      { name: "city", label: "City", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "postalCode", label: "Postal code", type: "text", required: true },
      { name: "contactPerson", label: "Contact person", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "manufacturingLicense", label: "Manufacturing license", type: "text" },
      { name: "licenseExpiryDate", label: "License expiry", type: "date" },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  departments: {
    entity: "departments",
    collection: "departments",
    title: "Department Master",
    description: "Plant departments used for people, approvals, and training.",
    idField: "departmentId",
    codeField: "departmentCode",
    nameField: "departmentName",
    uniqueScope: "plantId",
    schema: departmentSchema,
    filters: ["status", "plantId"],
    columns: [
      { key: "departmentCode", header: "Code" },
      { key: "departmentName", header: "Department" },
      { key: "departmentHead", header: "Head", hideOnMobile: true },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "plantId", label: "Plant", type: "relation", relation: "plants", required: true, activeOnly: true },
      { name: "departmentCode", label: "Department code", type: "text", required: true },
      { name: "departmentName", label: "Department name", type: "text", required: true },
      { name: "departmentHead", label: "Department head", type: "text" },
      { name: "description", label: "Description", type: "textarea", span: 2 },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  areas: {
    entity: "areas",
    collection: "areas",
    title: "Area Master",
    description: "GMP areas such as dispensing, quarantine, and microbiology.",
    idField: "areaId",
    codeField: "areaCode",
    nameField: "areaName",
    uniqueScope: "plantId",
    schema: areaSchema,
    filters: ["status", "plantId", "departmentId"],
    columns: [
      { key: "areaCode", header: "Code" },
      { key: "areaName", header: "Area" },
      { key: "areaType", header: "Type" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "plantId", label: "Plant", type: "relation", relation: "plants", required: true, activeOnly: true },
      { name: "departmentId", label: "Department", type: "relation", relation: "departments", activeOnly: true },
      { name: "areaCode", label: "Area code", type: "text", required: true },
      { name: "areaName", label: "Area name", type: "text", required: true },
      {
        name: "areaType",
        label: "Area type",
        type: "select",
        required: true,
        options: [
          { label: "Production Area", value: "production" },
          { label: "Dispensing Area", value: "dispensing" },
          { label: "Packaging Area", value: "packaging" },
          { label: "QC Laboratory", value: "qc_laboratory" },
          { label: "Microbiology", value: "microbiology" },
          { label: "Warehouse", value: "warehouse" },
          { label: "Quarantine Area", value: "quarantine" },
          { label: "Approved Area", value: "approved" },
          { label: "Rejected Area", value: "rejected" },
          { label: "Finished Goods Area", value: "finished_goods" },
          { label: "Cold Storage", value: "cold_storage" },
          { label: "Other", value: "other" },
        ],
      },
      { name: "temperatureRequirement", label: "Temperature", type: "text" },
      { name: "humidityRequirement", label: "Humidity", type: "text" },
      { name: "description", label: "Description", type: "textarea", span: 2 },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  warehouses: {
    entity: "warehouses",
    collection: "warehouses",
    title: "Warehouse Master",
    description: "Plant warehouses for materials, quarantine, and finished goods.",
    idField: "warehouseId",
    codeField: "warehouseCode",
    nameField: "warehouseName",
    uniqueScope: "plantId",
    schema: warehouseSchema,
    filters: ["status", "plantId"],
    columns: [
      { key: "warehouseCode", header: "Code" },
      { key: "warehouseName", header: "Warehouse" },
      { key: "warehouseType", header: "Type" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "plantId", label: "Plant", type: "relation", relation: "plants", required: true, activeOnly: true },
      { name: "areaId", label: "Area", type: "relation", relation: "areas", activeOnly: true },
      { name: "warehouseCode", label: "Warehouse code", type: "text", required: true },
      { name: "warehouseName", label: "Warehouse name", type: "text", required: true },
      {
        name: "warehouseType",
        label: "Warehouse type",
        type: "select",
        required: true,
        options: [
          { label: "Raw Material", value: "raw_material" },
          { label: "Packaging Material", value: "packaging_material" },
          { label: "Finished Goods", value: "finished_goods" },
          { label: "Cold Storage", value: "cold_storage" },
          { label: "Quarantine", value: "quarantine" },
          { label: "Rejected", value: "rejected" },
          { label: "Returned Goods", value: "returned_goods" },
          { label: "General", value: "general" },
        ],
      },
      { name: "address", label: "Address", type: "textarea", span: 2 },
      { name: "manager", label: "Manager", type: "text" },
      { name: "contactNumber", label: "Contact number", type: "text" },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  storageLocations: {
    entity: "storageLocations",
    collection: "storageLocations",
    title: "Storage Location Master",
    description: "Rack, shelf, and bin locations inside a warehouse.",
    idField: "locationId",
    codeField: "locationCode",
    nameField: "locationCode",
    uniqueScope: "warehouseId",
    schema: storageLocationSchema,
    filters: ["status", "warehouseId"],
    columns: [
      { key: "locationCode", header: "Code" },
      { key: "rack", header: "Rack" },
      { key: "shelf", header: "Shelf", hideOnMobile: true },
      { key: "bin", header: "Bin", hideOnMobile: true },
      { key: "locationType", header: "Type" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "warehouseId", label: "Warehouse", type: "relation", relation: "warehouses", required: true, activeOnly: true },
      { name: "locationCode", label: "Location code", type: "text", required: true },
      {
        name: "locationType",
        label: "Location type",
        type: "select",
        required: true,
        options: [
          { label: "Bin", value: "bin" },
          { label: "Rack", value: "rack" },
          { label: "Shelf", value: "shelf" },
          { label: "Cold Room", value: "cold_room" },
          { label: "Floor", value: "floor" },
          { label: "Other", value: "other" },
        ],
      },
      { name: "rack", label: "Rack", type: "text" },
      { name: "shelf", label: "Shelf", type: "text" },
      { name: "bin", label: "Bin", type: "text" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "uom", label: "UOM", type: "relation", relation: "uoms", activeOnly: true },
      { name: "temperatureZone", label: "Temperature zone", type: "text" },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  uoms: {
    entity: "uoms",
    collection: "uoms",
    title: "Unit of Measurement",
    description: "Weight, volume, and pack units used across inventory and production.",
    idField: "uomId",
    codeField: "uomCode",
    nameField: "uomName",
    schema: uomSchema,
    filters: ["status"],
    columns: [
      { key: "uomCode", header: "Code" },
      { key: "uomName", header: "Name" },
      { key: "category", header: "Category" },
      { key: "decimalPrecision", header: "Precision", hideOnMobile: true },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "uomCode", label: "UOM code", type: "text", required: true },
      { name: "uomName", label: "UOM name", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: [
          { label: "Weight", value: "weight" },
          { label: "Volume", value: "volume" },
          { label: "Quantity", value: "quantity" },
          { label: "Length", value: "length" },
          { label: "Area", value: "area" },
          { label: "Other", value: "other" },
        ],
      },
      { name: "decimalPrecision", label: "Decimal precision", type: "number", required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  uomConversions: {
    entity: "uomConversions",
    collection: "uomConversions",
    title: "UOM Conversions",
    description: "Explicit conversion rules. Conversions never happen without a configured factor.",
    idField: "conversionId",
    codeField: "uniqueKey",
    nameField: "uniqueKey",
    schema: uomConversionSchema,
    filters: ["status"],
    columns: [
      { key: "fromUomId", header: "From" },
      { key: "toUomId", header: "To" },
      { key: "factor", header: "Factor" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "fromUomId", label: "From UOM", type: "relation", relation: "uoms", required: true, activeOnly: true },
      { name: "toUomId", label: "To UOM", type: "relation", relation: "uoms", required: true, activeOnly: true },
      { name: "factor", label: "Factor", type: "number", required: true, hint: "1 From = Factor To. Example: 1 KG = 1000 G." },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  financialYears: {
    entity: "financialYears",
    collection: "financialYears",
    title: "Financial Year",
    description: "Accounting periods used by document numbering and finance.",
    idField: "financialYearId",
    codeField: "name",
    nameField: "name",
    schema: financialYearSchema,
    filters: ["status"],
    columns: [
      { key: "name", header: "Year" },
      { key: "startDate", header: "Start" },
      { key: "endDate", header: "End" },
      { key: "isCurrent", header: "Current" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, hint: "Example: 2026-27" },
      { name: "startDate", label: "Start date", type: "date", required: true },
      { name: "endDate", label: "End date", type: "date", required: true },
      { name: "isCurrent", label: "Current financial year", type: "toggle" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          ...statusOptions,
          { label: "Closed", value: "closed" },
        ],
      },
    ],
  },
  currencies: {
    entity: "currencies",
    collection: "currencies",
    title: "Currency Master",
    description: "Currencies available for purchasing, sales, and finance.",
    idField: "currencyCode",
    codeField: "currencyCode",
    nameField: "currencyName",
    schema: currencySchema,
    filters: ["status"],
    columns: [
      { key: "currencyCode", header: "Code" },
      { key: "currencyName", header: "Name" },
      { key: "symbol", header: "Symbol" },
      { key: "decimalPlaces", header: "Decimals", hideOnMobile: true },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "currencyCode", label: "Currency code", type: "text", required: true },
      { name: "currencyName", label: "Currency name", type: "text", required: true },
      { name: "symbol", label: "Symbol", type: "text", required: true },
      { name: "decimalPlaces", label: "Decimal places", type: "number", required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  taxes: {
    entity: "taxes",
    collection: "taxes",
    title: "Tax Master",
    description: "Configurable GST and other tax codes. Rates are never hard-coded.",
    idField: "taxId",
    codeField: "taxCode",
    nameField: "taxName",
    schema: taxSchema,
    filters: ["status"],
    columns: [
      { key: "taxCode", header: "Code" },
      { key: "taxName", header: "Tax" },
      { key: "taxType", header: "Type" },
      { key: "percentage", header: "%" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "taxCode", label: "Tax code", type: "text", required: true },
      { name: "taxName", label: "Tax name", type: "text", required: true },
      {
        name: "taxType",
        label: "Tax type",
        type: "select",
        required: true,
        options: [
          { label: "GST", value: "gst" },
          { label: "CGST", value: "cgst" },
          { label: "SGST", value: "sgst" },
          { label: "IGST", value: "igst" },
          { label: "TDS", value: "tds" },
          { label: "Other", value: "other" },
        ],
      },
      { name: "percentage", label: "Percentage", type: "number", required: true },
      { name: "applicableFrom", label: "Applicable from", type: "date", required: true },
      { name: "applicableTo", label: "Applicable to", type: "date" },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  documentNumbering: {
    entity: "documentNumbering",
    collection: "documentNumbering",
    title: "Document Numbering",
    description: "Server-side number series for PO, BMR, deviations, CAPA, and change control.",
    idField: "numberingId",
    codeField: "documentType",
    nameField: "prefix",
    uniqueScope: "documentType",
    schema: documentNumberingSchema,
    filters: ["status"],
    columns: [
      { key: "documentType", header: "Document" },
      { key: "prefix", header: "Prefix" },
      { key: "financialYear", header: "Year", hideOnMobile: true },
      { key: "currentNumber", header: "Current" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "documentType", label: "Document type", type: "text", required: true, hint: "Example: PO, BMR, PR, DEV, CAPA, CC" },
      { name: "prefix", label: "Prefix", type: "text", required: true },
      { name: "financialYear", label: "Financial year", type: "relation", relation: "financialYears" },
      { name: "startingNumber", label: "Starting number", type: "number", required: true },
      { name: "numberLength", label: "Number length", type: "number", required: true },
      { name: "separator", label: "Separator", type: "text" },
      {
        name: "resetFrequency",
        label: "Reset frequency",
        type: "select",
        required: true,
        options: [
          { label: "Never", value: "never" },
          { label: "Yearly", value: "yearly" },
          { label: "Monthly", value: "monthly" },
        ],
      },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
  approvalWorkflows: {
    entity: "approvalWorkflows",
    collection: "approvalWorkflows",
    title: "Approval Workflows",
    description: "Configurable review chains for requisitions, deviations, CAPA, and change control.",
    idField: "workflowId",
    codeField: "workflowName",
    nameField: "workflowName",
    schema: approvalWorkflowSchema,
    filters: ["status"],
    columns: [
      { key: "workflowName", header: "Workflow" },
      { key: "module", header: "Module" },
      { key: "status", header: "Status" },
    ],
    fields: [
      { name: "module", label: "Module", type: "text", required: true, hint: "Example: purchase_requisition, deviation, capa, change_control" },
      { name: "workflowName", label: "Workflow name", type: "text", required: true },
      { name: "steps", label: "Approval steps", type: "steps", span: 2, required: true },
      { name: "status", label: "Status", type: "select", options: statusOptions, required: true },
    ],
  },
} as const satisfies Partial<Record<MasterEntity, MasterDefinition>>;

export const MASTER_DEFINITIONS = {
  ...ORGANIZATION_DEFINITIONS,
  ...PRODUCT_MASTER_DEFINITIONS,
  ...PARTNER_MASTER_DEFINITIONS,
} as Record<MasterEntity, MasterDefinition>;

export function getMasterDefinition(entity: string) {
  return MASTER_DEFINITIONS[entity as MasterEntity];
}

export const MASTER_ENTITIES = Object.keys(MASTER_DEFINITIONS) as MasterEntity[];

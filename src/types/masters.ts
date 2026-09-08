export type MasterStatus = "active" | "inactive" | "closed";

export type PlantType =
  | "manufacturing"
  | "warehouse"
  | "qc_laboratory"
  | "rd"
  | "corporate"
  | "other";

export type AreaType =
  | "production"
  | "dispensing"
  | "packaging"
  | "qc_laboratory"
  | "microbiology"
  | "warehouse"
  | "quarantine"
  | "approved"
  | "rejected"
  | "finished_goods"
  | "cold_storage"
  | "other";

export type WarehouseType =
  | "raw_material"
  | "packaging_material"
  | "finished_goods"
  | "cold_storage"
  | "quarantine"
  | "rejected"
  | "returned_goods"
  | "controlled_temperature"
  | "dispatch"
  | "general"
  | "other";

export type LocationType = "zone" | "aisle" | "bin" | "rack" | "shelf" | "cold_room" | "floor" | "other";

export type UomCategory = "weight" | "volume" | "quantity" | "length" | "area" | "other";

export type TaxType = "gst" | "cgst" | "sgst" | "igst" | "tds" | "other";

export type ResetFrequency = "never" | "yearly" | "monthly";

export type ApprovalType = "approve" | "reject" | "review" | "acknowledge";

export interface AuditFields {
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Company extends AuditFields {
  companyId: string;
  companyCode: string;
  companyName: string;
  legalName: string;
  registrationNumber?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;
  drugLicenseNumber?: string;
  manufacturingLicenseNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  status: MasterStatus;
  searchIndex: string;
}

export interface Plant extends AuditFields {
  plantId: string;
  companyId: string;
  plantCode: string;
  plantName: string;
  plantType: PlantType;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  manufacturingLicense?: string;
  licenseExpiryDate?: string;
  status: MasterStatus;
  uniqueKey: string;
  searchIndex: string;
}

export interface Department extends AuditFields {
  departmentId: string;
  plantId: string;
  departmentCode: string;
  departmentName: string;
  departmentHead?: string;
  description?: string;
  status: MasterStatus;
  uniqueKey: string;
  searchIndex: string;
}

export interface Area extends AuditFields {
  areaId: string;
  plantId: string;
  areaCode: string;
  areaName: string;
  areaType: AreaType;
  departmentId?: string;
  temperatureRequirement?: string;
  humidityRequirement?: string;
  description?: string;
  status: MasterStatus;
  uniqueKey: string;
  searchIndex: string;
}

export interface Warehouse extends AuditFields {
  warehouseId: string;
  plantId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  areaId?: string;
  address?: string;
  manager?: string;
  contactNumber?: string;
  status: MasterStatus;
  uniqueKey: string;
  searchIndex: string;
}

export interface StorageLocation extends AuditFields {
  locationId: string;
  warehouseId: string;
  locationCode: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  locationType: LocationType;
  capacity?: number;
  uom?: string;
  temperatureZone?: string;
  status: MasterStatus;
  uniqueKey: string;
  searchIndex: string;
}

export interface UnitOfMeasure extends AuditFields {
  uomId: string;
  uomCode: string;
  uomName: string;
  category: UomCategory;
  decimalPrecision: number;
  status: MasterStatus;
  searchIndex: string;
}

export interface UomConversion extends AuditFields {
  conversionId: string;
  fromUomId: string;
  toUomId: string;
  factor: number;
  status: MasterStatus;
  uniqueKey: string;
}

export interface FinancialYear extends AuditFields {
  financialYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: MasterStatus;
  isCurrent: boolean;
  searchIndex: string;
}

export interface Currency extends AuditFields {
  currencyCode: string;
  currencyName: string;
  symbol: string;
  decimalPlaces: number;
  status: MasterStatus;
  searchIndex: string;
}

export interface Tax extends AuditFields {
  taxId: string;
  taxCode: string;
  taxName: string;
  taxType: TaxType;
  percentage: number;
  applicableFrom: string;
  applicableTo?: string;
  status: MasterStatus;
  searchIndex: string;
}

export interface DocumentNumbering extends AuditFields {
  numberingId: string;
  documentType: string;
  prefix: string;
  financialYear?: string;
  startingNumber: number;
  currentNumber: number;
  numberLength: number;
  separator: string;
  resetFrequency: ResetFrequency;
  status: MasterStatus;
  uniqueKey: string;
  searchIndex: string;
}

export interface WorkflowStep {
  sequence: number;
  role: string;
  approvalType: ApprovalType;
  required: boolean;
  label: string;
}

export interface ApprovalWorkflow extends AuditFields {
  workflowId: string;
  module: string;
  workflowName: string;
  steps: WorkflowStep[];
  status: MasterStatus;
  searchIndex: string;
}

export type MasterEntity =
  | "companies"
  | "plants"
  | "departments"
  | "areas"
  | "warehouses"
  | "storageLocations"
  | "uoms"
  | "uomConversions"
  | "financialYears"
  | "currencies"
  | "taxes"
  | "documentNumbering"
  | "approvalWorkflows"
  | "customers"
  | "suppliers"
  | "products"
  | "productVersions"
  | "productCustomerMappings"
  | "productPackaging"
  | "productStorageConfigurations"
  | "productRegulatoryInformation"
  | "materials"
  | "materialSupplierMappings"
  | "materialSpecifications"
  | "materialStorageConfigurations"
  | "productMaterials"
  | "productFormulas"
  | "productFormulaLines"
  | "vendors"
  | "customerContacts"
  | "vendorContacts"
  | "customerAddresses"
  | "vendorAddresses"
  | "customerQualifications"
  | "vendorQualifications"
  | "customerDocuments"
  | "vendorDocuments"
  | "customerContracts"
  | "vendorContracts"
  | "vendorMaterials"
  | "vendorPerformance";

export interface MasterListQuery {
  status?: string;
  companyId?: string;
  plantId?: string;
  warehouseId?: string;
  departmentId?: string;
  productId?: string;
  materialId?: string;
  customerId?: string;
  supplierId?: string;
  formulaId?: string;
  productType?: string;
  materialType?: string;
  dosageForm?: string;
  uom?: string;
  vendorId?: string;
  customerType?: string;
  vendorType?: string;
  qualificationStatus?: string;
  riskCategory?: string;
  country?: string;
  search?: string;
  pageSize?: number;
  cursor?: string;
}

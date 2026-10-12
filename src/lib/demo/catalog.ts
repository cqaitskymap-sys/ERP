type DemoRow = Record<string, unknown> & { id: string };

function row(id: string, when: string, fields: Record<string, unknown>): DemoRow {
  const searchIndex = [id, ...Object.values(fields).filter((value) => typeof value === "string")]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  const name = String(
    fields.customerName ||
      fields.vendorName ||
      fields.productName ||
      fields.materialName ||
      fields.fullName ||
      fields.name ||
      fields.title ||
      id
  );
  return {
    status: "active",
    createdAt: `${when}T06:30:00.000Z`,
    updatedAt: `${when}T09:15:00.000Z`,
    createdBy: "demo-preview",
    updatedBy: "demo-preview",
    searchIndex,
    nameIndex: name.toLowerCase(),
    ...fields,
    id,
  };
}

const C = {
  cipla: "Cipla Limited",
  sun: "Sun Pharmaceutical",
  reddy: "Dr. Reddy's Laboratories",
  abbott: "Abbott India",
  mankind: "Mankind Pharma",
} as const;

const P = {
  pcm: "Paracetamol 500 mg",
  amox: "Amoxicillin 500 mg",
  panto: "Pantoprazole 40 mg",
  met: "Metformin 500 mg",
  azi: "Azithromycin 250 mg",
  cet: "Cetirizine 10 mg",
} as const;

const V = {
  auro: "Aurobindo API",
  signet: "Signet Excipients",
  uflex: "UFlex Packaging",
  huht: "Huhtamaki Foils",
} as const;

const W = {
  rm: "Raw Material Store",
  q: "Quarantine Store",
  fg: "Finished Goods Store",
  cold: "Cold Room",
} as const;

const E = {
  ananya: "Ananya Sharma",
  rohit: "Rohit Mehta",
  priya: "Priya Nair",
  vikram: "Vikram Singh",
  neha: "Neha Kapoor",
  arjun: "Arjun Desai",
} as const;

export const DEMO_CATALOG: Record<string, DemoRow[]> = {
  companies: [
    row("patri", "2026-04-01", {
      companyId: "patri",
      companyCode: "PATRI",
      companyName: "PATRI Lifesciences",
      legalName: "PATRI Lifesciences Private Limited",
      registrationNumber: "U24230RJ2014PTC048216",
      gstNumber: "08AABCP3921Q1Z8",
      panNumber: "AABCP3921Q",
      cinNumber: "U24230RJ2014PTC048216",
      drugLicenseNumber: "RJ/BHW/2014/1186",
      manufacturingLicenseNumber: "ML-RJ-2014-0842",
      addressLine1: "Plot 42, RIICO Industrial Area",
      addressLine2: "Phase III, Bhiwadi",
      city: "Bhiwadi",
      state: "Rajasthan",
      country: "India",
      postalCode: "301019",
      phone: "+91 1493 220 180",
      email: "quality@patrilifesciences.com",
      website: "https://patrilifesciences.com",
      status: "active",
    }),
  ],
  plants: [
    row("bhiwadi-mfg", "2026-04-01", {
      companyId: "patri",
      plantCode: "PLT-BHW",
      plantName: "Bhiwadi Manufacturing",
      plantType: "manufacturing",
      address: "Plot 42, RIICO Industrial Area, Phase III",
      city: "Bhiwadi",
      state: "Rajasthan",
      country: "India",
      postalCode: "301019",
      contactPerson: E.rohit,
      phone: "+91 1493 220 210",
      email: "plant@patrilifesciences.com",
      manufacturingLicense: "ML-RJ-2014-0842",
      licenseExpiryDate: "2028-03-31",
      status: "active",
    }),
    row("bhiwadi-qc", "2026-04-01", {
      companyId: "patri",
      plantCode: "PLT-QC",
      plantName: "Bhiwadi QC Laboratory",
      plantType: "qc_laboratory",
      address: "Plot 42-A, RIICO Industrial Area, Phase III",
      city: "Bhiwadi",
      state: "Rajasthan",
      country: "India",
      postalCode: "301019",
      contactPerson: E.priya,
      phone: "+91 1493 220 240",
      email: "qc@patrilifesciences.com",
      manufacturingLicense: "TL-RJ-2016-0194",
      licenseExpiryDate: "2027-11-30",
      status: "active",
    }),
  ],
  departments: [
    row("qa", "2026-04-02", { plantId: "bhiwadi-mfg", departmentCode: "QA", departmentName: "Quality Assurance", departmentHead: E.ananya, status: "active" }),
    row("qc", "2026-04-02", { plantId: "bhiwadi-qc", departmentCode: "QC", departmentName: "Quality Control", departmentHead: E.priya, status: "active" }),
    row("production", "2026-04-02", { plantId: "bhiwadi-mfg", departmentCode: "PRD", departmentName: "Production", departmentHead: E.rohit, status: "active" }),
    row("warehouse", "2026-04-02", { plantId: "bhiwadi-mfg", departmentCode: "WH", departmentName: "Warehouse", departmentHead: E.vikram, status: "active" }),
    row("sales", "2026-04-02", { plantId: "bhiwadi-mfg", departmentCode: "SAL", departmentName: "Commercial", departmentHead: E.neha, status: "active" }),
    row("finance", "2026-04-02", { plantId: "bhiwadi-mfg", departmentCode: "FIN", departmentName: "Finance", departmentHead: E.arjun, status: "active" }),
  ],
  areas: [
    row("dispensing", "2026-04-02", { plantId: "bhiwadi-mfg", departmentId: "production", areaCode: "DSP", areaName: "Dispensing Suite", areaType: "dispensing", temperatureRequirement: "22 ± 3 °C", humidityRequirement: "NMT 55% RH", status: "active" }),
    row("compression", "2026-04-02", { plantId: "bhiwadi-mfg", departmentId: "production", areaCode: "CMP", areaName: "Compression Hall", areaType: "production", temperatureRequirement: "22 ± 3 °C", humidityRequirement: "NMT 50% RH", status: "active" }),
    row("packing-hall", "2026-04-02", { plantId: "bhiwadi-mfg", departmentId: "production", areaCode: "PKG", areaName: "Primary Packing Hall", areaType: "packaging", status: "active" }),
    row("micro", "2026-04-02", { plantId: "bhiwadi-qc", departmentId: "qc", areaCode: "MIC", areaName: "Microbiology", areaType: "microbiology", status: "active" }),
  ],
  warehouses: [
    row(W.rm, "2026-04-03", { plantId: "bhiwadi-mfg", areaId: "dispensing", warehouseCode: "WH-RM", warehouseName: W.rm, warehouseType: "raw_material", address: "Block A, Ground Floor", manager: E.vikram, contactNumber: "+91 98765 11021", status: "active" }),
    row(W.q, "2026-04-03", { plantId: "bhiwadi-mfg", warehouseCode: "WH-QTN", warehouseName: W.q, warehouseType: "quarantine", address: "Block A, Cage 2", manager: E.vikram, status: "active" }),
    row(W.fg, "2026-04-03", { plantId: "bhiwadi-mfg", warehouseCode: "WH-FG", warehouseName: W.fg, warehouseType: "finished_goods", address: "Block C", manager: E.vikram, status: "active" }),
    row(W.cold, "2026-04-03", { plantId: "bhiwadi-mfg", warehouseCode: "WH-CLD", warehouseName: W.cold, warehouseType: "cold_storage", address: "Block C, Room 2", manager: E.vikram, status: "active" }),
  ],
  storageLocations: [
    row("RM-A-01", "2026-04-03", { warehouseId: W.rm, locationCode: "RM-A-01", locationType: "rack", rack: "A", shelf: "01", bin: "04", capacity: 800, uom: "KG", temperatureZone: "Ambient", status: "active" }),
    row("QTN-01", "2026-04-03", { warehouseId: W.q, locationCode: "QTN-01", locationType: "floor", rack: "Q", shelf: "01", bin: "01", capacity: 400, temperatureZone: "Ambient", status: "active" }),
    row("FG-C-12", "2026-04-03", { warehouseId: W.fg, locationCode: "FG-C-12", locationType: "rack", rack: "C", shelf: "12", bin: "03", capacity: 1200, temperatureZone: "Ambient", status: "active" }),
    row("CLD-02", "2026-04-03", { warehouseId: W.cold, locationCode: "CLD-02", locationType: "cold_room", rack: "K", shelf: "02", bin: "01", capacity: 200, temperatureZone: "2–8 °C", status: "active" }),
  ],
  uoms: [
    row("KG", "2026-04-01", { uomCode: "KG", uomName: "Kilogram", category: "weight", decimalPrecision: 3, status: "active" }),
    row("G", "2026-04-01", { uomCode: "G", uomName: "Gram", category: "weight", decimalPrecision: 3, status: "active" }),
    row("NOS", "2026-04-01", { uomCode: "NOS", uomName: "Numbers", category: "quantity", decimalPrecision: 0, status: "active" }),
    row("L", "2026-04-01", { uomCode: "L", uomName: "Litre", category: "volume", decimalPrecision: 3, status: "active" }),
  ],
  uomConversions: [
    row("kg-to-g", "2026-04-01", { fromUomId: "KG", toUomId: "G", factor: 1000, uniqueKey: "KG-G", status: "active" }),
  ],
  financialYears: [
    row("fy-2026-27", "2026-04-01", { name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true, status: "active" }),
  ],
  currencies: [
    row("INR", "2026-04-01", { currencyCode: "INR", currencyName: "Indian Rupee", symbol: "₹", status: "active" }),
    row("USD", "2026-04-01", { currencyCode: "USD", currencyName: "US Dollar", symbol: "$", status: "active" }),
  ],
  taxes: [
    row("gst-12", "2026-04-01", { taxCode: "GST12", taxName: "GST 12%", rate: 12, status: "active" }),
    row("gst-18", "2026-04-01", { taxCode: "GST18", taxName: "GST 18%", rate: 18, status: "active" }),
  ],

  customers: [
    row(C.cipla, "2026-05-02", { customerCode: "CUS-2026-00041", customerName: C.cipla, legalName: "Cipla Limited", customerType: "pharma_company", market: "India", country: "India", industry: "Pharmaceuticals", qualificationStatus: "qualified", riskCategory: "low", creditLimit: 25000000, paymentTerms: "45 days", currency: "INR", salesRepresentative: E.neha, accountManager: E.neha, commercialApprovalStatus: "approved", minShelfLifeMonths: 18, status: "active" }),
    row(C.sun, "2026-05-04", { customerCode: "CUS-2026-00042", customerName: C.sun, legalName: "Sun Pharmaceutical Industries Ltd", customerType: "contract_customer", market: "India + Emerging", country: "India", qualificationStatus: "qualified", riskCategory: "low", creditLimit: 18000000, paymentTerms: "30 days", currency: "INR", salesRepresentative: E.neha, status: "active" }),
    row(C.reddy, "2026-05-08", { customerCode: "CUS-2026-00048", customerName: C.reddy, legalName: "Dr. Reddy's Laboratories Ltd", customerType: "export", market: "US / EU", country: "India", qualificationStatus: "qualified", riskCategory: "medium", creditLimit: 32000000, paymentTerms: "60 days", currency: "USD", salesRepresentative: E.neha, status: "active" }),
    row(C.abbott, "2026-06-01", { customerCode: "CUS-2026-00055", customerName: C.abbott, legalName: "Abbott Healthcare Pvt Ltd", customerType: "brand_owner", market: "India", country: "India", qualificationStatus: "conditionally_qualified", riskCategory: "low", creditLimit: 12000000, paymentTerms: "30 days", currency: "INR", salesRepresentative: E.neha, status: "active" }),
    row(C.mankind, "2026-06-12", { customerCode: "CUS-2026-00061", customerName: C.mankind, legalName: "Mankind Pharma Ltd", customerType: "third_party_manufacturing", market: "India", country: "India", qualificationStatus: "under_review", riskCategory: "medium", creditLimit: 8000000, paymentTerms: "45 days", currency: "INR", salesRepresentative: E.neha, status: "qa_review" }),
  ],
  vendors: [
    row(V.auro, "2026-04-18", { vendorCode: "VEN-2026-00012", vendorName: V.auro, legalName: "Aurobindo Pharma Limited", vendorType: "api_supplier", country: "India", city: "Hyderabad", qualificationStatus: "qualified", riskCategory: "low", paymentTerms: "45 days", currency: "INR", status: "active" }),
    row(V.signet, "2026-04-18", { vendorCode: "VEN-2026-00018", vendorName: V.signet, legalName: "Signet Chemical Corporation", vendorType: "excipient_supplier", country: "India", city: "Mumbai", qualificationStatus: "qualified", riskCategory: "low", paymentTerms: "30 days", currency: "INR", status: "active" }),
    row(V.uflex, "2026-05-01", { vendorCode: "VEN-2026-00027", vendorName: V.uflex, legalName: "UFlex Limited", vendorType: "packaging_supplier", country: "India", city: "Noida", qualificationStatus: "qualified", riskCategory: "medium", paymentTerms: "30 days", currency: "INR", status: "active" }),
    row(V.huht, "2026-05-11", { vendorCode: "VEN-2026-00033", vendorName: V.huht, legalName: "Huhtamaki India Ltd", vendorType: "printed_material_supplier", country: "India", city: "Pune", qualificationStatus: "conditionally_qualified", riskCategory: "medium", paymentTerms: "30 days", currency: "INR", status: "active" }),
  ],
  customerContacts: [
    row("cipla-qa", "2026-05-02", { customerId: C.cipla, name: "Meera Iyer", designation: "Vendor Quality", email: "meera.iyer@cipla.example", phone: "+91 22 2482 6000", status: "active" }),
    row("sun-scm", "2026-05-04", { customerId: C.sun, name: "Karan Malhotra", designation: "Supply Chain", email: "karan.malhotra@sunpharma.example", phone: "+91 22 4324 4324", status: "active" }),
  ],
  vendorContacts: [
    row("auro-sales", "2026-04-18", { vendorId: V.auro, name: "Sanjay Reddy", designation: "Key Account", email: "sanjay.reddy@aurobindo.example", phone: "+91 40 6672 5000", status: "active" }),
  ],
  customerAddresses: [
    row("cipla-mum", "2026-05-02", { customerId: C.cipla, addressType: "billing", city: "Mumbai", state: "Maharashtra", country: "India", postalCode: "400013", status: "active" }),
  ],
  vendorAddresses: [
    row("auro-hyd", "2026-04-18", { vendorId: V.auro, addressType: "site", city: "Hyderabad", state: "Telangana", country: "India", postalCode: "500090", status: "active" }),
  ],
  customerQualifications: [
    row("cq-cipla", "2026-05-20", { customerId: C.cipla, qualificationType: "periodic_review", qualificationStatus: "qualified", riskCategory: "low", expiryDate: "2027-05-20", status: "active" }),
  ],
  vendorQualifications: [
    row("vq-auro", "2026-04-22", { vendorId: V.auro, qualificationType: "audit_qualification", approvalStatus: "approved", riskCategory: "low", expiryDate: "2027-04-22", status: "active" }),
  ],
  customerContracts: [
    row("ctr-cipla-pcm", "2026-05-15", { customerId: C.cipla, contractNumber: "CTR-2026-014", contractType: "manufacturing", title: "Paracetamol tablets — annual supply", startDate: "2026-04-01", endDate: "2027-03-31", status: "active" }),
  ],
  vendorContracts: [
    row("vctr-auro", "2026-04-20", { vendorId: V.auro, contractNumber: "VCTR-2026-008", contractType: "supply", title: "API supply agreement", startDate: "2026-04-01", endDate: "2027-03-31", status: "active" }),
  ],
  products: [
    row(P.pcm, "2026-05-01", { productCode: "FP-PCM-500", productName: "Paracetamol Tablets 500 mg", genericName: "Paracetamol", brandName: "Cipmol", productType: "finished", dosageForm: "tablet", strength: "500", strengthUnit: "mg", routeOfAdministration: "oral", therapeuticCategory: "Analgesic", packSize: "10 x 10", shelfLife: 36, shelfLifeUnit: "months", status: "active" }),
    row(P.amox, "2026-05-01", { productCode: "FP-AMX-500", productName: "Amoxicillin Capsules 500 mg", genericName: "Amoxicillin", brandName: "Moxsun", productType: "finished", dosageForm: "capsule", strength: "500", strengthUnit: "mg", routeOfAdministration: "oral", therapeuticCategory: "Antibiotic", packSize: "10 x 10", shelfLife: 24, shelfLifeUnit: "months", status: "active" }),
    row(P.panto, "2026-05-06", { productCode: "FP-PAN-40", productName: "Pantoprazole Tablets 40 mg", genericName: "Pantoprazole", brandName: "Pantogard", productType: "finished", dosageForm: "tablet", strength: "40", strengthUnit: "mg", routeOfAdministration: "oral", therapeuticCategory: "Proton pump inhibitor", packSize: "15's", shelfLife: 24, shelfLifeUnit: "months", status: "active" }),
    row(P.met, "2026-05-06", { productCode: "FP-MET-500", productName: "Metformin Tablets 500 mg", genericName: "Metformin Hydrochloride", brandName: "Glymet", productType: "finished", dosageForm: "tablet", strength: "500", strengthUnit: "mg", routeOfAdministration: "oral", therapeuticCategory: "Antidiabetic", packSize: "10 x 15", shelfLife: 36, shelfLifeUnit: "months", status: "active" }),
    row(P.azi, "2026-06-02", { productCode: "FP-AZI-250", productName: "Azithromycin Tablets 250 mg", genericName: "Azithromycin", brandName: "Azired", productType: "finished", dosageForm: "tablet", strength: "250", strengthUnit: "mg", routeOfAdministration: "oral", therapeuticCategory: "Antibiotic", packSize: "6's", shelfLife: 36, shelfLifeUnit: "months", status: "active" }),
    row(P.cet, "2026-06-02", { productCode: "FP-CET-10", productName: "Cetirizine Tablets 10 mg", genericName: "Cetirizine Hydrochloride", brandName: "Cetril", productType: "finished", dosageForm: "tablet", strength: "10", strengthUnit: "mg", routeOfAdministration: "oral", therapeuticCategory: "Antihistamine", packSize: "10 x 10", shelfLife: 36, shelfLifeUnit: "months", status: "under_development" }),
  ],
  materials: [
    row("Paracetamol IP", "2026-04-12", { materialCode: "API-PCM", materialName: "Paracetamol IP", materialType: "api", specification: "IP", defaultUom: "KG", reorderLevel: 400, status: "active" }),
    row("Amoxicillin Trihydrate", "2026-04-12", { materialCode: "API-AMX", materialName: "Amoxicillin Trihydrate Compacted", materialType: "api", specification: "BP", defaultUom: "KG", reorderLevel: 250, status: "active" }),
    row("MCC PH102", "2026-04-12", { materialCode: "EXC-MCC", materialName: "Microcrystalline Cellulose PH102", materialType: "excipient", specification: "In-house", defaultUom: "KG", reorderLevel: 800, status: "active" }),
    row("Alu Alu Foil", "2026-04-14", { materialCode: "PM-ALU", materialName: "Alu-Alu Cold Form Foil", materialType: "packaging_material", specification: "25 micron", defaultUom: "KG", reorderLevel: 120, status: "active" }),
    row("PVC Film", "2026-04-14", { materialCode: "PM-PVC", materialName: "PVC Film 250 micron", materialType: "packaging_material", specification: "Pharma grade", defaultUom: "KG", reorderLevel: 200, status: "active" }),
    row("Carton PCM", "2026-05-02", { materialCode: "PRT-PCM", materialName: "Paracetamol 500 Carton", materialType: "printed_packaging", specification: "Cipla artwork v4", defaultUom: "NOS", reorderLevel: 20000, status: "active" }),
  ],
  productFormulas: [
    row("bom-formula-pcm", "2026-05-10", { productId: P.pcm, formulaCode: "FRM-PCM-03", version: "03", status: "approved", effectiveFrom: "2026-05-01" }),
  ],
  suppliers: [
    row(V.auro, "2026-04-18", { supplierCode: "SUP-AURO", supplierName: V.auro, country: "India", status: "active" }),
    row(V.signet, "2026-04-18", { supplierCode: "SUP-SIG", supplierName: V.signet, country: "India", status: "active" }),
  ],
  vendorMaterials: [
    row("vm-auro-pcm", "2026-04-22", { vendorId: V.auro, materialId: "Paracetamol IP", role: "primary", qualificationStatus: "approved", status: "active" }),
    row("vm-signet-mcc", "2026-04-22", { vendorId: V.signet, materialId: "MCC PH102", role: "primary", qualificationStatus: "approved", status: "active" }),
  ],
  vendorPerformance: [
    row("vp-auro", "2026-09-30", { vendorId: V.auro, period: "2026-Q2", onTimePercent: 96, qualityScore: 98, status: "active" }),
  ],

  materialRequirements: [
    row("mr-pcm-api", "2026-09-28", { requirementNumber: "MR-2026-118", materialId: "Paracetamol IP", quantity: 850, uom: "KG", source: "production", purpose: "October compression campaign", priority: "high", status: "converted", plantId: "bhiwadi-mfg" }),
    row("mr-alu", "2026-10-02", { requirementNumber: "MR-2026-124", materialId: "Alu Alu Foil", quantity: 180, uom: "KG", source: "reorder", purpose: "Finished goods packing cover", priority: "normal", status: "submitted", plantId: "bhiwadi-mfg" }),
  ],
  purchaseRequisitions: [
    row("pr-118", "2026-09-29", { requisitionNumber: "PR-2026-118", purpose: "Paracetamol IP for Cipla campaign", priority: "high", requestedBy: E.rohit, departmentId: "production", plantId: "bhiwadi-mfg", status: "po" }),
    row("pr-124", "2026-10-03", { requisitionNumber: "PR-2026-124", purpose: "Alu-Alu foil replenishment", priority: "normal", requestedBy: E.vikram, departmentId: "warehouse", plantId: "bhiwadi-mfg", status: "purchase_review" }),
    row("pr-109", "2026-09-12", { requisitionNumber: "PR-2026-109", purpose: "MCC PH102 safety stock", priority: "normal", requestedBy: E.vikram, departmentId: "warehouse", status: "completed" }),
    row("pr-131", "2026-10-08", { requisitionNumber: "PR-2026-131", purpose: "Azithromycin API trial lot", priority: "urgent", requestedBy: E.rohit, departmentId: "production", status: "department_review" }),
  ],
  purchaseRequisitionItems: [
    row("pr-118-1", "2026-09-29", { requisitionId: "pr-118", materialId: "Paracetamol IP", quantity: 850, uom: "KG", status: "open" }),
  ],
  rfqs: [
    row("rfq-086", "2026-09-30", { rfqNumber: "RFQ-2026-086", requisitionId: "pr-118", responseDueDate: "2026-10-06", status: "closed" }),
    row("rfq-091", "2026-10-04", { rfqNumber: "RFQ-2026-091", requisitionId: "pr-124", responseDueDate: "2026-10-14", status: "issued" }),
  ],
  vendorQuotations: [
    row("vq-auro-086", "2026-10-02", { quotationNumber: "VQ-AURO-4418", rfqId: "rfq-086", vendorId: V.auro, currency: "INR", grandTotal: 6120000, validUntil: "2026-11-02", status: "selected" }),
    row("vq-huht-091", "2026-10-07", { quotationNumber: "VQ-HUHT-902", rfqId: "rfq-091", vendorId: V.huht, currency: "INR", grandTotal: 864000, validUntil: "2026-11-07", status: "under_evaluation" }),
  ],
  purchaseOrders: [
    row("po-220", "2026-10-04", { poNumber: "PO-2026-220", poDate: "2026-10-04", vendorId: V.auro, requisitionId: "pr-118", expectedDeliveryDate: "2026-10-18", currency: "INR", grandTotal: 6120000, remainingQuantity: 350, plantId: "bhiwadi-mfg", status: "partially_received" }),
    row("po-214", "2026-09-20", { poNumber: "PO-2026-214", poDate: "2026-09-20", vendorId: V.signet, expectedDeliveryDate: "2026-10-02", currency: "INR", grandTotal: 1465000, remainingQuantity: 0, status: "fully_received" }),
    row("po-228", "2026-10-09", { poNumber: "PO-2026-228", poDate: "2026-10-09", vendorId: V.uflex, expectedDeliveryDate: "2026-10-24", currency: "INR", grandTotal: 980000, remainingQuantity: 180, status: "sent" }),
    row("po-231", "2026-10-11", { poNumber: "PO-2026-231", poDate: "2026-10-11", vendorId: V.huht, expectedDeliveryDate: "2026-10-28", currency: "INR", grandTotal: 864000, remainingQuantity: 120, status: "under_approval" }),
  ],
  purchaseOrderItems: [
    row("po-220-1", "2026-10-04", { purchaseOrderId: "po-220", materialId: "Paracetamol IP", quantity: 850, receivedQuantity: 500, uom: "KG", unitPrice: 7200, lineTotal: 6120000, status: "open" }),
  ],
  purchaseOrderAmendments: [
    row("amd-220-1", "2026-10-08", { amendmentNumber: "AMD-2026-017", purchaseOrderId: "po-220", version: 2, reason: "Split delivery — 500 kg now, 350 kg on 18 Oct", status: "approved" }),
  ],
  purchaseApprovals: [
    row("pa-po-231", "2026-10-11", { documentType: "purchaseOrder", documentId: "po-231", documentNumber: "PO-2026-231", status: "pending", approver: E.arjun }),
  ],

  inventoryBatches: [
    row("b-pcm-api-092", "2026-10-06", { itemCode: "API-PCM", itemName: "Paracetamol IP", itemType: "material", batchNumber: "APCM-26-092", warehouseId: W.rm, locationId: "RM-A-01", availableQuantity: 500, quantity: 500, uom: "KG", qualityStatus: "released", expiryDate: "2028-08-31", inventoryStatus: "available", supplierId: V.auro, receivedDate: "2026-10-06" }),
    row("b-pcm-api-088", "2026-09-18", { itemCode: "API-PCM", itemName: "Paracetamol IP", itemType: "material", batchNumber: "APCM-26-088", warehouseId: W.q, locationId: "QTN-01", availableQuantity: 180, quantity: 180, uom: "KG", qualityStatus: "quarantine", expiryDate: "2028-07-15", inventoryStatus: "held", supplierId: V.auro }),
    row("b-mcc-044", "2026-09-22", { itemCode: "EXC-MCC", itemName: "Microcrystalline Cellulose PH102", itemType: "material", batchNumber: "MCC-26-044", warehouseId: W.rm, locationId: "RM-A-01", availableQuantity: 920, quantity: 920, uom: "KG", qualityStatus: "released", expiryDate: "2028-12-31", inventoryStatus: "available", supplierId: V.signet }),
    row("b-fg-pcm-1842", "2026-10-09", { itemCode: "FP-PCM-500", itemName: "Paracetamol Tablets 500 mg", itemType: "product", productId: P.pcm, batchNumber: "PCM500-2610-1842", warehouseId: W.fg, locationId: "FG-C-12", availableQuantity: 186000, quantity: 200000, uom: "NOS", qualityStatus: "released", expiryDate: "2028-09-30", inventoryStatus: "available" }),
    row("b-fg-amx-0771", "2026-10-03", { itemCode: "FP-AMX-500", itemName: "Amoxicillin Capsules 500 mg", itemType: "product", productId: P.amox, batchNumber: "AMX500-2609-0771", warehouseId: W.fg, locationId: "FG-C-12", availableQuantity: 94000, quantity: 120000, uom: "NOS", qualityStatus: "released", expiryDate: "2028-03-31", inventoryStatus: "available" }),
    row("b-fg-pan-hold", "2026-10-11", { itemCode: "FP-PAN-40", itemName: "Pantoprazole Tablets 40 mg", itemType: "product", productId: P.panto, batchNumber: "PAN40-2610-033", warehouseId: W.q, locationId: "QTN-01", availableQuantity: 0, quantity: 75000, uom: "NOS", qualityStatus: "under_test", expiryDate: "2028-04-30", inventoryStatus: "quarantine" }),
  ],
  inventoryBalances: [
    row("bal-pcm", "2026-10-11", { itemCode: "API-PCM", itemName: "Paracetamol IP", warehouseId: W.rm, availableQuantity: 500, reservedQuantity: 120, uom: "KG", status: "healthy" }),
    row("bal-fg-pcm", "2026-10-11", { itemCode: "FP-PCM-500", itemName: "Paracetamol Tablets 500 mg", warehouseId: W.fg, availableQuantity: 186000, reservedQuantity: 80000, uom: "NOS", status: "healthy" }),
  ],
  goodsReceipts: [
    row("grn-318", "2026-10-06", { receiptNumber: "GRN-2026-318", receiptDate: "2026-10-06", supplierId: V.auro, purchaseOrderId: "po-220", warehouseId: W.rm, status: "posted" }),
    row("grn-309", "2026-09-22", { receiptNumber: "GRN-2026-309", receiptDate: "2026-09-22", supplierId: V.signet, purchaseOrderId: "po-214", warehouseId: W.rm, status: "posted" }),
    row("grn-322", "2026-10-11", { receiptNumber: "GRN-2026-322", receiptDate: "2026-10-11", supplierId: V.auro, purchaseOrderId: "po-220", warehouseId: W.q, status: "qc_pending" }),
  ],
  stockTransfers: [
    row("trf-088", "2026-10-07", { transferNumber: "TRF-2026-088", fromWarehouseId: W.q, toWarehouseId: W.rm, batchNumber: "APCM-26-088", quantity: 0, status: "pending_qa" }),
  ],
  stockIssues: [
    row("iss-204", "2026-10-08", { issueNumber: "ISS-2026-204", warehouseId: W.rm, issuedTo: "Dispensing — PCM500-2610-1842", batchNumber: "APCM-26-092", quantity: 42.5, uom: "KG", status: "issued" }),
  ],
  stockReturns: [
    row("ret-041", "2026-10-10", { returnNumber: "RET-2026-041", originalIssueId: "iss-204", qualityStatus: "released", quantity: 1.2, uom: "KG", reason: "Unused dispensed API", status: "posted" }),
  ],
  stockAdjustments: [
    row("adj-019", "2026-09-30", { adjustmentNumber: "ADJ-2026-019", batchNumber: "MCC-26-044", previousQuantity: 940, adjustedQuantity: 920, reason: "Cycle count variance — 20 kg", status: "approved" }),
  ],
  stockLedger: [
    row("led-318", "2026-10-06", { transactionNumber: "LED-2026-318", transactionType: "receipt", batchNumber: "APCM-26-092", quantityIn: 500, quantityOut: 0, balanceAfter: 500, performedAt: "2026-10-06T11:20:00.000Z", status: "posted" }),
    row("led-204", "2026-10-08", { transactionNumber: "LED-2026-204", transactionType: "issue", batchNumber: "APCM-26-092", quantityIn: 0, quantityOut: 42.5, balanceAfter: 457.5, performedAt: "2026-10-08T08:05:00.000Z", status: "posted" }),
  ],

  productionPlans: [
    row("pp-oct", "2026-09-25", { planNumber: "PP-2026-10", productionPeriod: "October 2026", priority: "high", plantId: "bhiwadi-mfg", status: "released" }),
    row("pp-nov", "2026-10-08", { planNumber: "PP-2026-11", productionPeriod: "November 2026", priority: "normal", plantId: "bhiwadi-mfg", status: "draft" }),
  ],
  productionSchedules: [
    row("sch-1848", "2026-10-11", { scheduleNumber: "SCH-2026-1848", batchNumber: "PCM500-2610-1848", productId: P.pcm, workCenterId: "Compression Cadmach 45", scheduledDate: "2026-10-13", status: "scheduled" }),
    row("sch-033", "2026-10-10", { scheduleNumber: "SCH-2026-033", batchNumber: "PAN40-2610-033", productId: P.panto, workCenterId: "Coating Accela Cota", scheduledDate: "2026-10-11", status: "ready" }),
  ],
  batchPlans: [
    row("bp-pcm", "2026-09-26", { batchPlanNumber: "BP-PCM-10", productId: P.pcm, plannedBatchCount: 4, batchSize: 200000, uom: "tablets", status: "approved" }),
    row("bp-amx", "2026-09-26", { batchPlanNumber: "BP-AMX-09", productId: P.amox, plannedBatchCount: 2, batchSize: 120000, uom: "capsules", status: "in_progress" }),
  ],
  manufacturingOrders: [
    row("mo-1842", "2026-10-07", { batchNumber: "PCM500-2610-1842", productId: P.pcm, customerId: C.cipla, batchSize: 200000, uom: "tablets", plannedStartDate: "2026-10-07", plannedEndDate: "2026-10-09", status: "completed", plantId: "bhiwadi-mfg" }),
    row("mo-1848", "2026-10-11", { batchNumber: "PCM500-2610-1848", productId: P.pcm, customerId: C.cipla, batchSize: 200000, uom: "tablets", plannedStartDate: "2026-10-13", plannedEndDate: "2026-10-15", status: "manufacturing", plantId: "bhiwadi-mfg", workCenterId: "Compression Cadmach 45" }),
    row("mo-0771", "2026-09-28", { batchNumber: "AMX500-2609-0771", productId: P.amox, customerId: C.sun, batchSize: 120000, uom: "capsules", plannedStartDate: "2026-09-28", plannedEndDate: "2026-10-03", status: "qa_pending", plantId: "bhiwadi-mfg" }),
    row("mo-033", "2026-10-10", { batchNumber: "PAN40-2610-033", productId: P.panto, customerId: C.abbott, batchSize: 75000, uom: "tablets", plannedStartDate: "2026-10-10", plannedEndDate: "2026-10-10", status: "in_process", plantId: "bhiwadi-mfg", workCenterId: "Coating Accela Cota" }),
  ],
  boms: [
    row("bom-pcm-03", "2026-05-10", { bomNumber: "BOM-PCM-03", version: "03", productId: P.pcm, effectiveFrom: "2026-05-01", status: "approved" }),
    row("bom-amx-02", "2026-06-01", { bomNumber: "BOM-AMX-02", version: "02", productId: P.amox, effectiveFrom: "2026-06-01", status: "approved" }),
    row("bom-cet-01", "2026-09-15", { bomNumber: "BOM-CET-01", version: "01", productId: P.cet, status: "draft" }),
  ],
  dispensingRequests: [
    row("dsp-1848", "2026-10-11", { dispensingRequestNumber: "DSP-2026-1848", batchNumber: "PCM500-2610-1848", manufacturingOrderId: "mo-1848", status: "dispensed" }),
    row("dsp-033", "2026-10-10", { dispensingRequestNumber: "DSP-2026-033", batchNumber: "PAN40-2610-033", manufacturingOrderId: "mo-033", status: "in_progress" }),
  ],
  dispensingRequestItems: [
    row("dspi-short", "2026-10-11", { dispensingRequestId: "dsp-1848", materialId: "Alu Alu Foil", requiredQuantity: 40, availableQuantity: 12, uom: "KG", status: "short" }),
  ],
  workCenters: [
    row("wc-cmp-01", "2026-04-04", { workCenterCode: "CMP-01", workCenterName: "Compression Cadmach 45", workCenterType: "compression", status: "available" }),
    row("wc-coa-02", "2026-04-04", { workCenterCode: "COA-02", workCenterName: "Coating Accela Cota", workCenterType: "coating", status: "available" }),
    row("wc-blp-01", "2026-04-04", { workCenterCode: "BLP-01", workCenterName: "Blister Uhlmann", workCenterType: "packing", status: "available" }),
  ],
  productionEquipment: [
    row("eq-cad-45", "2026-04-04", { equipmentCode: "CAD-45", equipmentName: "Cadmach 45 Station", qualificationStatus: "qualified", status: "available" }),
    row("eq-rmg-600", "2026-04-04", { equipmentCode: "RMG-600", equipmentName: "Rapid Mixer Granulator 600 L", qualificationStatus: "qualified", status: "in_use" }),
  ],
  batchManufacturingRecords: [
    row("bmr-1842", "2026-10-09", { bmrNumber: "BMR-2026-1842", batchNumber: "PCM500-2610-1842", productId: P.pcm, status: "closed" }),
    row("bmr-0771", "2026-10-03", { bmrNumber: "BMR-2026-0771", batchNumber: "AMX500-2609-0771", productId: P.amox, status: "under_review" }),
    row("bmr-033", "2026-10-11", { bmrNumber: "BMR-2026-033", batchNumber: "PAN40-2610-033", productId: P.panto, status: "in_process" }),
  ],
  inProcessChecks: [
    row("ipc-1842-wt", "2026-10-08", { bmrId: "bmr-1842", batchNumber: "PCM500-2610-1842", parameter: "Average weight", specification: "560–590 mg", actual: "574 mg", result: "pass", status: "pass" }),
    row("ipc-1842-hd", "2026-10-08", { bmrId: "bmr-1842", batchNumber: "PCM500-2610-1842", parameter: "Hardness", specification: "5–9 kp", actual: "7.2 kp", result: "pass", status: "pass" }),
    row("ipc-033-dt", "2026-10-11", { bmrId: "bmr-033", batchNumber: "PAN40-2610-033", parameter: "Disintegration", specification: "NMT 15 min", actual: "11 min", result: "pass", status: "pass" }),
  ],
  yieldRecords: [
    row("yld-1842", "2026-10-09", { batchNumber: "PCM500-2610-1842", manufacturingOrderId: "mo-1842", theoreticalYield: 200000, actualYield: 196400, yieldPercent: 98.2, result: "within_limit", status: "accepted" }),
    row("yld-0640", "2026-09-16", { batchNumber: "AMX500-2608-0640", theoreticalYield: 120000, actualYield: 108200, yieldPercent: 90.2, result: "below_limit", status: "under_review" }),
  ],
  productionDeviations: [
    row("dev-prd-014", "2026-10-08", { deviationNumber: "DEV-PRD-2026-014", batchNumber: "PCM500-2610-1842", severity: "minor", title: "Compression speed briefly above set range", status: "closed" }),
    row("dev-prd-016", "2026-10-11", { deviationNumber: "DEV-PRD-2026-016", batchNumber: "PAN40-2610-033", severity: "major", title: "Coating pan temperature excursion 4 minutes", status: "investigation" }),
  ],

  qcSampleRequests: [
    row("qcsr-441", "2026-10-06", { sampleRequestNumber: "QCSR-2026-441", sourceType: "goods_receipt", batchNumber: "APCM-26-092", priority: "high", status: "completed" }),
    row("qcsr-448", "2026-10-11", { sampleRequestNumber: "QCSR-2026-448", sourceType: "finished_goods", batchNumber: "PAN40-2610-033", priority: "normal", status: "sampling" }),
  ],
  qcSamples: [
    row("qcs-441", "2026-10-06", { sampleNumber: "QCS-2026-441", sourceType: "goods_receipt", materialId: "Paracetamol IP", batchNumber: "APCM-26-092", sampledAt: "2026-10-06", receivedAt: "2026-10-06", priority: "high", status: "tested" }),
    row("qcs-452", "2026-10-09", { sampleNumber: "QCS-2026-452", sourceType: "finished_goods", productId: P.pcm, batchNumber: "PCM500-2610-1842", sampledAt: "2026-10-09", receivedAt: "2026-10-09", priority: "high", status: "approved" }),
    row("qcs-455", "2026-10-11", { sampleNumber: "QCS-2026-455", sourceType: "finished_goods", productId: P.panto, batchNumber: "PAN40-2610-033", sampledAt: "2026-10-11", receivedAt: "2026-10-11", priority: "normal", status: "under_test" }),
  ],
  qcTestRequests: [
    row("qctr-441", "2026-10-06", { testRequestNumber: "QCTR-2026-441", batchNumber: "APCM-26-092", dueDate: "2026-10-08", status: "completed" }),
    row("qctr-452", "2026-10-09", { testRequestNumber: "QCTR-2026-452", batchNumber: "PCM500-2610-1842", dueDate: "2026-10-11", status: "approved" }),
    row("qctr-455", "2026-10-11", { testRequestNumber: "QCTR-2026-455", batchNumber: "PAN40-2610-033", dueDate: "2026-10-14", status: "in_progress" }),
  ],
  qcTestAssignments: [
    row("qcta-455", "2026-10-11", { testRequestId: "qctr-455", analystId: E.priya, dueDate: "2026-10-14", status: "assigned" }),
  ],
  qcSpecifications: [
    row("spec-pcm", "2026-05-01", { specificationNumber: "SPEC-PCM-500-04", version: "04", productId: P.pcm, status: "effective" }),
    row("spec-api-pcm", "2026-04-12", { specificationNumber: "SPEC-API-PCM-02", version: "02", materialId: "Paracetamol IP", status: "effective" }),
  ],
  qcTestMethods: [
    row("tm-hplc-pcm", "2026-04-12", { methodNumber: "TM-HPLC-PCM", methodName: "Assay of Paracetamol by HPLC", version: "03", status: "effective" }),
    row("tm-diss-tab", "2026-04-12", { methodNumber: "TM-DISS-TAB", methodName: "Dissolution — paddle 50 rpm", version: "02", status: "effective" }),
  ],
  qcTests: [
    row("qct-452", "2026-10-10", { testNumber: "QCT-2026-452", batchNumber: "PCM500-2610-1842", analystId: E.priya, overallResult: "complies", status: "approved" }),
    row("qct-455", "2026-10-11", { testNumber: "QCT-2026-455", batchNumber: "PAN40-2610-033", analystId: E.priya, overallResult: "pending", status: "in_progress" }),
  ],
  qcTestResults: [
    row("qcr-452-assay", "2026-10-10", { testId: "qct-452", parameterName: "Assay", enteredResult: "99.4%", specification: "95.0–105.0%", outcome: "pass", batchNumber: "PCM500-2610-1842", status: "approved" }),
    row("qcr-452-diss", "2026-10-10", { testId: "qct-452", parameterName: "Dissolution 30 min", enteredResult: "92%", specification: "NLT 80%", outcome: "pass", batchNumber: "PCM500-2610-1842", status: "approved" }),
  ],
  qcOOS: [
    row("oos-007", "2026-09-16", { oosNumber: "OOS-2026-007", batchNumber: "AMX500-2608-0640", parameter: "Dissolution", status: "closed", phase: "confirmed_assignable" }),
  ],
  qcOOT: [
    row("oot-003", "2026-08-20", { ootNumber: "OOT-2026-003", batchNumber: "PCM500-2601-1102", parameter: "Assay (stability 9M)", status: "closed" }),
  ],
  qcCOAs: [
    row("coa-1842", "2026-10-10", { coaNumber: "COA-2026-1842", batchNumber: "PCM500-2610-1842", productId: P.pcm, customerId: C.cipla, status: "issued" }),
    row("coa-0771", "2026-10-04", { coaNumber: "COA-2026-0771", batchNumber: "AMX500-2609-0771", productId: P.amox, customerId: C.sun, status: "draft" }),
  ],
  qcStabilityStudies: [
    row("stb-pcm", "2026-01-15", { studyNumber: "STB-PCM-500", productId: P.pcm, condition: "30 °C / 75% RH", status: "ongoing" }),
  ],

  qaBatchReviews: [
    row("qar-1842", "2026-10-10", { reviewNumber: "QAR-2026-1842", batchNumber: "PCM500-2610-1842", productId: P.pcm, customerId: C.cipla, priority: "high", status: "released", decidedAt: "2026-10-10" }),
    row("qar-0771", "2026-10-05", { reviewNumber: "QAR-2026-0771", batchNumber: "AMX500-2609-0771", productId: P.amox, customerId: C.sun, priority: "normal", status: "in_review" }),
    row("qar-033", "2026-10-11", { reviewNumber: "QAR-2026-033", batchNumber: "PAN40-2610-033", productId: P.panto, customerId: C.abbott, priority: "high", status: "pending" }),
  ],
  qaBatchDispositions: [
    row("qad-1842", "2026-10-10", { documentNumber: "QAD-2026-1842", reviewNumber: "QAR-2026-1842", batchNumber: "PCM500-2610-1842", productId: P.pcm, customerId: C.cipla, decision: "release", reason: "BMR, IPC and QC comply", reviewedAt: "2026-10-10", decidedAt: "2026-10-10", status: "released" }),
  ],
  qaReleaseCertificates: [
    row("qrel-1842", "2026-10-10", { reviewNumber: "QAR-2026-1842", documentNumber: "REL-2026-1842", batchNumber: "PCM500-2610-1842", productId: P.pcm, customerId: C.cipla, decidedAt: "2026-10-10", status: "issued" }),
  ],
  qaDeviations: [
    row("qadev-014", "2026-10-08", { deviationNumber: "DEV-QA-2026-014", batchNumber: "PCM500-2610-1842", severity: "minor", title: "Momentary compression speed drift", status: "closed" }),
    row("qadev-016", "2026-10-11", { deviationNumber: "DEV-QA-2026-016", batchNumber: "PAN40-2610-033", severity: "major", title: "Coating temperature excursion", status: "open" }),
  ],
  qaCAPA: [
    row("capa-028", "2026-09-18", { capaNumber: "CAPA-2026-028", sourceType: "deviation", title: "Interlock on coating pan temperature", dueDate: "2026-10-30", status: "in_progress" }),
    row("capa-021", "2026-07-12", { capaNumber: "CAPA-2026-021", sourceType: "complaint", title: "Carton pharmacode verification", dueDate: "2026-08-31", status: "effectiveness_check" }),
  ],
  qaChangeControls: [
    row("cc-044", "2026-09-02", { changeNumber: "CC-2026-044", title: "Paracetamol carton artwork v4 — Cipla", changeType: "artwork", status: "approved" }),
    row("cc-049", "2026-10-06", { changeNumber: "CC-2026-049", title: "Add metal detector after blister", changeType: "equipment", status: "impact_assessment" }),
  ],
  qaDocumentReviews: [
    row("qadoc-sop-dsp", "2026-08-01", { documentNumber: "SOP-PRD-DSP-006", title: "Dispensing of active materials", documentType: "sop", status: "effective" }),
  ],

  salesQuotations: [
    row("qt-118", "2026-09-04", { quotationNumber: "QT-2026-118", customerId: C.cipla, status: "converted", grandTotal: 4280000, validUntil: "2026-10-04", currency: "INR", quotationDate: "2026-09-04" }),
    row("qt-126", "2026-09-22", { quotationNumber: "QT-2026-126", customerId: C.reddy, status: "negotiation", grandTotal: 6150000, validUntil: "2026-10-22", currency: "USD", quotationDate: "2026-09-22" }),
    row("qt-131", "2026-10-06", { quotationNumber: "QT-2026-131", customerId: C.mankind, status: "sent", grandTotal: 1860000, validUntil: "2026-11-06", currency: "INR", quotationDate: "2026-10-06" }),
    row("qt-134", "2026-10-10", { quotationNumber: "QT-2026-134", customerId: C.abbott, status: "pending_approval", grandTotal: 2420000, validUntil: "2026-11-10", currency: "INR", quotationDate: "2026-10-10" }),
  ],
  salesQuotationItems: [
    row("qt-118-1", "2026-09-04", { quotationId: "qt-118", productId: P.pcm, quantity: 800000, unitPrice: 4.6, lineTotal: 3680000, status: "open" }),
  ],
  salesOrders: [
    row("so-204", "2026-06-18", { salesOrderNumber: "SO-2026-204", customerId: C.cipla, orderType: "manufacturing", orderDate: "2026-06-18", currency: "INR", grandTotal: 3680000, status: "delivered", fulfilmentPercent: 100, remainingQuantity: 0, promisedDeliveryDate: "2026-07-20", salesRepresentative: E.neha }),
    row("so-231", "2026-07-09", { salesOrderNumber: "SO-2026-231", customerId: C.sun, orderType: "manufacturing", orderDate: "2026-07-09", currency: "INR", grandTotal: 2940000, status: "delivered", fulfilmentPercent: 100, remainingQuantity: 0, promisedDeliveryDate: "2026-08-15", salesRepresentative: E.neha }),
    row("so-248", "2026-08-14", { salesOrderNumber: "SO-2026-248", customerId: C.cipla, orderType: "repeat", orderDate: "2026-08-14", currency: "INR", grandTotal: 4520000, status: "partially_fulfilled", fulfilmentPercent: 62, remainingQuantity: 304000, promisedDeliveryDate: "2026-09-20", salesRepresentative: E.neha }),
    row("so-256", "2026-09-03", { salesOrderNumber: "SO-2026-256", customerId: C.abbott, orderType: "manufacturing", orderDate: "2026-09-03", currency: "INR", grandTotal: 1875000, status: "in_production", fulfilmentPercent: 40, remainingQuantity: 45000, promisedDeliveryDate: "2026-10-18", salesRepresentative: E.neha }),
    row("so-261", "2026-09-16", { salesOrderNumber: "SO-2026-261", customerId: C.reddy, orderType: "export", orderDate: "2026-09-16", currency: "USD", grandTotal: 5400000, status: "awaiting_qa_release", fulfilmentPercent: 80, remainingQuantity: 24000, promisedDeliveryDate: "2026-10-08", salesRepresentative: E.neha }),
    row("so-268", "2026-09-28", { salesOrderNumber: "SO-2026-268", customerId: C.sun, orderType: "manufacturing", orderDate: "2026-09-28", currency: "INR", grandTotal: 2160000, status: "ready_for_dispatch", fulfilmentPercent: 100, remainingQuantity: 120000, promisedDeliveryDate: "2026-10-16", salesRepresentative: E.neha }),
    row("so-274", "2026-10-04", { salesOrderNumber: "SO-2026-274", customerId: C.cipla, orderType: "manufacturing", orderDate: "2026-10-04", currency: "INR", grandTotal: 4280000, status: "confirmed", fulfilmentPercent: 15, remainingQuantity: 680000, promisedDeliveryDate: "2026-11-12", salesRepresentative: E.neha, customerPoNumber: "CIP-PO-88421" }),
    row("so-277", "2026-10-09", { salesOrderNumber: "SO-2026-277", customerId: C.mankind, orderType: "trial", orderDate: "2026-10-09", currency: "INR", grandTotal: 640000, status: "pending_approval", fulfilmentPercent: 0, remainingQuantity: 50000, promisedDeliveryDate: "2026-11-20", salesRepresentative: E.neha }),
    row("so-279", "2026-10-11", { salesOrderNumber: "SO-2026-279", customerId: C.abbott, orderType: "manufacturing", orderDate: "2026-10-11", currency: "INR", grandTotal: 980000, status: "draft", fulfilmentPercent: 0, remainingQuantity: 40000, promisedDeliveryDate: "2026-11-30", salesRepresentative: E.neha }),
  ],
  salesOrderLines: [
    row("so-274-1", "2026-10-04", { salesOrderId: "so-274", productId: P.pcm, quantity: 800000, unitPrice: 4.6, lineTotal: 3680000, status: "open" }),
    row("so-274-2", "2026-10-04", { salesOrderId: "so-274", productId: P.cet, quantity: 200000, unitPrice: 3, lineTotal: 600000, status: "open" }),
    row("so-248-1", "2026-08-14", { salesOrderId: "so-248", productId: P.pcm, quantity: 800000, unitPrice: 4.55, lineTotal: 3640000, status: "open" }),
    row("so-256-1", "2026-09-03", { salesOrderId: "so-256", productId: P.panto, quantity: 75000, unitPrice: 25, lineTotal: 1875000, status: "open" }),
    row("so-261-1", "2026-09-16", { salesOrderId: "so-261", productId: P.azi, quantity: 120000, unitPrice: 45, lineTotal: 5400000, status: "open" }),
    row("so-268-1", "2026-09-28", { salesOrderId: "so-268", productId: P.amox, quantity: 120000, unitPrice: 18, lineTotal: 2160000, status: "open" }),
    row("so-204-1", "2026-06-18", { salesOrderId: "so-204", productId: P.pcm, quantity: 800000, unitPrice: 4.6, lineTotal: 3680000, status: "fulfilled" }),
    row("so-231-1", "2026-07-09", { salesOrderId: "so-231", productId: P.amox, quantity: 140000, unitPrice: 21, lineTotal: 2940000, status: "fulfilled" }),
  ],
  salesPriceLists: [
    row("pl-cipla-26", "2026-04-01", { priceListNumber: "PL-2026-CIPLA", name: "Cipla domestic 2026-27", customerId: C.cipla, effectiveFrom: "2026-04-01", currency: "INR", status: "active" }),
    row("pl-export-26", "2026-04-01", { priceListNumber: "PL-2026-EXP", name: "Export list — Dr. Reddy's", customerId: C.reddy, effectiveFrom: "2026-04-01", currency: "USD", status: "active" }),
  ],
  salesCustomerRequirements: [
    row("req-cipla-sl", "2026-05-16", { requirementNumber: "REQ-2026-033", customerId: C.cipla, productId: P.pcm, category: "shelf_life", title: "Minimum 18 months remaining at dispatch", status: "active" }),
    row("req-reddy-coa", "2026-06-02", { requirementNumber: "REQ-2026-041", customerId: C.reddy, productId: P.azi, category: "documentation", title: "COA plus residual solvent statement with every lot", status: "active" }),
  ],
  contractManufacturingOrders: [
    row("cmo-cipla", "2026-05-15", { contractOrderNumber: "CMO-2026-014", customerId: C.cipla, productId: P.pcm, manufacturingQuantity: 8000000, uom: "tablets", status: "in_execution" }),
    row("cmo-sun", "2026-06-01", { contractOrderNumber: "CMO-2026-018", customerId: C.sun, productId: P.amox, manufacturingQuantity: 2400000, uom: "capsules", status: "in_execution" }),
  ],
  salesReturns: [
    row("sr-012", "2026-09-08", { returnNumber: "SR-2026-012", customerId: C.sun, salesOrderId: "so-231", batchNumber: "AMX500-2606-0510", quantity: 2400, reason: "Carton print smudge on 2 shippers", status: "closed" }),
  ],
  salesReceivableSnapshots: [
    row("ars-cipla", "2026-10-11", { customerId: C.cipla, asOfDate: "2026-10-11", creditLimit: 25000000, outstandingBalance: 6240000, overdueBalance: 1480000, status: "open" }),
    row("ars-sun", "2026-10-11", { customerId: C.sun, asOfDate: "2026-10-11", creditLimit: 18000000, outstandingBalance: 2160000, overdueBalance: 0, status: "open" }),
    row("ars-reddy", "2026-10-11", { customerId: C.reddy, asOfDate: "2026-10-11", creditLimit: 32000000, outstandingBalance: 5400000, overdueBalance: 2100000, status: "open" }),
    row("ars-abbott", "2026-10-11", { customerId: C.abbott, asOfDate: "2026-10-11", creditLimit: 12000000, outstandingBalance: 1875000, overdueBalance: 420000, status: "open" }),
  ],
  salesOrderApprovals: [
    row("soa-277", "2026-10-09", { documentType: "salesOrder", documentId: "so-277", documentNumber: "SO-2026-277", status: "pending" }),
    row("soa-134", "2026-10-10", { documentType: "quotation", documentId: "qt-134", documentNumber: "QT-2026-134", status: "pending" }),
  ],
  salesCommunications: [
    row("scom-1", "2026-10-08", { customerId: C.cipla, subject: "Dispatch window for SO-2026-274", communicationType: "email", status: "logged" }),
  ],

  financeChartOfAccounts: [
    row("1000", "2026-04-01", { accountCode: "1000", accountName: "Cash in hand", name: "Cash in hand", accountType: "asset", category: "cash", status: "active" }),
    row("1100", "2026-04-01", { accountCode: "1100", accountName: "HDFC current account", name: "HDFC current account", accountType: "asset", category: "bank", status: "active" }),
    row("1200", "2026-04-01", { accountCode: "1200", accountName: "Trade receivables", name: "Trade receivables", accountType: "asset", category: "receivable", status: "active" }),
    row("1300", "2026-04-01", { accountCode: "1300", accountName: "Inventory", name: "Inventory", accountType: "asset", category: "inventory", status: "active" }),
    row("2000", "2026-04-01", { accountCode: "2000", accountName: "Trade payables", name: "Trade payables", accountType: "liability", category: "payable", status: "active" }),
    row("3000", "2026-04-01", { accountCode: "3000", accountName: "Share capital", name: "Share capital", accountType: "equity", category: "equity", status: "active" }),
    row("4000", "2026-04-01", { accountCode: "4000", accountName: "Contract manufacturing revenue", name: "Contract manufacturing revenue", accountType: "revenue", category: "sales", status: "active" }),
    row("5000", "2026-04-01", { accountCode: "5000", accountName: "Cost of materials", name: "Cost of materials", accountType: "expense", category: "cogs", status: "active" }),
    row("5100", "2026-04-01", { accountCode: "5100", accountName: "Conversion and overheads", name: "Conversion and overheads", accountType: "expense", category: "overhead", status: "active" }),
  ],
  financeJournalEntries: [
    row("je-2026-10", "2026-10-08", { journalNumber: "JE-2026-10-014", journalDate: "2026-10-08", postingDate: "2026-10-08", description: "October contract sales and conversion", status: "posted", totalDebit: 7710000, totalCredit: 7710000 }),
    row("je-2026-09", "2026-09-28", { journalNumber: "JE-2026-09-022", journalDate: "2026-09-28", postingDate: "2026-09-28", description: "September contract sales and conversion", status: "posted", totalDebit: 6920000, totalCredit: 6920000 }),
    row("je-2026-08", "2026-08-29", { journalNumber: "JE-2026-08-019", journalDate: "2026-08-29", postingDate: "2026-08-29", description: "August contract sales and conversion", status: "posted", totalDebit: 6480000, totalCredit: 6480000 }),
  ],
  financeJournalLines: [
    row("jel-10-ar", "2026-10-08", { journalId: "je-2026-10", accountId: "1200", accountCode: "1200", accountName: "Trade receivables", accountType: "asset", debit: 4850000, credit: 0, status: "posted" }),
    row("jel-10-rev", "2026-10-08", { journalId: "je-2026-10", accountId: "4000", accountCode: "4000", accountName: "Contract manufacturing revenue", accountType: "revenue", debit: 0, credit: 4850000, status: "posted" }),
    row("jel-10-cogs", "2026-10-08", { journalId: "je-2026-10", accountId: "5000", accountCode: "5000", accountName: "Cost of materials", accountType: "expense", debit: 2140000, credit: 0, status: "posted" }),
    row("jel-10-oh", "2026-10-08", { journalId: "je-2026-10", accountId: "5100", accountCode: "5100", accountName: "Conversion and overheads", accountType: "expense", debit: 720000, credit: 0, status: "posted" }),
    row("jel-10-ap", "2026-10-08", { journalId: "je-2026-10", accountId: "2000", accountCode: "2000", accountName: "Trade payables", accountType: "liability", debit: 0, credit: 2860000, status: "posted" }),
    row("jel-09-ar", "2026-09-28", { journalId: "je-2026-09", accountId: "1200", accountCode: "1200", accountType: "asset", debit: 4520000, credit: 0, status: "posted" }),
    row("jel-09-rev", "2026-09-28", { journalId: "je-2026-09", accountId: "4000", accountCode: "4000", accountType: "revenue", debit: 0, credit: 4520000, status: "posted" }),
    row("jel-09-exp", "2026-09-28", { journalId: "je-2026-09", accountId: "5000", accountCode: "5000", accountType: "expense", debit: 2400000, credit: 0, status: "posted" }),
    row("jel-09-ap", "2026-09-28", { journalId: "je-2026-09", accountId: "2000", accountCode: "2000", accountType: "liability", debit: 0, credit: 2400000, status: "posted" }),
    row("jel-08-ar", "2026-08-29", { journalId: "je-2026-08", accountId: "1200", accountCode: "1200", accountType: "asset", debit: 4180000, credit: 0, status: "posted" }),
    row("jel-08-rev", "2026-08-29", { journalId: "je-2026-08", accountId: "4000", accountCode: "4000", accountType: "revenue", debit: 0, credit: 4180000, status: "posted" }),
    row("jel-08-exp", "2026-08-29", { journalId: "je-2026-08", accountId: "5000", accountCode: "5000", accountType: "expense", debit: 2300000, credit: 0, status: "posted" }),
    row("jel-08-ap", "2026-08-29", { journalId: "je-2026-08", accountId: "2000", accountCode: "2000", accountType: "liability", debit: 0, credit: 2300000, status: "posted" }),
  ],
  financeSupplierInvoices: [
    row("sinv-220", "2026-10-07", { invoiceNumber: "AURO/26-27/4418", internalNumber: "PINV-2026-220", vendorId: V.auro, supplierId: V.auro, invoiceDate: "2026-10-06", dueDate: "2026-11-20", grandTotal: 3600000, outstandingBalance: 3600000, status: "posted" }),
    row("sinv-214", "2026-09-24", { invoiceNumber: "SIG/8841", internalNumber: "PINV-2026-214", vendorId: V.signet, supplierId: V.signet, invoiceDate: "2026-09-22", dueDate: "2026-10-07", grandTotal: 1465000, outstandingBalance: 465000, status: "partially_paid" }),
    row("sinv-198", "2026-08-18", { invoiceNumber: "UFL/2291", internalNumber: "PINV-2026-198", vendorId: V.uflex, supplierId: V.uflex, invoiceDate: "2026-08-16", dueDate: "2026-09-15", grandTotal: 720000, outstandingBalance: 720000, status: "posted" }),
  ],
  financeCustomerInvoices: [
    row("cinv-204", "2026-07-22", { invoiceNumber: "INV-2026-204", customerId: C.cipla, invoiceDate: "2026-07-21", dueDate: "2026-09-04", grandTotal: 3680000, outstandingBalance: 1480000, status: "partially_paid" }),
    row("cinv-248", "2026-09-18", { invoiceNumber: "INV-2026-248", customerId: C.cipla, invoiceDate: "2026-09-18", dueDate: "2026-11-02", grandTotal: 2800000, outstandingBalance: 2800000, status: "posted" }),
    row("cinv-261", "2026-10-02", { invoiceNumber: "INV-2026-261", customerId: C.reddy, invoiceDate: "2026-10-01", dueDate: "2026-11-30", grandTotal: 5400000, outstandingBalance: 5400000, status: "posted" }),
    row("cinv-231", "2026-08-20", { invoiceNumber: "INV-2026-231", customerId: C.sun, invoiceDate: "2026-08-18", dueDate: "2026-09-17", grandTotal: 2160000, outstandingBalance: 420000, status: "partially_paid" }),
  ],
  financePayments: [
    row("pay-088", "2026-10-05", { paymentNumber: "PAY-2026-088", vendorId: V.signet, paymentDate: "2026-10-05", amount: 1000000, status: "posted", reference: "NEFT HDFC 10058821" }),
    row("pay-081", "2026-09-12", { paymentNumber: "PAY-2026-081", vendorId: V.auro, paymentDate: "2026-09-12", amount: 2400000, status: "posted" }),
    row("pay-074", "2026-08-20", { paymentNumber: "PAY-2026-074", vendorId: V.uflex, paymentDate: "2026-08-20", amount: 1800000, status: "posted" }),
  ],
  financePaymentProposals: [
    row("ppr-014", "2026-10-11", { proposalNumber: "PPR-2026-014", vendorId: V.auro, amount: 3600000, dueDate: "2026-11-20", status: "pending_approval" }),
  ],
  financeCustomerReceipts: [
    row("rct-066", "2026-10-03", { receiptNumber: "RCT-2026-066", customerId: C.cipla, receiptDate: "2026-10-03", amount: 2200000, status: "allocated" }),
    row("rct-061", "2026-09-08", { receiptNumber: "RCT-2026-061", customerId: C.sun, receiptDate: "2026-09-08", amount: 1740000, status: "posted" }),
    row("rct-054", "2026-08-11", { receiptNumber: "RCT-2026-054", customerId: C.abbott, receiptDate: "2026-08-11", amount: 960000, status: "posted" }),
  ],
  financeBankAccounts: [
    row("hdfc-op", "2026-04-01", { accountName: "HDFC Current — Operations", bankName: "HDFC Bank", accountNumberMasked: "XXXX4418", currency: "INR", currentBalance: 18640000, openingBalance: 9200000, status: "active" }),
    row("hdfc-escrow", "2026-04-01", { accountName: "HDFC Escrow — Export", bankName: "HDFC Bank", accountNumberMasked: "XXXX9021", currency: "USD", currentBalance: 2140000, openingBalance: 800000, status: "active" }),
  ],
  financeBankReconciliations: [
    row("brc-sep", "2026-10-04", { bankAccountId: "hdfc-op", statementDate: "2026-09-30", status: "in_progress" }),
    row("brc-aug", "2026-09-06", { bankAccountId: "hdfc-op", statementDate: "2026-08-31", status: "completed" }),
  ],
  financeBudgets: [
    row("bud-prd", "2026-04-01", { budgetNumber: "BUD-PRD-26", name: "Production conversion", costCenterId: "cc-production", amount: 42000000, annualAmount: 42000000, actualAmount: 24800000, status: "active" }),
    row("bud-qa", "2026-04-01", { budgetNumber: "BUD-QA-26", name: "Quality operations", costCenterId: "cc-quality", amount: 9600000, annualAmount: 9600000, actualAmount: 5100000, status: "active" }),
  ],
  financeCostCenters: [
    row("cc-production", "2026-04-01", { code: "CC-PRD", name: "Production", status: "active" }),
    row("cc-quality", "2026-04-01", { code: "CC-QA", name: "Quality", status: "active" }),
    row("cc-commercial", "2026-04-01", { code: "CC-SAL", name: "Commercial", status: "active" }),
  ],
  financePeriods: [
    row("per-2026-10", "2026-10-01", { periodCode: "2026-10", name: "October 2026", startDate: "2026-10-01", endDate: "2026-10-31", status: "open" }),
    row("per-2026-09", "2026-09-01", { periodCode: "2026-09", name: "September 2026", startDate: "2026-09-01", endDate: "2026-09-30", status: "closing" }),
    row("per-2026-08", "2026-08-01", { periodCode: "2026-08", name: "August 2026", startDate: "2026-08-01", endDate: "2026-08-31", status: "closed" }),
  ],
  financeTaxCodes: [
    row("ftax-12", "2026-04-01", { code: "GST12", name: "GST 12%", rate: 12, status: "active" }),
    row("ftax-18", "2026-04-01", { code: "GST18", name: "GST 18%", rate: 18, status: "active" }),
  ],
  financeFixedAssets: [
    row("fa-cad", "2026-04-01", { assetNumber: "FA-CAD-45", name: "Cadmach 45 station press", category: "plant", acquisitionCost: 8600000, bookValue: 6120000, status: "active" }),
  ],
  financeExpenseClaims: [
    row("exp-044", "2026-10-06", { claimNumber: "EXP-2026-044", employeeId: E.neha, amount: 18640, purpose: "Customer visit — Cipla Mumbai", status: "pending_approval" }),
  ],
  financeCreditNotes: [
    row("cn-008", "2026-09-12", { creditNoteNumber: "CN-2026-008", customerId: C.sun, amount: 48000, reason: "Carton smudge return SR-2026-012", status: "posted" }),
  ],

  hrEmployeeProfiles: [
    row(E.ananya, "2024-06-01", { employeeCode: "EMP-1042", fullName: E.ananya, officialEmail: "ananya.sharma@patrilifesciences.com", departmentId: "qa", designationId: "Head — QA", status: "active", dateOfJoining: "2021-04-12" }),
    row(E.rohit, "2024-06-01", { employeeCode: "EMP-1108", fullName: E.rohit, officialEmail: "rohit.mehta@patrilifesciences.com", departmentId: "production", designationId: "Production Manager", status: "active", dateOfJoining: "2019-08-01" }),
    row(E.priya, "2024-06-01", { employeeCode: "EMP-1214", fullName: E.priya, officialEmail: "priya.nair@patrilifesciences.com", departmentId: "qc", designationId: "QC Manager", status: "active", dateOfJoining: "2020-11-16" }),
    row(E.vikram, "2024-06-01", { employeeCode: "EMP-1330", fullName: E.vikram, officialEmail: "vikram.singh@patrilifesciences.com", departmentId: "warehouse", designationId: "Warehouse Manager", status: "active", dateOfJoining: "2018-02-05" }),
    row(E.neha, "2024-06-01", { employeeCode: "EMP-1402", fullName: E.neha, officialEmail: "neha.kapoor@patrilifesciences.com", departmentId: "sales", designationId: "Commercial Lead", status: "active", dateOfJoining: "2022-01-10" }),
    row(E.arjun, "2024-06-01", { employeeCode: "EMP-1511", fullName: E.arjun, officialEmail: "arjun.desai@patrilifesciences.com", departmentId: "finance", designationId: "Finance Controller", status: "active", dateOfJoining: "2023-07-03" }),
  ],
  hrDesignations: [
    row("Head — QA", "2024-06-01", { code: "DES-QA-H", name: "Head — QA", departmentId: "qa", status: "active" }),
    row("Production Manager", "2024-06-01", { code: "DES-PRD-M", name: "Production Manager", departmentId: "production", status: "active" }),
    row("QC Manager", "2024-06-01", { code: "DES-QC-M", name: "QC Manager", departmentId: "qc", status: "active" }),
  ],
  hrJobRequisitions: [
    row("req-qa-off", "2026-09-20", { requisitionNumber: "REQ-2026-016", title: "QA Officer — Batch release", departmentId: "qa", headcount: 1, status: "open" }),
    row("req-chem", "2026-10-01", { requisitionNumber: "REQ-2026-018", title: "QC Chemist — HPLC", departmentId: "qc", headcount: 2, status: "interviewing" }),
  ],
  hrCandidates: [
    row("cand-rhea", "2026-10-04", { candidateNumber: "CAND-2026-044", fullName: "Rhea Kulkarni", requisitionId: "req-qa-off", status: "interview" }),
    row("cand-aman", "2026-10-06", { candidateNumber: "CAND-2026-047", fullName: "Aman Gupta", requisitionId: "req-chem", status: "offer" }),
  ],
  hrOnboardingTasks: [
    row("onb-aman-1", "2026-10-08", { title: "GMP induction and gowning", employeeId: E.priya, category: "training", dueDate: "2026-10-20", status: "pending" }),
  ],
  hrEmployeeDocuments: [
    row("doc-ananya-appt", "2026-04-12", { documentNumber: "HRD-1042-01", title: "Appointment letter", employeeId: E.ananya, status: "verified" }),
  ],
  hrAttendanceRecords: [
    row("att-ananya-12", "2026-10-12", { attendanceDate: "2026-10-12", employeeId: E.ananya, status: "present", checkIn: "08:52", checkOut: "" }),
    row("att-rohit-12", "2026-10-12", { attendanceDate: "2026-10-12", employeeId: E.rohit, status: "present", checkIn: "08:05", checkOut: "" }),
    row("att-priya-12", "2026-10-12", { attendanceDate: "2026-10-12", employeeId: E.priya, status: "late", checkIn: "09:26", checkOut: "", lateArrival: true }),
    row("att-vikram-12", "2026-10-12", { attendanceDate: "2026-10-12", employeeId: E.vikram, status: "present", checkIn: "08:14", checkOut: "" }),
    row("att-neha-10", "2026-10-10", { attendanceDate: "2026-10-10", employeeId: E.neha, status: "on_leave", checkIn: "", checkOut: "" }),
  ],
  hrShiftDefinitions: [
    row("shift-g", "2026-04-01", { code: "G", name: "General", startTime: "09:00", endTime: "18:00", status: "active" }),
    row("shift-a", "2026-04-01", { code: "A", name: "Shift A", startTime: "06:00", endTime: "14:00", status: "active" }),
    row("shift-b", "2026-04-01", { code: "B", name: "Shift B", startTime: "14:00", endTime: "22:00", status: "active" }),
  ],
  hrShiftAssignments: [
    row("sa-rohit", "2026-10-01", { employeeId: E.rohit, shiftId: "shift-a", effectiveFrom: "2026-10-01", effectiveTo: "2026-10-31", status: "active" }),
  ],
  hrLeavePolicies: [
    row("leave-cl", "2026-04-01", { code: "CL", name: "Casual leave", annualEntitlement: 8, status: "active" }),
    row("leave-pl", "2026-04-01", { code: "PL", name: "Privilege leave", annualEntitlement: 18, status: "active" }),
  ],
  hrLeaveApplications: [
    row("lv-neha", "2026-10-08", { applicationNumber: "LV-2026-088", employeeId: E.neha, leavePolicyId: "leave-cl", fromDate: "2026-10-10", toDate: "2026-10-10", days: 1, status: "approved" }),
    row("lv-vikram", "2026-10-11", { applicationNumber: "LV-2026-091", employeeId: E.vikram, leavePolicyId: "leave-pl", fromDate: "2026-10-20", toDate: "2026-10-22", days: 3, status: "submitted" }),
  ],
  hrCompensationRecords: [
    row("comp-ananya", "2026-04-01", { employeeId: E.ananya, effectiveFrom: "2026-04-01", basic: 125000, hra: 50000, currency: "INR", status: "active" }),
    row("comp-rohit", "2026-04-01", { employeeId: E.rohit, effectiveFrom: "2026-04-01", basic: 98000, hra: 39200, currency: "INR", status: "active" }),
  ],
  hrPayrollRuns: [
    row("payrun-sep", "2026-10-02", { payrollNumber: "PAY-2026-09", periodFrom: "2026-09-01", periodTo: "2026-09-30", status: "paid", netPayable: 4820000 }),
    row("payrun-oct", "2026-10-11", { payrollNumber: "PAY-2026-10", periodFrom: "2026-10-01", periodTo: "2026-10-31", status: "draft" }),
  ],
  hrPayslipReferences: [
    row("ps-ananya-sep", "2026-10-02", { payslipNumber: "PSL-1042-09", employeeCode: "EMP-1042", employeeId: E.ananya, periodFrom: "2026-09-01", periodTo: "2026-09-30", netPayable: 168400, status: "issued" }),
  ],
  hrEmployeeRequests: [
    row("hrr-014", "2026-10-07", { requestNumber: "HRR-2026-014", requestType: "address_change", employeeId: E.priya, status: "pending" }),
  ],
  hrSeparationRecords: [
    row("sep-009", "2026-08-01", { separationNumber: "SEP-2026-009", employeeId: "Legacy Operator", separationType: "resignation", lastWorkingDay: "2026-08-31", status: "closed" }),
  ],
  hrOvertimeRequests: [
    row("ot-033", "2026-10-08", { overtimeNumber: "OT-2026-033", employeeId: E.rohit, overtimeDate: "2026-10-08", overtimeMinutes: 150, reason: "PCM compression close-out", status: "approved" }),
  ],
  trainingCourses: [
    row("tr-gmp", "2026-04-01", { code: "TR-GMP-01", title: "Annual GMP refresher", category: "gmp", status: "active" }),
    row("tr-data", "2026-04-01", { code: "TR-DI-02", title: "Data integrity for QC", category: "quality", status: "active" }),
  ],
  trainingAssignments: [
    row("tra-priya", "2026-09-01", { employeeId: E.priya, courseId: "tr-data", dueDate: "2026-10-31", status: "assigned" }),
    row("tra-rohit", "2026-09-01", { employeeId: E.rohit, courseId: "tr-gmp", dueDate: "2026-09-30", status: "completed" }),
  ],

  engineeringEquipment: [
    row("eng-cad", "2026-04-04", { equipmentNumber: "EQ-CAD-45", name: "Cadmach 45 station", category: "compression", criticality: "high", status: "operational", location: "Compression Hall" }),
    row("eng-rmg", "2026-04-04", { equipmentNumber: "EQ-RMG-600", name: "RMG 600 L", category: "granulation", criticality: "high", status: "operational" }),
    row("eng-hvac", "2026-04-04", { equipmentNumber: "EQ-AHU-03", name: "AHU-03 Compression", category: "hvac", criticality: "critical", status: "operational" }),
  ],
  engineeringMaintenancePlans: [
    row("mp-cad", "2026-04-10", { planNumber: "MP-CAD-Q", name: "Quarterly preventive — Cadmach", equipmentId: "eng-cad", frequency: "quarterly", status: "active" }),
  ],
  engineeringMaintenanceTasks: [
    row("mt-014", "2026-10-01", { taskNumber: "MT-2026-014", equipmentId: "eng-cad", dueDate: "2026-10-18", title: "Punch inspection", status: "scheduled" }),
  ],
  engineeringWorkOrders: [
    row("wo-088", "2026-10-09", { workOrderNumber: "WO-2026-088", equipmentId: "eng-rmg", workOrderType: "corrective", priority: "high", status: "in_progress", title: "Discharge valve seal weep" }),
    row("wo-081", "2026-09-22", { workOrderNumber: "WO-2026-081", equipmentId: "eng-cad", workOrderType: "preventive", priority: "normal", status: "completed" }),
  ],
  engineeringBreakdowns: [
    row("brk-006", "2026-10-09", { breakdownNumber: "BRK-2026-006", equipmentId: "eng-rmg", severity: "medium", startedAt: "2026-10-09T14:10:00.000Z", status: "under_repair" }),
  ],
  engineeringInstruments: [
    row("ins-bal", "2026-04-04", { instrumentNumber: "INS-BAL-02", name: "Sartorius analytical balance", measurementType: "mass", nextCalibrationDueDate: "2026-12-15", status: "calibrated" }),
    row("ins-probe", "2026-04-04", { instrumentNumber: "INS-TMP-07", name: "Coating pan temperature probe", measurementType: "temperature", nextCalibrationDueDate: "2026-10-20", status: "due" }),
  ],
  engineeringCalibrationRecords: [
    row("cal-bal", "2026-06-16", { calibrationNumber: "CAL-2026-066", instrumentId: "ins-bal", scheduledDate: "2026-06-15", status: "completed", result: "pass" }),
    row("cal-probe", "2026-10-11", { calibrationNumber: "CAL-2026-102", instrumentId: "ins-probe", scheduledDate: "2026-10-20", status: "scheduled" }),
  ],
  engineeringQualificationRecords: [
    row("qual-cad", "2026-03-12", { qualificationNumber: "QUAL-CAD-PQ", equipmentId: "eng-cad", qualificationType: "PQ", status: "approved", completedOn: "2026-03-12" }),
  ],
  engineeringMaintenanceChecklists: [
    row("chk-press", "2026-04-10", { name: "Compression press daily start-up", version: "02", equipmentCategory: "compression", status: "effective" }),
  ],
  engineeringUtilitySystems: [
    row("util-ahu", "2026-04-04", { utilityNumber: "UTL-AHU-03", name: "AHU-03 Compression", systemType: "hvac", status: "qualified" }),
    row("util-pw", "2026-04-04", { utilityNumber: "UTL-PW", name: "Purified water loop", systemType: "water", status: "qualified" }),
  ],
  engineeringMonitoringRecords: [
    row("mon-ahu", "2026-10-11", { utilitySystemId: "util-ahu", parameter: "Differential pressure", value: 18, unit: "Pa", measuredAt: "2026-10-11T08:00:00.000Z", status: "within_limit" }),
    row("mon-pw", "2026-10-11", { utilitySystemId: "util-pw", parameter: "Conductivity", value: 0.9, unit: "µS/cm", measuredAt: "2026-10-11T07:40:00.000Z", status: "within_limit" }),
  ],
  engineeringUtilityAlerts: [
    row("ual-002", "2026-10-09", { alertNumber: "UAL-2026-002", utilitySystemId: "util-ahu", parameter: "Room humidity", status: "acknowledged" }),
  ],
  engineeringSpareLinks: [
    row("spr-seal", "2026-04-10", { materialId: "RMG discharge seal", equipmentId: "eng-rmg", partNumber: "RMG-SEAL-80", criticalSpare: true, status: "active" }),
  ],
  engineeringDocuments: [
    row("edoc-uru", "2026-03-12", { documentNumber: "URS-CAD-45", title: "User requirement — Cadmach 45", documentType: "urs", status: "effective" }),
  ],

  warehousePutawayTasks: [
    row("put-318", "2026-10-06", { putawayNumber: "PUT-2026-318", warehouseId: W.rm, batchNumber: "APCM-26-092", quantity: 500, toLocationId: "RM-A-01", status: "completed" }),
    row("put-322", "2026-10-11", { putawayNumber: "PUT-2026-322", warehouseId: W.q, batchNumber: "APCM-26-088", quantity: 180, status: "pending" }),
  ],
  warehouseMovements: [
    row("mov-014", "2026-10-07", { movementNumber: "STK-MOV-2026-014", movementType: "quarantine_to_approved", batchNumber: "APCM-26-092", quantity: 500, status: "posted" }),
  ],
  warehousePickLists: [
    row("pick-268", "2026-10-10", { pickNumber: "PICK-2026-268", customerId: C.sun, productId: P.amox, salesOrderId: "so-268", quantity: 120000, batchNumber: "AMX500-2609-0771", status: "picked" }),
    row("pick-248", "2026-10-08", { pickNumber: "PICK-2026-248", customerId: C.cipla, productId: P.pcm, quantity: 80000, status: "packed" }),
  ],
  warehousePackingRecords: [
    row("pack-248", "2026-10-09", { packingNumber: "PACK-2026-248", pickId: "pick-248", shippers: 40, status: "verified" }),
  ],
  warehouseShipments: [
    row("shp-190", "2026-10-10", { shipmentNumber: "SHP-2026-190", customerId: C.cipla, salesOrderId: "so-248", trackingNumber: "SFX882190IN", carrier: "SafeExpress", status: "in_transit" }),
    row("shp-186", "2026-09-30", { shipmentNumber: "SHP-2026-186", customerId: C.sun, trackingNumber: "SFX880441IN", status: "delivered" }),
    row("shp-192", "2026-10-11", { shipmentNumber: "SHP-2026-192", customerId: C.sun, salesOrderId: "so-268", trackingNumber: "", status: "ready" }),
  ],
  warehouseReturns: [
    row("wret-012", "2026-09-09", { returnNumber: "WRET-2026-012", customerId: C.sun, batchNumber: "AMX500-2606-0510", quantity: 2400, status: "quarantine" }),
  ],
  warehouseCycleCounts: [
    row("cc-sep-rm", "2026-09-30", { countNumber: "CC-2026-019", warehouseId: W.rm, variance: -20, uom: "KG", status: "posted" }),
  ],
  warehouseTemperatureDevices: [
    row("dev-cold-1", "2026-04-03", { deviceCode: "TMP-CLD-01", name: "Cold room probe", warehouseId: W.cold, status: "active" }),
  ],
  warehouseTemperatureRecords: [
    row("tmp-1011-a", "2026-10-11", { timestamp: "2026-10-11T06:00:00.000Z", temperature: 4.2, warehouseId: W.cold, shipmentId: "", status: "normal" }),
    row("tmp-1011-b", "2026-10-11", { timestamp: "2026-10-11T12:00:00.000Z", temperature: 4.6, warehouseId: W.cold, status: "normal" }),
  ],
  warehouseTemperatureExcursions: [
    row("exc-004", "2026-09-14", { excursionNumber: "EXC-2026-004", shipmentId: "shp-172", temperature: 11.4, durationMinutes: 18, status: "qa_disposition" }),
  ],
  warehouseLogisticsProviders: [
    row("sfx", "2026-04-01", { name: "SafeExpress Pharma", mode: "road", qualificationStatus: "approved", status: "active" }),
  ],

  costingProductStandards: [
    row("std-pcm", "2026-05-12", { standardNumber: "STD-PCM-03", productId: P.pcm, bomId: "bom-pcm-03", batchSize: 200000, totalBatchCost: 612000, costPerUnit: 3.06, currency: "INR", status: "approved" }),
    row("std-amx", "2026-06-02", { standardNumber: "STD-AMX-02", productId: P.amox, bomId: "bom-amx-02", batchSize: 120000, totalBatchCost: 1488000, costPerUnit: 12.4, currency: "INR", status: "approved" }),
  ],
  costingBatchRecords: [
    row("bc-1842", "2026-10-10", { batchCostingNumber: "BC-2026-1842", productId: P.pcm, batchNumber: "PCM500-2610-1842", totalBatchCost: 598400, costPerUnit: 3.05, standardCostPerUnit: 3.06, status: "approved" }),
    row("bc-0771", "2026-10-05", { batchCostingNumber: "BC-2026-0771", productId: P.amox, batchNumber: "AMX500-2609-0771", totalBatchCost: 1562000, costPerUnit: 13.02, standardCostPerUnit: 12.4, status: "review" }),
  ],
  costingRateCards: [
    row("rc-cmp", "2026-04-01", { rateCardNumber: "RC-CMP", name: "Compression hour", rateType: "machine", rate: 4200, currency: "INR", status: "active" }),
    row("rc-qc", "2026-04-01", { rateCardNumber: "RC-QC", name: "QC hour", rateType: "labour", rate: 850, currency: "INR", status: "active" }),
  ],
  costingAllocationRules: [
    row("ar-hvac", "2026-04-01", { ruleNumber: "AR-HVAC", name: "HVAC by machine hour", allocationBasis: "machine_hours", costPoolAmount: 1800000, status: "active" }),
  ],
  costingVarianceAnalyses: [
    row("var-0771", "2026-10-05", { varianceNumber: "VAR-2026-0771", batchCostingId: "bc-0771", varianceType: "material", amount: 74400, status: "open" }),
  ],
  costingVarianceInvestigations: [
    row("vin-0771", "2026-10-06", { investigationNumber: "VIN-2026-004", batchCostingId: "bc-0771", varianceType: "material", amount: 74400, title: "Amoxicillin API price above standard", status: "in_progress" }),
  ],

  regulatoryProfiles: [
    row("rp-pcm", "2026-05-01", { profileNumber: "RP-PCM-500", productId: P.pcm, productCode: "FP-PCM-500", productName: "Paracetamol Tablets 500 mg", status: "active" }),
    row("rp-azi", "2026-06-02", { profileNumber: "RP-AZI-250", productId: P.azi, productCode: "FP-AZI-250", productName: "Azithromycin Tablets 250 mg", status: "active" }),
  ],
  regulatoryMarkets: [
    row("mkt-in", "2026-04-01", { marketCode: "IN", marketName: "India", country: "India", region: "APAC", status: "active" }),
    row("mkt-us", "2026-04-01", { marketCode: "US", marketName: "United States", country: "United States", region: "Americas", status: "active" }),
    row("mkt-eu", "2026-04-01", { marketCode: "EU", marketName: "European Union", country: "European Union", region: "Europe", status: "active" }),
  ],
  regulatoryAuthorities: [
    row("cdsco", "2026-04-01", { authorityName: "CDSCO", country: "India", region: "APAC", submissionMethod: "SUGAM", status: "active" }),
    row("fda", "2026-04-01", { authorityName: "US FDA", country: "United States", region: "Americas", submissionMethod: "ESG", status: "active" }),
  ],
  regulatoryRegistrations: [
    row("reg-pcm-in", "2026-05-20", { registrationNumber: "REG-IN-PCM-500", productId: P.pcm, marketId: "India", authorityId: "cdsco", status: "approved", expiryDate: "2029-05-19" }),
    row("reg-azi-us", "2026-08-01", { registrationNumber: "ANDA-214882", productId: P.azi, marketId: "United States", authorityId: "fda", status: "under_review", expiryDate: "" }),
  ],
  regulatorySubmissions: [
    row("sub-azi", "2026-08-12", { submissionNumber: "SUB-2026-019", productId: P.azi, marketId: "United States", submissionVersion: "1.0", status: "query" }),
    row("sub-pcm-var", "2026-09-02", { submissionNumber: "SUB-2026-024", productId: P.pcm, marketId: "India", submissionVersion: "2.1", status: "approved" }),
  ],
  regulatoryDossiers: [
    row("dos-pcm", "2026-05-18", { dossierNumber: "DOS-PCM-IN", title: "Paracetamol 500 mg — India CTD", productId: P.pcm, status: "effective" }),
    row("dos-azi", "2026-07-20", { dossierNumber: "DOS-AZI-US", title: "Azithromycin 250 mg — US CTD", productId: P.azi, status: "in_assembly" }),
  ],
  regulatoryDocuments: [
    row("rdoc-sop", "2026-05-18", { documentNumber: "SMF-BHW-2026", documentTitle: "Site master file — Bhiwadi", documentType: "site_master_file", status: "effective", expiryDate: "2027-05-18" }),
  ],
  regulatoryLicenses: [
    row("lic-mfg", "2026-04-01", { licenseNumber: "ML-RJ-2014-0842", licenseType: "manufacturing", plantId: "Bhiwadi Manufacturing", status: "valid", expiryDate: "2028-03-31" }),
    row("lic-who", "2026-01-15", { licenseNumber: "WHO-GMP-2026", licenseType: "who_gmp", plantId: "Bhiwadi Manufacturing", status: "valid", expiryDate: "2028-01-14" }),
  ],
  regulatoryRenewals: [
    row("ren-who", "2026-10-01", { renewalNumber: "REN-2026-004", registrationId: "WHO-GMP-2026", plannedSubmissionDate: "2027-07-01", status: "planned" }),
  ],
  regulatoryQueries: [
    row("qry-azi-1", "2026-09-28", { queryNumber: "QRY-2026-011", submissionId: "sub-azi", queryCategory: "dissolution", responseDueDate: "2026-10-28", status: "drafting" }),
  ],
  regulatoryCommitments: [
    row("rcom-1", "2026-09-02", { commitmentNumber: "RCM-2026-006", sourceType: "variation", title: "Stability update after artwork change", dueDate: "2026-12-15", status: "open" }),
  ],
  regulatoryCommunications: [
    row("rcorr-1", "2026-09-28", { communicationNumber: "RCOR-2026-019", subject: "FDA information request — dissolution method", direction: "incoming", communicationType: "query", status: "open" }),
  ],
  regulatoryArtworks: [
    row("art-pcm-v4", "2026-09-02", { artworkNumber: "ART-PCM-V4", productId: P.pcm, customerId: C.cipla, title: "Cipla carton v4", status: "approved" }),
  ],
  regulatoryChanges: [
    row("rch-044", "2026-09-02", { changeNumber: "RCH-2026-044", title: "Carton pharmacode and colour band", status: "implemented", effectiveDate: "2026-09-20" }),
  ],
  regulatoryRequirements: [
    row("rreq-cipla", "2026-05-16", { customerId: C.cipla, productId: P.pcm, marketId: "India", requirementType: "shelf_life", title: "18 months remaining shelf life", status: "active" }),
  ],

  pvIntakes: [
    row("pvi-014", "2026-10-02", { intakeNumber: "PVI-2026-014", sourceType: "spontaneous", productId: P.amox, urgency: "routine", status: "case_created" }),
    row("pvi-016", "2026-10-09", { intakeNumber: "PVI-2026-016", sourceType: "literature", productId: P.pcm, urgency: "high", status: "triage" }),
  ],
  pvCases: [
    row("pvc-008", "2026-10-03", { caseNumber: "PVC-2026-008", productId: P.amox, batchNumber: "AMX500-2606-0510", eventTerm: "Rash", country: "India", priority: "routine", status: "medical_review", dueDate: "2026-10-18" }),
    row("pvc-004", "2026-07-22", { caseNumber: "PVC-2026-004", productId: P.pcm, batchNumber: "PCM500-2604-0901", eventTerm: "Elevated liver enzymes", country: "India", priority: "serious", status: "closed", dueDate: "2026-08-06" }),
  ],
  pvFollowUps: [
    row("pvf-008", "2026-10-06", { followUpNumber: "PVF-2026-008", caseId: "pvc-008", requestReason: "Concomitant medicines and onset date", dueDate: "2026-10-20", status: "awaiting" }),
  ],
  pvRegulatoryReports: [
    row("pvr-004", "2026-07-28", { reportNumber: "PVR-2026-004", caseNumber: "PVC-2026-004", caseId: "pvc-004", reportingDueDate: "2026-08-06", status: "submitted" }),
  ],
  pvReportingRules: [
    row("rule-serious-in", "2026-04-01", { ruleNumber: "PV-IN-SER", caseType: "serious", reportingWindow: 15, market: "India", status: "active" }),
  ],
  pvSignals: [
    row("sig-rash", "2026-10-08", { signalNumber: "SIG-2026-003", productId: P.amox, eventTerm: "Rash", caseCount: 3, status: "assessment" }),
  ],
  pvCommitments: [
    row("pvcom-1", "2026-08-01", { commitmentNumber: "PVCM-2026-002", source: "PSUR", title: "Next PSUR for amoxicillin range", dueDate: "2026-12-31", status: "open" }),
  ],

  complaints: [
    row("cmp-021", "2026-09-06", { complaintNumber: "CMP-2026-021", customerId: C.sun, productId: P.amox, productName: "Amoxicillin Capsules 500 mg", batchNumber: "AMX500-2606-0510", category: "packaging", severity: "minor", status: "closed", dueDate: "2026-10-06", description: "Print smudge on 2 shippers" }),
    row("cmp-024", "2026-10-07", { complaintNumber: "CMP-2026-024", customerId: C.cipla, productId: P.pcm, productName: "Paracetamol Tablets 500 mg", batchNumber: "PCM500-2607-1410", category: "quality", severity: "major", status: "investigation", dueDate: "2026-10-21", description: "Market report of chipped tablets in one carton", capaId: "capa-028" }),
  ],
  complaintInvestigations: [
    row("cinvs-024", "2026-10-08", { investigationNumber: "CINV-2026-024", complaintId: "cmp-024", complaintNumber: "CMP-2026-024", dueDate: "2026-10-21", status: "in_progress", lead: E.ananya }),
  ],
  complaintSamples: [
    row("csmp-024", "2026-10-09", { sampleNumber: "CSMP-2026-024", complaintId: "cmp-024", receivedDate: "2026-10-09", status: "received" }),
  ],
  complaintCommunications: [
    row("ccom-024", "2026-10-08", { complaintId: "cmp-024", subject: "Acknowledgement — CMP-2026-024", communicationType: "email", status: "sent" }),
  ],
  complaintRecalls: [
    row("rcl-assess-1", "2026-10-08", { recallNumber: "RCL-2026-001", productId: P.pcm, productName: "Paracetamol Tablets 500 mg", recallClass: "class_iii", status: "assessment", reason: "Chipped tablets — extent not yet confirmed" }),
  ],
  complaintWithdrawals: [
    row("wd-none", "2026-06-01", { withdrawalNumber: "WD-2026-001", productId: P.cet, reason: "Artwork not yet approved — commercial hold only", status: "draft" }),
  ],
  complaintRegulatoryNotifications: [
    row("crn-1", "2026-10-08", { notificationNumber: "CRN-2026-003", subject: "Assessment — chipped tablet complaint", status: "not_required" }),
  ],
  complaintCategories: [
    row("cat-pack", "2026-04-01", { code: "PACK", name: "Packaging", status: "active" }),
    row("cat-qual", "2026-04-01", { code: "QUAL", name: "Product quality", status: "active" }),
  ],

  supplierQualityProfiles: [
    row("sq-auro", "2026-04-22", { supplierId: V.auro, riskLevel: "low", performanceScore: 96, status: "approved" }),
    row("sq-signet", "2026-04-22", { supplierId: V.signet, riskLevel: "low", performanceScore: 94, status: "approved" }),
    row("sq-huht", "2026-05-11", { supplierId: V.huht, riskLevel: "medium", performanceScore: 81, status: "conditional" }),
  ],
  supplierQualifications: [
    row("sqq-auro", "2026-04-22", { qualificationNumber: "SUP-Q-2026-00012", supplierId: V.auro, qualificationType: "audit_qualification", riskLevel: "low", targetDate: "2026-04-30", status: "approved" }),
    row("sqq-huht", "2026-06-01", { qualificationNumber: "SUP-Q-2026-00019", supplierId: V.huht, qualificationType: "initial", riskLevel: "medium", targetDate: "2026-07-15", status: "conditional" }),
  ],
  supplierEvaluations: [
    row("sqe-auro", "2026-09-30", { supplierId: V.auro, overallScore: 96, previousScore: 94, evaluationDate: "2026-09-30", status: "approved" }),
    row("sqe-huht", "2026-09-30", { supplierId: V.huht, overallScore: 81, previousScore: 88, evaluationDate: "2026-09-30", status: "approved" }),
  ],
  supplierAudits: [
    row("sqa-auro", "2026-03-18", { auditNumber: "SUP-AUD-2026-00004", supplierId: V.auro, auditType: "on_site", plannedDate: "2026-03-18", status: "closed" }),
    row("sqa-huht", "2026-11-12", { auditNumber: "SUP-AUD-2026-00011", supplierId: V.huht, auditType: "for_cause", plannedDate: "2026-11-12", status: "planned" }),
  ],
  supplierQualificationDocuments: [
    row("sqd-auro-gmp", "2026-04-22", { supplierId: V.auro, qualificationId: "sqq-auro", documentType: "gmp_certificate", expiryDate: "2027-12-31", status: "approved" }),
  ],
  supplierCertificates: [
    row("sqc-auro", "2026-04-22", { supplierId: V.auro, certificateNumber: "WHO-GMP-AURO-25", certificateType: "who_gmp", expiryDate: "2027-12-31", status: "valid" }),
  ],
  supplierQualityAgreements: [
    row("sqag-auro", "2026-04-20", { agreementNumber: "SQA-2026-008", supplierId: V.auro, agreementType: "quality_agreement", expiryDate: "2027-03-31", status: "effective" }),
  ],
  supplierChanges: [
    row("sqch-1", "2026-09-14", { changeNumber: "SQCH-2026-006", supplierId: V.auro, changeType: "site", title: "Additional micronisation suite", status: "impact_assessment" }),
  ],
  supplierRequalifications: [
    row("sqr-signet", "2026-10-01", { requalificationNumber: "SQR-2026-003", supplierId: V.signet, dueDate: "2026-12-01", status: "open" }),
  ],
  supplierSuspensions: [
    row("sqs-none", "2026-02-01", { suspensionNumber: "SQS-2026-001", supplierId: "Legacy Printer", reason: "Repeated artwork mismatches", status: "approved" }),
  ],
  supplierMaterialQualifications: [
    row("sqm-pcm", "2026-04-22", { supplierId: V.auro, materialId: "Paracetamol IP", qualificationStatus: "approved", expiryDate: "2027-04-22", status: "approved" }),
    row("sqm-mcc", "2026-04-22", { supplierId: V.signet, materialId: "MCC PH102", qualificationStatus: "approved", expiryDate: "2027-04-22", status: "approved" }),
  ],
  supplierQuestionnaires: [
    row("sqn-huht", "2026-06-02", { title: "Printed component quality questionnaire", supplierId: V.huht, status: "received" }),
  ],

  dmsDocuments: [
    row("sop-dsp", "2026-08-01", { documentNumber: "SOP-PRD-DSP-006", title: "Dispensing of active materials", documentType: "sop", workingStatus: "effective", effectiveVersionLabel: "06", nextReviewDate: "2027-08-01", status: "effective" }),
    row("sop-rel", "2026-06-15", { documentNumber: "SOP-QA-REL-003", title: "Batch release by QA", documentType: "sop", workingStatus: "effective", effectiveVersionLabel: "03", nextReviewDate: "2027-06-15", status: "effective" }),
    row("sop-oos", "2026-09-01", { documentNumber: "SOP-QC-OOS-002", title: "Out of specification investigation", documentType: "sop", workingStatus: "in_review", effectiveVersionLabel: "02", nextReviewDate: "2026-12-01", status: "in_review" }),
  ],
  dmsDocumentChangeRequests: [
    row("dcr-019", "2026-10-06", { requestNumber: "DCR-2026-019", title: "Add metal detector check to packing SOP", requestType: "revision", documentId: "sop-dsp", status: "impact_assessment" }),
  ],
  dmsExternalDocuments: [
    row("ext-ip", "2026-01-10", { externalNumber: "IP-2022", title: "Indian Pharmacopoeia 2022", issuer: "IPC", expiryDate: "", status: "current" }),
  ],
  dmsPeriodicReviews: [
    row("dpr-rel", "2026-06-10", { reviewNumber: "DPR-2026-011", documentNumber: "SOP-QA-REL-003", decision: "remain_effective", nextReviewDate: "2027-06-15", status: "closed" }),
  ],
  dmsTemplates: [
    row("tpl-sop", "2026-04-01", { prefix: "SOP", label: "Standard operating procedure", documentType: "sop", reviewIntervalDays: 365, status: "active" }),
    row("tpl-bmr", "2026-04-01", { prefix: "BMR", label: "Batch manufacturing record", documentType: "bmr", reviewIntervalDays: 730, status: "active" }),
  ],
  dmsAuditRecords: [
    row("daud-1", "2026-10-10", { action: "issued", description: "QA released batch PCM500-2610-1842", actorEmail: "ananya.sharma@patrilifesciences.com", createdAt: "2026-10-10T16:40:00.000Z", status: "recorded" }),
  ],

  artworkRequests: [
    row("art-058", "2026-10-11", { artworkNumber: "ART-2026-058", title: "Abbott pantoprazole carton", productId: P.panto, customerId: C.abbott, component: "Carton", market: "India", versionLabel: "1", dueDate: "2026-10-21", ownerName: E.neha, currentLane: "customer", remarks: "Abbott blue band and morning-dose panel. Waiting on the customer proof.", status: "customer_review" }),
    row("art-051", "2026-10-10", { artworkNumber: "ART-2026-051", title: "Cipla paracetamol foil", productId: P.pcm, customerId: C.cipla, component: "Foil", market: "India", versionLabel: "2", dueDate: "2026-10-16", ownerName: E.ananya, currentLane: "qa", remarks: "Print area for batch number and expiry. Packaging has signed.", status: "qa_review" }),
    row("art-062", "2026-10-09", { artworkNumber: "ART-2026-062", title: "Sun amoxicillin label", productId: P.amox, customerId: C.sun, component: "Label", market: "India", versionLabel: "2", dueDate: "2026-10-14", ownerName: E.rohit, currentLane: "qa", remarks: "Sun asked for a darker green and a larger generic name.", status: "changes_requested" }),
    row("art-066", "2026-10-08", { artworkNumber: "ART-2026-066", title: "Dr. Reddy's azithromycin export carton", productId: P.azi, customerId: C.reddy, component: "Carton", market: "Export", versionLabel: "1", dueDate: "2026-10-22", ownerName: E.ananya, currentLane: "regulatory", remarks: "English and Russian panels for the export shipper carton.", status: "regulatory_review" }),
    row("art-070", "2026-10-07", { artworkNumber: "ART-2026-070", title: "Mankind cetirizine leaflet", productId: P.cet, customerId: C.mankind, component: "Leaflet", market: "India", versionLabel: "1", dueDate: "2026-10-28", ownerName: E.neha, currentLane: "packaging", remarks: "First draft. Not submitted yet.", status: "draft" }),
    row("art-044", "2026-09-20", { artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", productId: P.pcm, customerId: C.cipla, component: "Carton", market: "India", versionLabel: "4", dueDate: "2026-09-15", ownerName: E.ananya, currentLane: "customer", remarks: "Pharmacode and Braille panel are locked. This file is effective.", status: "effective" }),
  ],
  artworkApprovals: [
    row("art-044-packaging", "2026-08-12", { requestId: "art-044", artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", customerId: C.cipla, lane: "packaging", decision: "approved", actorName: E.rohit, comment: "Print proof accepted", status: "approved" }),
    row("art-044-qa", "2026-08-18", { requestId: "art-044", artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", customerId: C.cipla, lane: "qa", decision: "approved", actorName: E.ananya, comment: "Text matches the approved specification", status: "approved" }),
    row("art-044-regulatory", "2026-08-22", { requestId: "art-044", artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", customerId: C.cipla, lane: "regulatory", decision: "approved", actorName: "Regulatory desk", comment: "Schedule M text is complete", status: "approved" }),
    row("art-044-customer", "2026-09-02", { requestId: "art-044", artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", customerId: C.cipla, lane: "customer", decision: "approved", actorName: C.cipla, comment: "Customer approved version 4", status: "approved" }),
    row("art-051-packaging", "2026-10-08", { requestId: "art-051", artworkNumber: "ART-2026-051", title: "Cipla paracetamol foil", customerId: C.cipla, lane: "packaging", decision: "approved", actorName: E.rohit, comment: "Foil print area is clear of the seal", status: "approved" }),
    row("art-051-qa", "2026-10-10", { requestId: "art-051", artworkNumber: "ART-2026-051", title: "Cipla paracetamol foil", customerId: C.cipla, lane: "qa", decision: "pending", actorName: "", comment: "With QA for text check", status: "pending" }),
    row("art-051-regulatory", "2026-10-10", { requestId: "art-051", artworkNumber: "ART-2026-051", title: "Cipla paracetamol foil", customerId: C.cipla, lane: "regulatory", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-051-customer", "2026-10-10", { requestId: "art-051", artworkNumber: "ART-2026-051", title: "Cipla paracetamol foil", customerId: C.cipla, lane: "customer", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-058-packaging", "2026-10-04", { requestId: "art-058", artworkNumber: "ART-2026-058", title: "Abbott pantoprazole carton", customerId: C.abbott, lane: "packaging", decision: "approved", actorName: E.rohit, comment: "Colour band matches the Abbott swatch", status: "approved" }),
    row("art-058-qa", "2026-10-06", { requestId: "art-058", artworkNumber: "ART-2026-058", title: "Abbott pantoprazole carton", customerId: C.abbott, lane: "qa", decision: "approved", actorName: E.ananya, comment: "Strength and storage statement checked", status: "approved" }),
    row("art-058-regulatory", "2026-10-08", { requestId: "art-058", artworkNumber: "ART-2026-058", title: "Abbott pantoprazole carton", customerId: C.abbott, lane: "regulatory", decision: "approved", actorName: "Regulatory desk", comment: "No extra market statement", status: "approved" }),
    row("art-058-customer", "2026-10-11", { requestId: "art-058", artworkNumber: "ART-2026-058", title: "Abbott pantoprazole carton", customerId: C.abbott, lane: "customer", decision: "pending", actorName: "", comment: "Proof sent to Abbott", status: "pending" }),
    row("art-062-packaging", "2026-10-06", { requestId: "art-062", artworkNumber: "ART-2026-062", title: "Sun amoxicillin label", customerId: C.sun, lane: "packaging", decision: "approved", actorName: E.rohit, comment: "Label fit on the bottle is fine", status: "approved" }),
    row("art-062-qa", "2026-10-09", { requestId: "art-062", artworkNumber: "ART-2026-062", title: "Sun amoxicillin label", customerId: C.sun, lane: "qa", decision: "changes_requested", actorName: E.ananya, comment: "Darker green and a larger generic name", status: "changes_requested" }),
    row("art-062-regulatory", "2026-10-09", { requestId: "art-062", artworkNumber: "ART-2026-062", title: "Sun amoxicillin label", customerId: C.sun, lane: "regulatory", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-062-customer", "2026-10-09", { requestId: "art-062", artworkNumber: "ART-2026-062", title: "Sun amoxicillin label", customerId: C.sun, lane: "customer", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-066-packaging", "2026-10-05", { requestId: "art-066", artworkNumber: "ART-2026-066", title: "Dr. Reddy's azithromycin export carton", customerId: C.reddy, lane: "packaging", decision: "approved", actorName: E.rohit, comment: "Shipper dieline accepted", status: "approved" }),
    row("art-066-qa", "2026-10-07", { requestId: "art-066", artworkNumber: "ART-2026-066", title: "Dr. Reddy's azithromycin export carton", customerId: C.reddy, lane: "qa", decision: "approved", actorName: E.ananya, comment: "Both languages checked against the spec", status: "approved" }),
    row("art-066-regulatory", "2026-10-08", { requestId: "art-066", artworkNumber: "ART-2026-066", title: "Dr. Reddy's azithromycin export carton", customerId: C.reddy, lane: "regulatory", decision: "pending", actorName: "", comment: "Export text is with regulatory", status: "pending" }),
    row("art-066-customer", "2026-10-08", { requestId: "art-066", artworkNumber: "ART-2026-066", title: "Dr. Reddy's azithromycin export carton", customerId: C.reddy, lane: "customer", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-070-packaging", "2026-10-07", { requestId: "art-070", artworkNumber: "ART-2026-070", title: "Mankind cetirizine leaflet", customerId: C.mankind, lane: "packaging", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-070-qa", "2026-10-07", { requestId: "art-070", artworkNumber: "ART-2026-070", title: "Mankind cetirizine leaflet", customerId: C.mankind, lane: "qa", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-070-regulatory", "2026-10-07", { requestId: "art-070", artworkNumber: "ART-2026-070", title: "Mankind cetirizine leaflet", customerId: C.mankind, lane: "regulatory", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
    row("art-070-customer", "2026-10-07", { requestId: "art-070", artworkNumber: "ART-2026-070", title: "Mankind cetirizine leaflet", customerId: C.mankind, lane: "customer", decision: "waiting", actorName: "", comment: "", status: "waiting" }),
  ],
  artworkVersions: [
    row("art-044-v3", "2026-08-20", { requestId: "art-044", artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", versionLabel: "3", summary: "Colour band aligned to the Cipla brand.", preparedBy: E.rohit, versionStatus: "superseded", status: "superseded" }),
    row("art-044-v4", "2026-09-02", { requestId: "art-044", artworkNumber: "ART-2026-044", title: "Cipla paracetamol carton", versionLabel: "4", summary: "Pharmacode and Braille panel locked.", preparedBy: E.ananya, versionStatus: "current", status: "current" }),
    row("art-051-v2", "2026-10-08", { requestId: "art-051", artworkNumber: "ART-2026-051", title: "Cipla paracetamol foil", versionLabel: "2", summary: "Foil print area for batch and expiry.", preparedBy: E.rohit, versionStatus: "current", status: "current" }),
    row("art-058-v1", "2026-10-04", { requestId: "art-058", artworkNumber: "ART-2026-058", title: "Abbott pantoprazole carton", versionLabel: "1", summary: "Pantoprazole carton with the Abbott blue band.", preparedBy: E.neha, versionStatus: "current", status: "current" }),
    row("art-062-v2", "2026-10-09", { requestId: "art-062", artworkNumber: "ART-2026-062", title: "Sun amoxicillin label", versionLabel: "2", summary: "Sun asked for a darker green and a larger generic name.", preparedBy: E.ananya, versionStatus: "current", status: "current" }),
    row("art-066-v1", "2026-10-05", { requestId: "art-066", artworkNumber: "ART-2026-066", title: "Dr. Reddy's azithromycin export carton", versionLabel: "1", summary: "Export carton in English and Russian.", preparedBy: E.rohit, versionStatus: "current", status: "current" }),
    row("art-070-v1", "2026-10-07", { requestId: "art-070", artworkNumber: "ART-2026-070", title: "Mankind cetirizine leaflet", versionLabel: "1", summary: "Cetirizine leaflet, first draft.", preparedBy: E.neha, versionStatus: "current", status: "current" }),
  ],
};

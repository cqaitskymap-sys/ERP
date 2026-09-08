import { classifyExpiry } from "@/lib/partners/expiry";
import { queryMasterDocuments } from "@/lib/masters/firestore";

export async function loadPartnerDashboard(idToken: string) {
  const [
    customers,
    vendors,
    customerProducts,
    vendorMaterials,
    customerQualifications,
    vendorQualifications,
    customerDocuments,
    vendorDocuments,
    customerContracts,
  ] = await Promise.all([
    queryMasterDocuments("customers", idToken, { limit: 200 }),
    queryMasterDocuments("vendors", idToken, { limit: 200 }),
    queryMasterDocuments("productCustomerMappings", idToken, {
      filters: [{ field: "status", value: "active" }],
      limit: 200,
    }),
    queryMasterDocuments("vendorMaterials", idToken, {
      filters: [{ field: "status", value: "active" }],
      limit: 200,
    }),
    queryMasterDocuments("customerQualifications", idToken, { limit: 200 }),
    queryMasterDocuments("vendorQualifications", idToken, { limit: 200 }),
    queryMasterDocuments("customerDocuments", idToken, { limit: 200 }),
    queryMasterDocuments("vendorDocuments", idToken, { limit: 200 }),
    queryMasterDocuments("customerContracts", idToken, { limit: 200 }),
  ]);

  const pending = (rows: Array<Record<string, unknown>>, field: string) =>
    rows.filter((row) =>
      ["not_started", "under_review"].includes(String(row[field] || row.qualificationStatus || ""))
    ).length;

  const expiring = (rows: Array<Record<string, unknown>>) =>
    rows.filter((row) => {
      const state = classifyExpiry(row.expiryDate || row.endDate);
      return state === "expired" || state.startsWith("expiring_");
    }).length;

  return {
    window: 200,
    customers: {
      total: customers.length,
      active: customers.filter((row) => row.status === "active").length,
      pendingQualification: pending(customers, "qualificationStatus"),
      expiringQualification: expiring(customerQualifications),
      highRisk: customers.filter((row) => row.riskCategory === "high" || row.riskCategory === "critical").length,
      activeProducts: customerProducts.length,
      documentsExpiring: expiring(customerDocuments),
      activeContracts: customerContracts.filter((row) => row.status === "active").length,
    },
    vendors: {
      total: vendors.length,
      active: vendors.filter((row) => row.status === "active").length,
      pendingQualification: pending(vendors, "qualificationStatus"),
      expiringQualification: expiring(vendorQualifications),
      highRisk: vendors.filter((row) => row.riskCategory === "high" || row.riskCategory === "critical").length,
      approvedMaterials: vendorMaterials.filter((row) => row.supplierRole === "approved" || row.approvedSupplier).length,
      suspended: vendors.filter((row) => row.status === "suspended").length,
      documentsExpiring: expiring(vendorDocuments),
    },
  };
}

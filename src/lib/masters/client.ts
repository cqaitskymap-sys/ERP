import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";
import type { MasterEntity, MasterListQuery, MasterStatus } from "@/types/masters";

async function idToken() {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in is required for this action.");
  }
  return token;
}

async function masterFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await idToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-firebase-id-token": token,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  }
  return body;
}

function queryString(query: MasterListQuery = {}) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.companyId) params.set("companyId", query.companyId);
  if (query.plantId) params.set("plantId", query.plantId);
  if (query.warehouseId) params.set("warehouseId", query.warehouseId);
  if (query.departmentId) params.set("departmentId", query.departmentId);
  if (query.productId) params.set("productId", query.productId);
  if (query.materialId) params.set("materialId", query.materialId);
  if (query.customerId) params.set("customerId", query.customerId);
  if (query.supplierId) params.set("supplierId", query.supplierId);
  if (query.formulaId) params.set("formulaId", query.formulaId);
  if (query.productType) params.set("productType", query.productType);
  if (query.materialType) params.set("materialType", query.materialType);
  if (query.dosageForm) params.set("dosageForm", query.dosageForm);
  if (query.uom) params.set("uom", query.uom);
  if (query.vendorId) params.set("vendorId", query.vendorId);
  if (query.customerType) params.set("customerType", query.customerType);
  if (query.vendorType) params.set("vendorType", query.vendorType);
  if (query.qualificationStatus) params.set("qualificationStatus", query.qualificationStatus);
  if (query.riskCategory) params.set("riskCategory", query.riskCategory);
  if (query.country) params.set("country", query.country);
  if (query.search) params.set("search", query.search);
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.cursor) params.set("cursor", query.cursor);
  return params.toString();
}

export async function listMasterRecords(entity: MasterEntity, query: MasterListQuery = {}) {
  const qs = queryString(query);
  return masterFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/masters/${entity}${qs ? `?${qs}` : ""}`
  );
}

export async function getMasterRecord(entity: MasterEntity, id: string) {
  return masterFetch<{ record: Record<string, unknown> & { id: string } }>(
    `/api/masters/${entity}/${id}`
  );
}

export async function createMasterRecord(
  entity: MasterEntity,
  payload: Record<string, unknown>,
  reason?: string
) {
  return masterFetch<{ record: Record<string, unknown> & { id: string } }>(
    `/api/masters/${entity}`,
    { method: "POST", body: JSON.stringify({ ...payload, reason }) }
  );
}

export async function updateMasterRecord(
  entity: MasterEntity,
  id: string,
  payload: Record<string, unknown>,
  reason?: string
) {
  return masterFetch<{ record: Record<string, unknown> & { id: string } }>(
    `/api/masters/${entity}/${id}`,
    { method: "PATCH", body: JSON.stringify({ ...payload, reason }) }
  );
}

export async function setMasterRecordStatus(
  entity: MasterEntity,
  id: string,
  status: MasterStatus | string,
  reason?: string
) {
  return masterFetch<{ record: Record<string, unknown> & { id: string } }>(
    `/api/masters/${entity}/${id}/status`,
    { method: "POST", body: JSON.stringify({ status, reason }) }
  );
}

export async function issueDocumentNumber(documentType: string, financialYear?: string) {
  return masterFetch<{ documentNumber: string; currentNumber: number; documentType: string }>(
    "/api/document-numbers/next",
    { method: "POST", body: JSON.stringify({ documentType, financialYear }) }
  );
}

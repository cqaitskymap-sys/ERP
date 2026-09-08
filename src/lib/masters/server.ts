import { parseForm } from "@/lib/validation/schemas";
import { hasPermission } from "@/lib/permissions/permission-service";
import { writeAuditLog } from "@/lib/auth/firestore-rest";
import { createNamedError } from "@/lib/masters/errors";
import { ensureDocumentNumberSeries, nextDocumentNumber } from "@/lib/masters/numbering";
import {
  canTransitionPartner,
  partnerTransitionAction,
  permissionForPartnerTransition,
} from "@/lib/partners/status";
import {
  queryMasterDocuments,
  readMasterDocument,
  sanitizeMasterRecord,
  writeMasterDocument,
} from "@/lib/masters/firestore";
import { auditModuleFor, isUsableForNewTransactions } from "@/lib/masters/permissions";
import { getMasterDefinition } from "@/lib/masters/registry";
import type { MasterEntity, MasterListQuery } from "@/types/masters";
import type { SessionPayload } from "@/types/auth";

const SEARCH_END = "\uf8ff";

function searchIndex(code: string, name: string) {
  return `${code} ${name}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function nameIndex(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueKey(scopeValue: string, code: string) {
  return `${scopeValue}__${code}`.toUpperCase();
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function buildMasterRecord(
  entity: MasterEntity,
  payload: Record<string, unknown>,
  session: SessionPayload,
  existing?: Record<string, unknown>
) {
  const definition = getMasterDefinition(entity);
  if (!definition) throw createNamedError("ValidationError", "Unknown master.");

  const now = new Date().toISOString();
  const cleanExisting = existing ? sanitizeMasterRecord(existing) : undefined;
  const id =
    entity === "currencies"
      ? normalizeCode(payload.currencyCode ?? cleanExisting?.currencyCode)
      : String(cleanExisting?.[definition.idField] || cleanExisting?.id || crypto.randomUUID());
  const code = normalizeCode(
    payload[definition.codeField] ?? cleanExisting?.[definition.codeField]
  );
  const name = String(
    payload[definition.nameField] ?? cleanExisting?.[definition.nameField] ?? code
  );
  const scopeValue = definition.uniqueScope
    ? String(payload[definition.uniqueScope] ?? cleanExisting?.[definition.uniqueScope] ?? "")
    : "";

  const record: Record<string, unknown> = {
    ...cleanExisting,
    ...payload,
    [definition.idField]: id,
    [definition.codeField]:
      definition.codeField === "name" ? String(payload.name ?? cleanExisting?.name ?? "") : code,
    searchIndex: searchIndex(code || name, name),
    nameIndex: nameIndex(name),
    createdBy: String(cleanExisting?.createdBy || session.uid),
    createdAt: String(cleanExisting?.createdAt || now),
    updatedBy: session.uid,
    updatedAt: now,
  };

  if (definition.uniqueScope) {
    record.uniqueKey = uniqueKey(scopeValue, code);
  }

  if (entity === "currencies") {
    record.currencyCode = id;
  }
  if (entity === "uomConversions") {
    record.uniqueKey = `${payload.fromUomId}__${payload.toUomId}`.toUpperCase();
    record.searchIndex = String(record.uniqueKey).toLowerCase();
    record.nameIndex = record.searchIndex;
  }
  if (entity === "documentNumbering") {
    const year = String(payload.financialYear || cleanExisting?.financialYear || "");
    record.uniqueKey = `${normalizeCode(payload.documentType)}__${year}`;
    record.currentNumber = Number(
      cleanExisting?.currentNumber ??
        Math.max(0, Number(payload.startingNumber || 1) - 1)
    );
    record.documentType = normalizeCode(payload.documentType);
  }
  if (entity === "approvalWorkflows" && Array.isArray(payload.steps)) {
    record.steps = payload.steps;
  }
  if (entity === "materialSpecifications" && Array.isArray(payload.testParameters)) {
    record.testParameters = payload.testParameters;
  }
  if (entity === "products") {
    record.searchIndex = searchIndex(
      code,
      `${name} ${payload.genericName || cleanExisting?.genericName || ""} ${payload.brandName || cleanExisting?.brandName || ""}`
    );
  }
  if (entity === "materials") {
    record.searchIndex = searchIndex(
      code,
      `${name} ${payload.genericName || cleanExisting?.genericName || ""} ${payload.chemicalName || cleanExisting?.chemicalName || ""}`
    );
  }
  if (entity === "productCustomerMappings") {
    record.uniqueKey = uniqueKey(String(payload.customerId), String(payload.customerProductCode));
  }
  if (entity === "materialSupplierMappings") {
    record.uniqueKey = uniqueKey(String(payload.materialId), String(payload.supplierId));
  }
  if (entity === "productFormulaLines") {
    record.uniqueKey = uniqueKey(String(payload.formulaId), String(payload.materialId));
  }
  if (entity === "materialSpecifications") {
    record.uniqueKey = uniqueKey(
      String(payload.materialId),
      `${payload.specificationNumber}__${payload.specificationVersion}`
    );
  }
  if (entity === "vendorMaterials") {
    record.uniqueKey = uniqueKey(String(payload.vendorId), String(payload.materialId));
  }
  if (entity === "customers" || entity === "vendors") {
    record.searchIndex = searchIndex(
      code,
      `${name} ${payload.primaryContactName || cleanExisting?.primaryContactName || ""} ${payload.country || cleanExisting?.country || ""} ${payload.primaryContactEmail || ""}`
    );
  }
  if (entity === "customerContacts" || entity === "customerAddresses") {
    record.parentType = "customer";
    record.parentId = payload.customerId || cleanExisting?.customerId;
    record.customerId = record.parentId;
  }
  if (entity === "vendorContacts" || entity === "vendorAddresses") {
    record.parentType = "vendor";
    record.parentId = payload.vendorId || cleanExisting?.vendorId;
    record.vendorId = record.parentId;
  }

  return { id: String(record[definition.idField]), record: sanitizeMasterRecord(record) };
}

export async function assertUnique(
  entity: MasterEntity,
  record: Record<string, unknown>,
  idToken: string,
  currentId?: string
) {
  const definition = getMasterDefinition(entity);
  if (!definition) throw createNamedError("ValidationError", "Unknown master.");

  const filters = definition.uniqueScope || entity === "uomConversions"
    ? [{ field: "uniqueKey", value: String(record.uniqueKey) }]
    : [{ field: definition.codeField, value: String(record[definition.codeField]) }];

  const matches = await queryMasterDocuments(definition.collection, idToken, {
    filters,
    limit: 5,
  });
  const conflict = matches.find((item) => item.id !== currentId);
  if (conflict) {
    throw createNamedError(
      "DuplicateError",
      `A ${definition.title} with this code already exists.`
    );
  }
}

const PARENT_CHECKS: Partial<
  Record<MasterEntity, Array<{ field: string; collection: string; label: string }>>
> = {
  plants: [{ field: "companyId", collection: "companies", label: "company" }],
  departments: [{ field: "plantId", collection: "plants", label: "plant" }],
  areas: [{ field: "plantId", collection: "plants", label: "plant" }],
  warehouses: [{ field: "plantId", collection: "plants", label: "plant" }],
  storageLocations: [{ field: "warehouseId", collection: "warehouses", label: "warehouse" }],
  productVersions: [{ field: "productId", collection: "products", label: "product" }],
  productCustomerMappings: [
    { field: "productId", collection: "products", label: "product" },
    { field: "customerId", collection: "customers", label: "customer" },
  ],
  productPackaging: [{ field: "productId", collection: "products", label: "product" }],
  productStorageConfigurations: [{ field: "productId", collection: "products", label: "product" }],
  productRegulatoryInformation: [{ field: "productId", collection: "products", label: "product" }],
  materialSupplierMappings: [
    { field: "materialId", collection: "materials", label: "material" },
    { field: "supplierId", collection: "suppliers", label: "supplier" },
  ],
  materialSpecifications: [{ field: "materialId", collection: "materials", label: "material" }],
  materialStorageConfigurations: [{ field: "materialId", collection: "materials", label: "material" }],
  productMaterials: [
    { field: "productId", collection: "products", label: "product" },
    { field: "materialId", collection: "materials", label: "material" },
  ],
  productFormulas: [{ field: "productId", collection: "products", label: "product" }],
  productFormulaLines: [
    { field: "formulaId", collection: "productFormulas", label: "formula" },
    { field: "materialId", collection: "materials", label: "material" },
  ],
  customerContacts: [{ field: "customerId", collection: "customers", label: "customer" }],
  customerAddresses: [{ field: "customerId", collection: "customers", label: "customer" }],
  customerQualifications: [{ field: "customerId", collection: "customers", label: "customer" }],
  customerDocuments: [{ field: "customerId", collection: "customers", label: "customer" }],
  customerContracts: [{ field: "customerId", collection: "customers", label: "customer" }],
  vendorContacts: [{ field: "vendorId", collection: "vendors", label: "vendor" }],
  vendorAddresses: [{ field: "vendorId", collection: "vendors", label: "vendor" }],
  vendorQualifications: [{ field: "vendorId", collection: "vendors", label: "vendor" }],
  vendorDocuments: [{ field: "vendorId", collection: "vendors", label: "vendor" }],
  vendorContracts: [{ field: "vendorId", collection: "vendors", label: "vendor" }],
  vendorMaterials: [
    { field: "vendorId", collection: "vendors", label: "vendor" },
    { field: "materialId", collection: "materials", label: "material" },
  ],
  vendorPerformance: [{ field: "vendorId", collection: "vendors", label: "vendor" }],
};

export async function assertParentActive(
  entity: MasterEntity,
  payload: Record<string, unknown>,
  idToken: string
) {
  const checks = (PARENT_CHECKS[entity] ?? []).map((item) => ({
    collection: item.collection,
    id: payload[item.field] ? String(payload[item.field]) : undefined,
    label: item.label,
  }));

  for (const check of checks) {
    if (!check.id) continue;
    const parent = await readMasterDocument(check.collection, check.id, idToken);
    if (!parent) {
      throw createNamedError("ValidationError", `The selected ${check.label} was not found.`);
    }
    if (!isUsableForNewTransactions(parent.status)) {
      throw createNamedError(
        "ValidationError",
        `Inactive or discontinued ${check.label}s cannot be selected in new records.`
      );
    }
  }
}

export async function assertFinancialYearRules(
  payload: Record<string, unknown>,
  idToken: string,
  currentId?: string
) {
  const rows = await queryMasterDocuments("financialYears", idToken, { limit: 200 });
  const start = String(payload.startDate);
  const end = String(payload.endDate);

  const overlap = rows.some((row) => {
    if (row.id === currentId) return false;
    if (row.status === "inactive") return false;
    return start <= String(row.endDate) && end >= String(row.startDate);
  });
  if (overlap) {
    throw createNamedError("ValidationError", "Financial year dates cannot overlap.");
  }
}

export async function listMasters(
  entity: MasterEntity,
  query: MasterListQuery,
  idToken: string
) {
  const definition = getMasterDefinition(entity);
  if (!definition) throw createNamedError("ValidationError", "Unknown master.");

  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 5), 200);
  const filters = [];
  if (query.status && query.status !== "all") {
    filters.push({ field: "status", value: query.status });
  }
  if (query.companyId) filters.push({ field: "companyId", value: query.companyId });
  if (query.plantId) filters.push({ field: "plantId", value: query.plantId });
  if (query.warehouseId) filters.push({ field: "warehouseId", value: query.warehouseId });
  if (query.departmentId) filters.push({ field: "departmentId", value: query.departmentId });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.materialId && entity !== "vendors") {
    filters.push({ field: "materialId", value: query.materialId });
  }
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.supplierId && entity !== "materials") {
    filters.push({ field: "supplierId", value: query.supplierId });
  }
  if (query.formulaId) filters.push({ field: "formulaId", value: query.formulaId });
  if (query.productType) filters.push({ field: "productType", value: query.productType });
  if (query.materialType) filters.push({ field: "materialType", value: query.materialType });
  if (query.dosageForm) filters.push({ field: "dosageForm", value: query.dosageForm });
  if (query.uom) filters.push({ field: "uom", value: query.uom });
  if (query.vendorId) filters.push({ field: "vendorId", value: query.vendorId });
  if (query.customerType) filters.push({ field: "customerType", value: query.customerType });
  if (query.vendorType) filters.push({ field: "vendorType", value: query.vendorType });
  if (query.qualificationStatus) {
    filters.push({ field: "qualificationStatus", value: query.qualificationStatus });
  }
  if (query.riskCategory) filters.push({ field: "riskCategory", value: query.riskCategory });
  if (query.country) filters.push({ field: "country", value: query.country });

  const vendorMaterialIds =
    entity === "vendors" && query.materialId
      ? new Set(
          (
            await queryMasterDocuments("vendorMaterials", idToken, {
              filters: [{ field: "materialId", value: query.materialId }],
              limit: 200,
            })
          ).map((row) => String(row.vendorId))
        )
      : null;

  const supplierMaterialIds =
    entity === "materials" && query.supplierId
      ? new Set(
          (
            await queryMasterDocuments("materialSupplierMappings", idToken, {
              filters: [{ field: "supplierId", value: query.supplierId }],
              limit: 200,
            })
          ).map((row) => String(row.materialId))
        )
      : null;

  const search = query.search?.trim().toLowerCase();
  const cursorValues = query.cursor ? decodeCursor(query.cursor) : undefined;

  if (search) {
    const [byCode, byName] = await Promise.all([
      queryMasterDocuments(definition.collection, idToken, {
        filters: [
          ...filters,
          { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
          { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
        ],
        orderBy: [{ field: "searchIndex" }],
        startAfter: cursorValues,
        limit: pageSize + 1,
      }),
      queryMasterDocuments(definition.collection, idToken, {
        filters: [
          ...filters,
          { field: "nameIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
          { field: "nameIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
        ],
        orderBy: [{ field: "nameIndex" }],
        startAfter: cursorValues,
        limit: pageSize + 1,
      }),
    ]);

    const merged = new Map<string, Record<string, unknown>>();
    for (const row of [...byCode, ...byName]) {
      if (supplierMaterialIds && !supplierMaterialIds.has(String(row.id))) continue;
      if (vendorMaterialIds && !vendorMaterialIds.has(String(row.id))) continue;
      merged.set(String(row.id), row);
    }
    const rows = Array.from(merged.values()).slice(0, pageSize + 1);
    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const last = page[page.length - 1];
    return {
      rows: page,
      nextCursor: hasMore && last ? encodeCursor([String(last.searchIndex ?? last.nameIndex ?? "")]) : null,
    };
  }

  const fetched = await queryMasterDocuments(definition.collection, idToken, {
    filters,
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    startAfter: cursorValues,
    limit: supplierMaterialIds || vendorMaterialIds ? 200 : pageSize + 1,
  });
  const rows = fetched.filter((row) => {
    if (supplierMaterialIds && !supplierMaterialIds.has(String(row.id))) return false;
    if (vendorMaterialIds && !vendorMaterialIds.has(String(row.id))) return false;
    return true;
  });
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor([String(last.updatedAt ?? "")]) : null,
  };
}

function encodeCursor(values: Array<string | number | boolean>) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return Array.isArray(parsed) ? (parsed as Array<string | number | boolean>) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveMaster(options: {
  entity: MasterEntity;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
  reason?: string;
}) {
  const definition = getMasterDefinition(options.entity);
  if (!definition) throw createNamedError("ValidationError", "Unknown master.");

  const parsed = parseForm(definition.schema, options.payload);
  if (!parsed.data) {
    throw createNamedError(
      "ValidationError",
      Object.values(parsed.errors)[0] || "Please correct the highlighted fields."
    );
  }

  const existing = options.id
    ? await readMasterDocument(definition.collection, options.id, options.idToken)
    : null;

  if (existing?.status === "closed" && options.entity === "financialYears") {
    if (!hasPermission(options.session.permissions, "masters:approve")) {
      throw createNamedError(
        "ForbiddenError",
        "Closed financial years cannot be edited without authorized permission."
      );
    }
  }

  const { id, record } = buildMasterRecord(
    options.entity,
    parsed.data as Record<string, unknown>,
    options.session,
    existing ?? undefined
  );

  await applyPartnerCodes({
    entity: options.entity,
    record,
    existing,
    session: options.session,
    idToken: options.idToken,
  });

  await assertUnique(options.entity, record, options.idToken, options.id);
  if (!options.id) {
    await assertParentActive(options.entity, record, options.idToken);
  }
  if (options.entity === "financialYears") {
    await assertFinancialYearRules(record, options.idToken, options.id);
    if (record.isCurrent) {
      const years = await queryMasterDocuments("financialYears", options.idToken, {
        filters: [{ field: "isCurrent", value: true }],
        limit: 20,
      });
      const now = new Date().toISOString();
      await Promise.all(
        years
          .filter((year) => year.id !== id)
          .map((year) =>
            writeMasterDocument(
              "financialYears",
              year.id,
              {
                ...sanitizeMasterRecord(year),
                isCurrent: false,
                updatedBy: options.session.uid,
                updatedAt: now,
              },
              options.idToken
            )
          )
      );
    }
  }

  if (
    options.entity === "productCustomerMappings" &&
    record.effectiveTo &&
    String(record.effectiveTo) < new Date().toISOString().slice(0, 10)
  ) {
    record.status = "expired";
  }

  await writeMasterDocument(definition.collection, id, record, options.idToken);
  await syncPartnerSideEffects({
    entity: options.entity,
    id,
    record,
    existing,
    session: options.session,
    idToken: options.idToken,
  });

  if (options.entity === "products" && !options.id) {
    const versionId = crypto.randomUUID();
    const version = {
      productVersionId: versionId,
      productId: id,
      versionNumber: "1",
      changeReason: "Initial product version.",
      status: "draft",
      uniqueKey: uniqueKey(id, "1"),
      searchIndex: searchIndex("1", String(record.productName || record.productCode)),
      nameIndex: nameIndex("1"),
      createdBy: options.session.uid,
      createdAt: nowIso(),
      updatedBy: options.session.uid,
      updatedAt: nowIso(),
    };
    await writeMasterDocument("productVersions", versionId, version, options.idToken);
  }

  await writeAuditLog(options.idToken, {
    actorId: options.session.uid,
    actorEmail: options.session.email,
    action: options.id ? "UPDATE" : "CREATE",
    module: auditModuleFor(options.entity),
    resource: options.entity,
    resourceId: id,
    description: `${options.id ? "Updated" : "Created"} ${definition.title}.`,
    severity: "notice",
    oldData: existing ? sanitizeMasterRecord(existing) : undefined,
    newData: record,
    reason: options.reason,
    createdAt: nowIso(),
  });

  if (
    existing &&
    (options.entity === "customers" || options.entity === "vendors") &&
    String(existing.riskCategory || "") !== String(record.riskCategory || "")
  ) {
    await writeAuditLog(options.idToken, {
      actorId: options.session.uid,
      actorEmail: options.session.email,
      action: "RISK_CHANGED",
      module: auditModuleFor(options.entity),
      resource: options.entity,
      resourceId: id,
      description: `Risk category changed to ${String(record.riskCategory || "unset")}.`,
      severity: "warning",
      oldData: { riskCategory: existing.riskCategory },
      newData: { riskCategory: record.riskCategory },
      reason: options.reason,
      createdAt: nowIso(),
    });
  }

  return { id, ...record };
}

export async function setMasterStatus(options: {
  entity: MasterEntity;
  id: string;
  status: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  const definition = getMasterDefinition(options.entity);
  if (!definition) throw createNamedError("ValidationError", "Unknown master.");
  const existing = await readMasterDocument(
    definition.collection,
    options.id,
    options.idToken
  );
  if (!existing) throw createNamedError("ValidationError", "Record not found.");

  if (existing.status === "closed" && options.entity === "financialYears") {
    if (!hasPermission(options.session.permissions, "masters:approve")) {
      throw createNamedError(
        "ForbiddenError",
        "Closed financial years cannot be edited without authorized permission."
      );
    }
  }

  if (
    options.status === "approved" &&
    ["productVersions", "productFormulas", "materialSpecifications"].includes(options.entity)
  ) {
    if (!hasPermission(options.session.permissions, `${auditModuleFor(options.entity)}:approve`)) {
      throw createNamedError(
        "ForbiddenError",
        "Approving this record requires authorized permission."
      );
    }
  }

  if (options.entity === "customers" || options.entity === "vendors") {
    if (!canTransitionPartner(String(existing.status || "draft"), options.status)) {
      throw createNamedError(
        "ValidationError",
        `Cannot change status from ${String(existing.status || "draft")} to ${options.status}.`
      );
    }
    const needed = permissionForPartnerTransition(options.entity, options.status);
    if (!hasPermission(options.session.permissions, needed)) {
      throw createNamedError("ForbiddenError", "This status change requires additional permission.");
    }
    if (
      (options.status === "rejected" || options.status === "suspended") &&
      !String(options.reason || "").trim()
    ) {
      throw createNamedError("ValidationError", "A reason is required for this status change.");
    }
  }

  const next = {
    ...sanitizeMasterRecord(existing),
    status: options.status,
    updatedBy: options.session.uid,
    updatedAt: nowIso(),
    ...(options.status === "approved" || options.status === "active"
      ? { approvedBy: options.session.uid, approvedAt: nowIso() }
      : {}),
  };
  await writeMasterDocument(definition.collection, options.id, next, options.idToken);
  if (options.entity === "vendors") {
    await syncSupplierShadow(options.id, next, options.session, options.idToken);
  }
  await writeAuditLog(options.idToken, {
    actorId: options.session.uid,
    actorEmail: options.session.email,
    action:
      options.entity === "customers" || options.entity === "vendors"
        ? partnerTransitionAction(options.status)
        : options.status === "active"
          ? "ACTIVATE"
          : options.status === "approved"
            ? "APPROVE"
            : options.status === "closed"
              ? "CONFIGURE"
              : "DEACTIVATE",
    module: auditModuleFor(options.entity),
    resource: options.entity,
    resourceId: options.id,
    description: `Changed ${definition.title} status to ${options.status}.`,
    severity: "warning",
    oldData: sanitizeMasterRecord(existing),
    newData: next,
    reason: options.reason,
    createdAt: nowIso(),
  });
  return { id: options.id, ...next };
}

async function applyPartnerCodes(options: {
  entity: MasterEntity;
  record: Record<string, unknown>;
  existing: Record<string, unknown> | null;
  session: import("@/types/auth").SessionPayload;
  idToken: string;
}) {
  if (options.entity !== "customers" && options.entity !== "vendors") return;
  const codeField = options.entity === "customers" ? "customerCode" : "vendorCode";
  const permissionModule = options.entity;
  const existingCode = String(options.existing?.[codeField] || "");
  const requested = String(options.record[codeField] || "").trim();

  if (existingCode) {
    const canOverride = hasPermission(options.session.permissions, `${permissionModule}:approve`);
    if (requested && requested !== existingCode && !canOverride) {
      options.record[codeField] = existingCode;
    } else if (!requested) {
      options.record[codeField] = existingCode;
    }
    return;
  }

  if (requested && hasPermission(options.session.permissions, `${permissionModule}:approve`)) {
    options.record[codeField] = requested.toUpperCase();
    return;
  }

  const documentType = options.entity === "customers" ? "CUS" : "VEN";
  const year = String(new Date().getFullYear());
  try {
    await ensureDocumentNumberSeries({
      documentType,
      prefix: documentType,
      financialYear: year,
      session: options.session,
      idToken: options.idToken,
    });
  } catch {
    // Series creation requires master-admin write. Issuing still works if the series exists.
  }
  const issued = await nextDocumentNumber({
    documentType,
    financialYear: year,
    session: options.session,
    idToken: options.idToken,
  });
  options.record[codeField] = issued.documentNumber;
  options.record.searchIndex = searchIndex(
    issued.documentNumber,
    `${options.record[options.entity === "customers" ? "customerName" : "vendorName"] || ""} ${options.record.primaryContactName || ""} ${options.record.country || ""}`
  );
}

async function syncPartnerSideEffects(options: {
  entity: MasterEntity;
  id: string;
  record: Record<string, unknown>;
  existing: Record<string, unknown> | null;
  session: import("@/types/auth").SessionPayload;
  idToken: string;
}) {
  if (options.entity === "vendors") {
    await syncSupplierShadow(options.id, options.record, options.session, options.idToken);
  }
  if (options.entity === "vendorMaterials") {
    await syncMaterialSupplierMapping(options.record, options.session, options.idToken);
  }
  if (options.entity === "customerQualifications") {
    const status = String(options.record.qualificationStatus || "");
    if (["qualified", "conditionally_qualified", "rejected", "expired"].includes(status)) {
      await updateParentQualification(
        "customers",
        String(options.record.customerId),
        status,
        options.session,
        options.idToken,
        status === "qualified" || status === "conditionally_qualified"
      );
    }
  }
  if (options.entity === "vendorQualifications") {
    const status = String(options.record.approvalStatus || "");
    if (["qualified", "conditionally_qualified", "rejected", "expired", "suspended"].includes(status)) {
      await updateParentQualification(
        "vendors",
        String(options.record.vendorId),
        status,
        options.session,
        options.idToken,
        status === "qualified" || status === "conditionally_qualified"
      );
    }
  }
}

async function syncSupplierShadow(
  vendorId: string,
  vendor: Record<string, unknown>,
  session: import("@/types/auth").SessionPayload,
  idToken: string
) {
  const usable = ["active", "approved"].includes(String(vendor.status));
  await writeMasterDocument(
    "suppliers",
    vendorId,
    {
      supplierId: vendorId,
      supplierCode: vendor.vendorCode,
      supplierName: vendor.vendorName,
      country: vendor.country || "",
      status: usable ? "active" : "inactive",
      searchIndex: searchIndex(String(vendor.vendorCode || ""), String(vendor.vendorName || "")),
      nameIndex: nameIndex(String(vendor.vendorName || "")),
      createdBy: session.uid,
      createdAt: nowIso(),
      updatedBy: session.uid,
      updatedAt: nowIso(),
    },
    idToken
  );
}

async function syncMaterialSupplierMapping(
  record: Record<string, unknown>,
  session: import("@/types/auth").SessionPayload,
  idToken: string
) {
  const vendorId = String(record.vendorId);
  const materialId = String(record.materialId);
  const mappingId = uniqueKey(materialId, vendorId).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const role = String(record.supplierRole || "approved");
  await writeMasterDocument(
    "materialSupplierMappings",
    mappingId,
    {
      supplierMaterialId: mappingId,
      supplierId: vendorId,
      materialId,
      supplierMaterialCode: record.supplierMaterialCode || "",
      manufacturerName: record.manufacturerName || "",
      manufacturerCode: record.manufacturerCode || "",
      supplierRole: role === "preferred" ? "preferred" : role === "alternate" ? "alternate" : "approved",
      approvedSupplier: Boolean(record.approvedSupplier) || role === "approved" || role === "preferred",
      supplierPriority: Number(record.supplierPriority || 1),
      leadTimeDays: record.leadTimeDays || "",
      moq: record.minimumOrderQuantity || "",
      status: record.status === "blocked" ? "inactive" : record.status || "active",
      uniqueKey: uniqueKey(materialId, vendorId),
      searchIndex: searchIndex(String(record.supplierMaterialCode || materialId), String(record.manufacturerName || "")),
      nameIndex: nameIndex(String(record.manufacturerName || materialId)),
      createdBy: session.uid,
      createdAt: nowIso(),
      updatedBy: session.uid,
      updatedAt: nowIso(),
    },
    idToken
  );
}

async function updateParentQualification(
  collection: "customers" | "vendors",
  parentId: string,
  qualificationStatus: string,
  session: import("@/types/auth").SessionPayload,
  idToken: string,
  approved: boolean
) {
  const existing = await readMasterDocument(collection, parentId, idToken);
  if (!existing) return;
  await writeMasterDocument(
    collection,
    parentId,
    {
      ...sanitizeMasterRecord(existing),
      qualificationStatus,
      updatedBy: session.uid,
      updatedAt: nowIso(),
      ...(approved ? { approvedBy: session.uid, approvedAt: nowIso() } : {}),
    },
    idToken
  );
}

function nowIso() {
  return new Date().toISOString();
}

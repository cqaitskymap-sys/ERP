import { SQ_COLLECTIONS } from "@/lib/supplier-quality/collections";
import { listByField, text } from "@/lib/supplier-quality/helpers";
import { calculateExpiryStatus, calculateSupplierPerformance } from "@/lib/supplier-quality/scoring";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { SQ_REPORT_TYPES } from "@/types/supplier-quality";

const SEARCH_END = "\uf8ff";

export interface SqListQuery {
  status?: string;
  riskLevel?: string;
  supplierId?: string;
  materialId?: string;
  qualificationId?: string;
  auditId?: string;
  pageSize?: number;
  cursor?: string;
  search?: string;
}

function encodeCursor(values: Array<string | number>) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Array<string | number>;
  } catch {
    return undefined;
  }
}

function paginate(rows: MasterRecord[], pageSize: number, cursorOf: (row: MasterRecord) => Array<string | number>) {
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  return { rows: page, nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null };
}

export async function listSqRecords(collection: string, query: SqListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.riskLevel) filters.push({ field: "riskLevel", value: query.riskLevel });
  if (query.supplierId) filters.push({ field: "supplierId", value: query.supplierId });
  if (query.materialId) filters.push({ field: "materialId", value: query.materialId });
  if (query.qualificationId) filters.push({ field: "qualificationId", value: query.qualificationId });
  if (query.auditId) filters.push({ field: "auditId", value: query.auditId });
  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  const rows = search
    ? await queryMasterDocuments(collection, idToken, {
        filters: [
          ...filters,
          { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
          { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
        ],
        orderBy: [{ field: "searchIndex" }],
        startAfter: cursorValues,
        limit: pageSize + 1,
      })
    : await queryMasterDocuments(collection, idToken, {
        filters,
        orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
        startAfter: cursorValues,
        limit: pageSize + 1,
      });
  return paginate(rows, pageSize, (row) => [String(search ? row.searchIndex || "" : row.updatedAt || "")]);
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

export async function loadSqDashboard(idToken: string) {
  const [profiles, qualifications, audits, findings, certificates, capas, deviations, evaluations] = await Promise.all([
    queryMasterDocuments(SQ_COLLECTIONS.profiles, idToken, { limit: 200 }),
    queryMasterDocuments(SQ_COLLECTIONS.qualifications, idToken, { limit: 120 }),
    queryMasterDocuments(SQ_COLLECTIONS.audits, idToken, { limit: 80 }),
    queryMasterDocuments(SQ_COLLECTIONS.findings, idToken, { limit: 80 }),
    queryMasterDocuments(SQ_COLLECTIONS.certificates, idToken, { limit: 80 }),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "sourceType", value: "supplier_issue" }], limit: 80 }).catch(() => []),
    queryMasterDocuments("qaDeviations", idToken, { filters: [{ field: "source", value: "supplier" }], limit: 80 }).catch(() => []),
    queryMasterDocuments(SQ_COLLECTIONS.evaluations, idToken, { limit: 80 }),
  ]);
  const byRisk: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const scoreTrend: Record<string, number> = {};
  const qualTrend: Record<string, number> = {};
  const findingTrend: Record<string, number> = {};
  const capaTrend: Record<string, number> = {};
  const deviationTrend: Record<string, number> = {};
  for (const row of profiles) {
    increment(byRisk, text(row.riskLevel || "unassigned"));
    increment(byStatus, text(row.status || "unknown"));
  }
  for (const row of qualifications) increment(qualTrend, text(row.initiationDate || row.createdAt).slice(0, 7) || "unknown");
  for (const row of findings) increment(findingTrend, text(row.severity || "unclassified"));
  for (const row of capas) increment(capaTrend, text(row.createdAt).slice(0, 7) || "unknown");
  for (const row of deviations) increment(deviationTrend, text(row.createdAt).slice(0, 7) || "unknown");
  for (const row of evaluations) increment(scoreTrend, text(row.evaluationDate || row.createdAt).slice(0, 7) || "unknown");
  const expiringDocs = certificates.filter((row) => calculateExpiryStatus(row.expiryDate).status === "expiring_soon").length;
  const expiredCerts = certificates.filter((row) => calculateExpiryStatus(row.expiryDate).status === "expired").length;
  return {
    kpis: {
      totalSuppliers: profiles.length,
      qualifiedSuppliers: profiles.filter((row) => ["approved", "conditional_approval"].includes(text(row.status))).length,
      pendingQualification: qualifications.filter((row) => !["approved", "conditional", "rejected", "expired"].includes(text(row.status))).length,
      qualificationExpiring: qualifications.filter((row) => calculateExpiryStatus(row.expiryDate || row.targetDate).status === "expiring_soon").length,
      requalificationDue: profiles.filter((row) => text(row.status) === "expired").length,
      highRiskSuppliers: profiles.filter((row) => text(row.riskLevel) === "high").length,
      criticalSuppliers: profiles.filter((row) => text(row.riskLevel) === "critical").length,
      suspendedSuppliers: profiles.filter((row) => text(row.status) === "suspended").length,
      disqualifiedSuppliers: profiles.filter((row) => text(row.status) === "disqualified").length,
      openSupplierCapa: capas.filter((row) => text(row.status) !== "closed").length,
      openSupplierDeviations: deviations.filter((row) => text(row.status) !== "closed").length,
      openSupplierAudits: audits.filter((row) => text(row.status) !== "closed").length,
      expiringDocuments: expiringDocs,
      expiringCertificates: expiredCerts + expiringDocs,
    },
    charts: { byRisk, byStatus, scoreTrend, qualTrend, findingTrend, capaTrend, deviationTrend },
  };
}

export async function loadProfileDetail(id: string, idToken: string) {
  const record = await readMasterDocument(SQ_COLLECTIONS.profiles, id, idToken);
  if (!record) return null;
  const supplierId = text(record.supplierId);
  const vendor = supplierId ? await readMasterDocument("vendors", supplierId, idToken) : null;
  const [risks, qualifications, documents, questionnaires, evaluations, materials, audits, certificates, agreements, changes, suspensions, requals, communications, capas, deviations, mappings] = await Promise.all([
    listByField(SQ_COLLECTIONS.risks, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.qualifications, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.documents, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.questionnaires, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.evaluations, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.materials, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.audits, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.certificates, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.agreements, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.changes, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.suspensions, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.requalifications, "supplierId", supplierId, idToken),
    listByField(SQ_COLLECTIONS.communications, "supplierId", supplierId, idToken),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "sourceId", value: supplierId }], limit: 10 }).catch(() => []),
    queryMasterDocuments("qaDeviations", idToken, { filters: [{ field: "supplierId", value: supplierId }], limit: 10 }).catch(() => []),
    queryMasterDocuments("vendorMaterials", idToken, { filters: [{ field: "vendorId", value: supplierId }], limit: 20 }).catch(() => []),
  ]);
  return {
    record,
    extra: {
      vendor,
      risks,
      qualifications,
      documents,
      questionnaires,
      evaluations,
      materials,
      audits,
      certificates,
      agreements,
      changes,
      suspensions,
      requals,
      communications,
      capas,
      deviations,
      mappings,
    },
  };
}

export async function loadAuditDetail(id: string, idToken: string) {
  const record = await readMasterDocument(SQ_COLLECTIONS.audits, id, idToken);
  if (!record) return null;
  const findings = await listByField(SQ_COLLECTIONS.findings, "auditId", id, idToken);
  return { record, extra: { findings } };
}

export async function loadSqCalendar(idToken: string) {
  const [quals, audits, certs, agreements, requals] = await Promise.all([
    queryMasterDocuments(SQ_COLLECTIONS.qualifications, idToken, { limit: 80 }),
    queryMasterDocuments(SQ_COLLECTIONS.audits, idToken, { limit: 80 }),
    queryMasterDocuments(SQ_COLLECTIONS.certificates, idToken, { limit: 80 }),
    queryMasterDocuments(SQ_COLLECTIONS.agreements, idToken, { limit: 80 }),
    queryMasterDocuments(SQ_COLLECTIONS.requalifications, idToken, { limit: 80 }),
  ]);
  const events = [
    ...quals.map((row) => ({ date: text(row.targetDate || row.expiryDate), title: `Qualification ${row.qualificationNumber}`, type: "qualification" })),
    ...audits.map((row) => ({ date: text(row.plannedDate), title: `Audit ${row.auditNumber}`, type: "audit" })),
    ...certs.map((row) => ({ date: text(row.expiryDate), title: `Certificate ${row.certificateType}`, type: "certificate" })),
    ...agreements.map((row) => ({ date: text(row.expiryDate), title: `Agreement ${row.agreementNumber}`, type: "agreement" })),
    ...requals.map((row) => ({ date: text(row.dueDate), title: `Requalification ${row.requalificationNumber}`, type: "requalification" })),
  ].filter((item) => item.date);
  return { record: { view: "list" }, extra: { events } };
}

export async function loadMaterialRiskView(supplierId: string, materialId: string, idToken: string) {
  const [material, quals, oos, oot, deviations, capas] = await Promise.all([
    readMasterDocument("materials", materialId, idToken),
    queryMasterDocuments(SQ_COLLECTIONS.materials, idToken, { filters: [{ field: "supplierId", value: supplierId }, { field: "materialId", value: materialId }], limit: 5 }),
    queryMasterDocuments("qcOOS", idToken, { filters: [{ field: "materialId", value: materialId }], limit: 10 }).catch(() => []),
    queryMasterDocuments("qcOOT", idToken, { filters: [{ field: "materialId", value: materialId }], limit: 10 }).catch(() => []),
    queryMasterDocuments("qaDeviations", idToken, { filters: [{ field: "supplierId", value: supplierId }], limit: 10 }).catch(() => []),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "sourceId", value: supplierId }], limit: 10 }).catch(() => []),
  ]);
  return {
    record: material || { id: materialId, materialId },
    extra: {
      qualifications: quals,
      oos,
      oot,
      deviations,
      capas,
      performance: calculateSupplierPerformance({ oos: oos.length, oot: oot.length, deviations: deviations.length, capas: capas.length }),
    },
  };
}

export async function loadSqReport(type: (typeof SQ_REPORT_TYPES)[number], query: SqListQuery, idToken: string) {
  const collection =
    type === "audit" || type === "finding" ? (type === "finding" ? SQ_COLLECTIONS.findings : SQ_COLLECTIONS.audits)
      : type === "qualification" || type === "approved_list" ? (type === "approved_list" ? SQ_COLLECTIONS.materials : SQ_COLLECTIONS.qualifications)
        : type === "evaluation" || type === "scorecard" || type === "performance" ? SQ_COLLECTIONS.evaluations
          : type === "certificate_expiry" ? SQ_COLLECTIONS.certificates
            : type === "agreement_expiry" ? SQ_COLLECTIONS.agreements
              : type === "requalification" ? SQ_COLLECTIONS.requalifications
                : type === "suspension" || type === "disqualification" ? SQ_COLLECTIONS.suspensions
                  : type === "change" ? SQ_COLLECTIONS.changes
                    : type === "risk" ? SQ_COLLECTIONS.risks
                      : SQ_COLLECTIONS.profiles;
  if (type === "approved_list") {
    return listMatchingSqRecords(collection, query, idToken, (row) =>
      ["qualified", "conditional"].includes(text(row.qualificationStatus))
    );
  }
  if (type === "certificate_expiry" || type === "agreement_expiry") {
    return listMatchingSqRecords(collection, query, idToken, (row) =>
      calculateExpiryStatus(row.expiryDate).status !== "valid"
    );
  }
  if (type === "disqualification") {
    return listMatchingSqRecords(collection, query, idToken, (row) => text(row.status) === "disqualified");
  }
  return listSqRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken);
}

async function listMatchingSqRecords(
  collection: string,
  query: SqListQuery,
  idToken: string,
  predicate: (row: MasterRecord) => boolean
) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 100);
  const search = query.search?.trim();
  const matches: MasterRecord[] = [];
  let cursor = query.cursor;
  let resume: string | null = null;
  let exhausted = false;

  for (let hop = 0; hop < 12 && matches.length <= pageSize; hop += 1) {
    const result = await listSqRecords(collection, { ...query, pageSize: 100, cursor }, idToken);
    if (result.rows.length === 0) {
      exhausted = true;
      break;
    }
    for (const row of result.rows) {
      if (!predicate(row)) continue;
      matches.push(row);
      if (matches.length > pageSize) break;
    }
    if (matches.length > pageSize) break;
    if (!result.nextCursor) {
      exhausted = true;
      break;
    }
    cursor = result.nextCursor;
    resume = result.nextCursor;
  }

  if (matches.length > pageSize) {
    const last = matches[pageSize - 1];
    const cursorValue = search ? String(last.searchIndex || "") : String(last.updatedAt || "");
    return { rows: matches.slice(0, pageSize), nextCursor: encodeCursor([cursorValue]) };
  }
  return { rows: matches, nextCursor: exhausted ? null : resume };
}

import { QA_COLLECTIONS } from "@/lib/qa/collections";
import { listByField, text } from "@/lib/qa/helpers";
import { loadBatchDossier } from "@/lib/qa/server";
import { validateBatchForRelease } from "@/lib/qa/release-validation";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { QA_REPORT_TYPES } from "@/types/qa";

const SEARCH_END = "\uf8ff";

export interface QaListQuery {
  status?: string;
  productId?: string;
  customerId?: string;
  batchNumber?: string;
  ownerId?: string;
  severity?: string;
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

export async function listQaRecords(collection: string, query: QaListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  if (query.ownerId) filters.push({ field: "ownerId", value: query.ownerId });
  if (query.severity) filters.push({ field: "severity", value: query.severity });
  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  if (search) {
    const rows = await queryMasterDocuments(collection, idToken, {
      filters: [
        ...filters,
        { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
        { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
      ],
      orderBy: [{ field: "searchIndex" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
    return paginate(rows, pageSize, (row) => [String(row.searchIndex || "")]);
  }
  const rows = await queryMasterDocuments(collection, idToken, {
    filters,
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    startAfter: cursorValues,
    limit: pageSize + 1,
  });
  return paginate(rows, pageSize, (row) => [String(row.updatedAt || "")]);
}

export async function loadQaDashboard(idToken: string) {
  const [reviews, deviations, capas, changes, documents, oos, oot] = await Promise.all([
    queryMasterDocuments(QA_COLLECTIONS.reviews, idToken, { limit: 200 }),
    queryMasterDocuments(QA_COLLECTIONS.deviations, idToken, { limit: 100 }),
    queryMasterDocuments(QA_COLLECTIONS.capas, idToken, { limit: 100 }),
    queryMasterDocuments(QA_COLLECTIONS.changes, idToken, { limit: 100 }),
    queryMasterDocuments(QA_COLLECTIONS.documents, idToken, { limit: 100 }),
    queryMasterDocuments("qcOOS", idToken, { limit: 80 }),
    queryMasterDocuments("qcOOT", idToken, { limit: 80 }),
  ]);
  const tats: number[] = [];
  const byDecision: Record<string, number> = {};
  const releaseTrend: Record<string, number> = {};
  const rejectTrend: Record<string, number> = {};
  const deviationTrend: Record<string, number> = {};
  const capaStatus: Record<string, number> = {};
  const changeStatus: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  for (const row of reviews) {
    byDecision[text(row.status)] = (byDecision[text(row.status)] || 0) + 1;
    if (row.customerId) byCustomer[text(row.customerId)] = (byCustomer[text(row.customerId)] || 0) + 1;
    if (row.startedAt && row.decidedAt) {
      const hours = (new Date(String(row.decidedAt)).getTime() - new Date(String(row.startedAt)).getTime()) / 36e5;
      if (Number.isFinite(hours) && hours >= 0) tats.push(hours);
    }
    const month = text(row.decidedAt || row.createdAt).slice(0, 7) || "unknown";
    if (text(row.status) === "released") releaseTrend[month] = (releaseTrend[month] || 0) + 1;
    if (text(row.status) === "rejected") rejectTrend[month] = (rejectTrend[month] || 0) + 1;
  }
  for (const row of deviations) {
    const month = text(row.createdAt).slice(0, 7) || "unknown";
    deviationTrend[month] = (deviationTrend[month] || 0) + 1;
  }
  for (const row of capas) capaStatus[text(row.status)] = (capaStatus[text(row.status)] || 0) + 1;
  for (const row of changes) changeStatus[text(row.status)] = (changeStatus[text(row.status)] || 0) + 1;
  const today = new Date().toISOString().slice(0, 10);
  return {
    kpis: {
      pendingQa: reviews.filter((row) => ["pending_review", "under_review", "decision_pending"].includes(text(row.status))).length,
      underReview: reviews.filter((row) => text(row.status) === "under_review").length,
      released: reviews.filter((row) => text(row.status) === "released").length,
      held: reviews.filter((row) => text(row.status) === "held").length,
      rejected: reviews.filter((row) => text(row.status) === "rejected").length,
      openDeviations: deviations.filter((row) => text(row.status) !== "closed").length,
      openCapa: capas.filter((row) => !["closed"].includes(text(row.status))).length,
      pendingChanges: changes.filter((row) => !["closed", "rejected"].includes(text(row.status))).length,
      oosPending: oos.filter((row) => text(row.status) !== "closed").length,
      ootPending: oot.filter((row) => text(row.status) !== "closed").length,
      expiringDocuments: documents.filter((row) => text(row.expiryDate) && text(row.expiryDate) <= today).length,
      averageTatHours: tats.length ? Math.round((tats.reduce((sum, value) => sum + value, 0) / tats.length) * 10) / 10 : 0,
      minTatHours: tats.length ? Math.round(Math.min(...tats) * 10) / 10 : 0,
      maxTatHours: tats.length ? Math.round(Math.max(...tats) * 10) / 10 : 0,
    },
    charts: { byDecision, releaseTrend, rejectTrend, deviationTrend, capaStatus, changeStatus, byCustomer },
    queue: reviews
      .filter((row) => !["released", "rejected", "closed"].includes(text(row.status)))
      .map((row) => {
        const due = text(row.dueDate);
        const overdue = Boolean(due && due < today);
        let priority = text(row.priority) || "normal";
        if (priority !== "critical" && overdue) priority = "overdue";
        const rank = priority === "critical" ? 0 : priority === "urgent" ? 1 : priority === "overdue" ? 2 : 3;
        return {
          id: String(row.id),
          reviewNumber: text(row.reviewNumber),
          batchNumber: text(row.batchNumber),
          productId: text(row.productId),
          customerId: text(row.customerId),
          status: text(row.status),
          dueDate: due,
          qcCompletedAt: text(row.qcCompletedAt),
          priority,
          rank,
        };
      })
      .sort((left, right) => left.rank - right.rank || text(left.dueDate).localeCompare(text(right.dueDate)))
      .slice(0, 30),
  };
}

export async function loadQaReviewDetail(id: string, idToken: string) {
  const record = await readMasterDocument(QA_COLLECTIONS.reviews, id, idToken);
  if (!record) return null;
  const [items, documents, certificates] = await Promise.all([
    listByField(QA_COLLECTIONS.reviewItems, "reviewId", id, idToken),
    listByField(QA_COLLECTIONS.documents, "sourceRecordId", id, idToken),
    listByField(QA_COLLECTIONS.certificates, "reviewId", id, idToken),
  ]);
  const dossier = await loadBatchDossier({
    manufacturingOrderId: text(record.manufacturingOrderId),
    batchNumber: text(record.batchNumber),
    idToken,
  });
  const validation = validateBatchForRelease({
    order: dossier.order,
    bmr: dossier.bmr,
    reconciliations: dossier.reconciliations,
    ipc: dossier.ipc,
    tests: dossier.tests,
    oos: dossier.oos,
    oot: dossier.oot,
    deviations: [...dossier.productionDeviations, ...dossier.deviations],
    checklist: items,
    documents,
    coas: dossier.coas,
  });
  return { record, extra: { items, documents, certificates, dossier, validation } };
}

export async function loadQaReport(type: (typeof QA_REPORT_TYPES)[number], query: QaListQuery, idToken: string) {
  const collection =
    type === "batch_hold"
      ? QA_COLLECTIONS.holds
      : type === "batch_rejection"
        ? QA_COLLECTIONS.rejections
        : type === "deviation"
          ? QA_COLLECTIONS.deviations
          : type === "capa"
            ? QA_COLLECTIONS.capas
            : type === "change_control"
              ? QA_COLLECTIONS.changes
              : type === "expiring_document"
                ? QA_COLLECTIONS.documents
                : type === "oos_review"
                  ? "qcOOS"
                  : type === "oot_review"
                    ? "qcOOT"
                    : type === "customer_release" || type === "batch_release"
                      ? QA_COLLECTIONS.certificates
                      : QA_COLLECTIONS.reviews;
  return listQaRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken);
}

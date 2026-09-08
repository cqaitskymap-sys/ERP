import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { PV_COLLECTIONS } from "@/lib/pv/collections";
import { daysUntilUtc } from "@/lib/pv/due-date";
import { listByField, redactCaseForList, text } from "@/lib/pv/helpers";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { PV_REPORT_TYPES } from "@/types/pv";

const SEARCH_END = "\uf8ff";

export interface PvListQuery {
  status?: string;
  priority?: string;
  seriousness?: string;
  productId?: string;
  customerId?: string;
  marketId?: string;
  country?: string;
  batchNumber?: string;
  assignedTo?: string;
  ownerId?: string;
  caseId?: string;
  eventTerm?: string;
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

export async function listPvRecords(collection: string, query: PvListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.priority) filters.push({ field: "priority", value: query.priority });
  if (query.seriousness) filters.push({ field: "seriousnessFlag", value: query.seriousness });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.marketId) filters.push({ field: "marketId", value: query.marketId });
  if (query.country) filters.push({ field: "country", value: query.country });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  if (query.assignedTo) filters.push({ field: "assignedTo", value: query.assignedTo });
  if (query.ownerId) filters.push({ field: "ownerId", value: query.ownerId });
  if (query.caseId) filters.push({ field: "caseId", value: query.caseId });
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
  const safe = collection === PV_COLLECTIONS.cases || collection === PV_COLLECTIONS.intakes
    ? rows.map((row) => ({ ...redactCaseForList(row), id: row.id, _updateTime: row._updateTime }))
    : rows;
  return paginate(safe, pageSize, (row) => [String(search ? row.searchIndex || "" : row.updatedAt || "")]);
}

export async function loadPvDashboard(idToken: string) {
  const [intakes, cases, followups, reports, signals, commitments] = await Promise.all([
    queryMasterDocuments(PV_COLLECTIONS.intakes, idToken, { limit: 120 }),
    queryMasterDocuments(PV_COLLECTIONS.cases, idToken, { limit: 200 }),
    queryMasterDocuments(PV_COLLECTIONS.followups, idToken, { limit: 120 }),
    queryMasterDocuments(PV_COLLECTIONS.reports, idToken, { limit: 80 }),
    queryMasterDocuments(PV_COLLECTIONS.signals, idToken, { limit: 80 }),
    queryMasterDocuments(PV_COLLECTIONS.commitments, idToken, { limit: 80 }),
  ]);
  const now = new Date();
  const byMonth: Record<string, number> = {};
  const bySeriousness: Record<string, number> = {};
  const byProduct: Record<string, number> = {};
  const byMarket: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  const followUpStatus: Record<string, number> = {};
  const reportStatus: Record<string, number> = {};
  const signalTrend: Record<string, number> = {};
  const tats: number[] = [];
  for (const row of cases) {
    const month = text(row.initialReceiptDate || row.createdAt).slice(0, 7) || "unknown";
    byMonth[month] = (byMonth[month] || 0) + 1;
    bySeriousness[text(row.seriousnessFlag || "unassessed")] = (bySeriousness[text(row.seriousnessFlag || "unassessed")] || 0) + 1;
    if (row.productId) byProduct[text(row.productId)] = (byProduct[text(row.productId)] || 0) + 1;
    if (row.marketId) byMarket[text(row.marketId)] = (byMarket[text(row.marketId)] || 0) + 1;
    bySource[text(row.sourceType || "other")] = (bySource[text(row.sourceType || "other")] || 0) + 1;
    if (row.eventTerm) byEvent[text(row.eventTerm)] = (byEvent[text(row.eventTerm)] || 0) + 1;
    if (row.initialReceiptDate && row.closureDate) {
      const hours = (new Date(String(row.closureDate)).getTime() - new Date(String(row.initialReceiptDate)).getTime()) / 36e5;
      if (Number.isFinite(hours) && hours >= 0) tats.push(hours);
    }
  }
  for (const row of followups) followUpStatus[text(row.status)] = (followUpStatus[text(row.status)] || 0) + 1;
  for (const row of reports) reportStatus[text(row.status)] = (reportStatus[text(row.status)] || 0) + 1;
  for (const row of signals) {
    const month = text(row.detectedDate || row.createdAt).slice(0, 7) || "unknown";
    signalTrend[month] = (signalTrend[month] || 0) + 1;
  }
  return {
    kpis: {
      newSafetyCases: cases.filter((row) => text(row.status) === "new").length,
      casesUnderTriage: cases.filter((row) => text(row.status) === "triage").length,
      casesUnderReview: cases.filter((row) => ["medical_review", "regulatory_review"].includes(text(row.status))).length,
      seriousCases: cases.filter((row) => text(row.seriousnessFlag) === "serious").length,
      criticalCases: cases.filter((row) => text(row.priority) === "critical").length,
      followUpsPending: followups.filter((row) => ["requested", "pending", "received", "under_review"].includes(text(row.status))).length,
      overdueFollowUps: followups.filter((row) => text(row.status) === "overdue" || ((daysUntilUtc(row.dueDate, now) ?? 1) < 0 && !["closed", "cancelled"].includes(text(row.status)))).length,
      regulatoryReportsPending: reports.filter((row) => !["submitted", "acknowledged", "closed", "not_required"].includes(text(row.status))).length,
      reportsSubmitted: reports.filter((row) => ["submitted", "acknowledged"].includes(text(row.status))).length,
      openSignals: signals.filter((row) => text(row.status) !== "closed").length,
      openCommitments: commitments.filter((row) => !["completed", "cancelled"].includes(text(row.status))).length,
      newIntakes: intakes.filter((row) => ["received", "triage_pending"].includes(text(row.status))).length,
      averageTatHours: tats.length ? Math.round((tats.reduce((sum, value) => sum + value, 0) / tats.length) * 10) / 10 : 0,
      minTatHours: tats.length ? Math.round(Math.min(...tats) * 10) / 10 : 0,
      maxTatHours: tats.length ? Math.round(Math.max(...tats) * 10) / 10 : 0,
    },
    charts: { byMonth, bySeriousness, byProduct, byMarket, bySource, byEvent, followUpStatus, reportStatus, signalTrend },
  };
}

export async function loadCaseDetail(id: string, idToken: string, includeSensitive: boolean) {
  const record = await readMasterDocument(PV_COLLECTIONS.cases, id, idToken);
  if (!record) return null;
  const productId = text(record.productId);
  const batchNumber = text(record.batchNumber);
  const [patients, reporters, products, events, seriousness, expectedness, causality, reviews, followups, reports, signals, batches, orders, qaReviews, capas, changes, registrations, communications] = await Promise.all([
    listByField(PV_COLLECTIONS.patients, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.reporters, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.products, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.events, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.seriousness, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.expectedness, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.causality, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.reviews, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.followups, "caseId", id, idToken),
    listByField(PV_COLLECTIONS.reports, "caseId", id, idToken),
    productId ? queryMasterDocuments(PV_COLLECTIONS.signals, idToken, { filters: [{ field: "productId", value: productId }], limit: 8 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments(INVENTORY_COLLECTIONS.batches, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("manufacturingOrders", idToken, { filters: [{ field: "productId", value: productId }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments("qaBatchReviews", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "sourceId", value: id }], limit: 5 }).catch(() => []),
    record.changeControlId ? queryMasterDocuments("qaChangeControls", idToken, { filters: [{ field: "id", value: text(record.changeControlId) }], limit: 3 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("regulatoryRegistrations", idToken, { filters: [{ field: "productId", value: productId }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("regulatoryCommunications", idToken, { filters: [{ field: "productId", value: productId }], limit: 5 }).catch(() => []) : Promise.resolve([]),
  ]);
  const timeline = [
    ...products.map((row) => ({ date: text(row.therapyStartDate), label: `Product exposure · ${row.productName || row.productId}`, type: "exposure" })),
    ...events.map((row) => ({ date: text(row.onsetDate), label: `Event onset · ${row.eventTerm}`, type: "onset" })),
    ...events.filter((row) => row.actionTaken).map((row) => ({ date: text(row.onsetDate), label: `Treatment · ${row.actionTaken}`, type: "treatment" })),
    ...followups.map((row) => ({ date: text(row.requestDate), label: `Follow-up · ${row.followUpNumber}`, type: "followup" })),
    ...events.filter((row) => row.endDate || row.outcome).map((row) => ({ date: text(row.endDate || row.updatedAt), label: `Outcome · ${row.outcome}`, type: "outcome" })),
  ].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date));
  return {
    record: includeSensitive ? record : redactCaseForList(record),
    extra: {
      patients: includeSensitive ? patients : [],
      reporters: includeSensitive ? reporters : [],
      products,
      events,
      seriousness,
      expectedness,
      causality,
      reviews,
      followups,
      reports,
      signals,
      batches,
      batchFound: batches.length > 0,
      orders,
      qaReviews,
      capas,
      changes,
      registrations,
      communications,
      timeline,
    },
  };
}

export async function loadProductSafety(productId: string, idToken: string) {
  const product = await readMasterDocument("products", productId, idToken);
  const [cases, signals, reports, commitments] = await Promise.all([
    queryMasterDocuments(PV_COLLECTIONS.cases, idToken, { filters: [{ field: "productId", value: productId }], limit: 50 }),
    queryMasterDocuments(PV_COLLECTIONS.signals, idToken, { filters: [{ field: "productId", value: productId }], limit: 20 }),
    queryMasterDocuments(PV_COLLECTIONS.reports, idToken, { filters: [{ field: "productId", value: productId }], limit: 20 }),
    queryMasterDocuments(PV_COLLECTIONS.commitments, idToken, { limit: 20 }),
  ]);
  return {
    record: product || { id: productId, productId },
    extra: {
      cases: cases.map((row) => redactCaseForList(row)),
      signals,
      reports,
      commitments,
      seriousCases: cases.filter((row) => text(row.seriousnessFlag) === "serious").length,
    },
  };
}

export async function loadPvReport(type: (typeof PV_REPORT_TYPES)[number], query: PvListQuery, idToken: string) {
  const collection =
    type === "intake" ? PV_COLLECTIONS.intakes
      : type === "followup" || type === "overdue_followup" ? PV_COLLECTIONS.followups
        : type === "regulatory_reporting" ? PV_COLLECTIONS.reports
          : type === "signal" ? PV_COLLECTIONS.signals
            : type === "commitment" ? PV_COLLECTIONS.commitments
              : PV_COLLECTIONS.cases;
  const result = await listPvRecords(
    collection,
    { ...query, pageSize: query.pageSize || 50, status: type === "overdue_followup" ? "overdue" : query.status },
    idToken
  );
  if (type === "serious_case") {
    return { rows: result.rows.filter((row) => text(row.seriousnessFlag) === "serious"), nextCursor: result.nextCursor };
  }
  return result;
}

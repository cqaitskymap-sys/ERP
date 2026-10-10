import { DMS_COLLECTIONS } from "@/lib/dms/collections";
import { DMS_RESOURCES, type DmsResource } from "@/lib/dms/http";
import { describeReview, loadDmsSettings } from "@/lib/dms/server";
import { text } from "@/lib/dms/helpers";
import { expiryState } from "@/lib/dms/lifecycle";
import { HR_COLLECTIONS } from "@/lib/hr/collections";
import { queryMasterDocuments, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

const SEARCH_END = "\uf8ff";

export interface DmsListQuery {
  status?: string;
  documentType?: string;
  departmentId?: string;
  ownerId?: string;
  siteId?: string;
  classification?: string;
  review?: string;
  search?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  cursor?: string;
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

export async function listDmsRecords(
  resource: DmsResource,
  query: DmsListQuery,
  idToken: string,
  _session: SessionPayload
) {
  const collection = DMS_RESOURCES[resource].collection;
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.documentType) filters.push({ field: "documentType", value: query.documentType });
  if (query.departmentId) filters.push({ field: "departmentId", value: query.departmentId });
  if (query.ownerId) filters.push({ field: "ownerId", value: query.ownerId });
  if (query.siteId) filters.push({ field: "siteId", value: query.siteId });
  if (query.classification) filters.push({ field: "confidentiality", value: query.classification });

  const search = query.search?.trim().toLowerCase();
  const memoryFilters = Boolean(query.review || query.from || query.to || filters.length > 1 || search);
  const primary = !search && filters[0] ? [filters[0]] : [];

  let rows = await queryMasterDocuments(collection, idToken, {
    filters: search
      ? [
          { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
          { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
        ]
      : primary,
    orderBy: search ? [{ field: "searchIndex" }] : [{ field: "updatedAt", direction: "DESCENDING" }],
    startAfter: memoryFilters ? undefined : decodeCursor(query.cursor),
    limit: memoryFilters ? 300 : pageSize + 1,
  });

  if (search || filters.length > 1) {
    rows = rows.filter((row) =>
      filters.every((filter) => text(row[filter.field]) === text(filter.value))
    );
  }
  if (query.review) {
    const settings = await loadDmsSettings(idToken);
    rows = rows.filter((row) => {
      const state = describeReview(row, Number(settings.reviewSoonDays || 30));
      if (query.review === "due") return state === "due" || state === "due_soon" || state === "overdue";
      return state === query.review;
    });
  }
  if (query.from || query.to) {
    rows = rows.filter((row) => {
      const date = text(row.effectiveDate || row.expiryDate || row.createdAt).slice(0, 10);
      if (query.from && date < query.from) return false;
      if (query.to && date > query.to) return false;
      return true;
    });
  }

  return paginate(rows, pageSize, (row) => (search ? [String(row.searchIndex || "")] : [String(row.updatedAt || "")]));
}

export async function loadDmsDashboard(idToken: string, query: DmsListQuery = {}) {
  const settings = await loadDmsSettings(idToken);
  const [documents, changeRequests, externalDocuments, periodicReviews] = await Promise.all([
    queryMasterDocuments(DMS_COLLECTIONS.documents, idToken, { limit: 500 }).catch(() => []),
    queryMasterDocuments(DMS_COLLECTIONS.changeRequests, idToken, { limit: 300 }).catch(() => []),
    queryMasterDocuments(DMS_COLLECTIONS.externalDocuments, idToken, { limit: 300 }).catch(() => []),
    queryMasterDocuments(DMS_COLLECTIONS.periodicReviews, idToken, { limit: 200 }).catch(() => []),
  ]);
  const scoped = documents.filter((row) => {
    if (query.siteId && text(row.siteId) !== query.siteId) return false;
    if (query.departmentId && text(row.departmentId) !== query.departmentId) return false;
    if (query.documentType && text(row.documentType) !== query.documentType) return false;
    if (query.ownerId && text(row.ownerId) !== query.ownerId) return false;
    const created = text(row.createdAt).slice(0, 10);
    if (query.from && created && created < query.from) return false;
    if (query.to && created && created > query.to) return false;
    return true;
  });
  const soon = Number(settings.reviewSoonDays || 30);
  const expirySoon = Number(settings.expirySoonDays || 30);
  const today = new Date().toISOString().slice(0, 10);
  const reviewState = (row: MasterRecord) => describeReview(row, soon);
  let trainingPending: number | null = null;
  try {
    const assignments = await queryMasterDocuments(HR_COLLECTIONS.trainingAssignments, idToken, { limit: 300 });
    trainingPending = assignments.filter(
      (row) => text(row.sopDocumentId) && !["completed", "cancelled"].includes(text(row.status))
    ).length;
  } catch {
    trainingPending = null;
  }

  return {
    kpis: {
      controlledDocuments: scoped.length,
      draftsAwaitingReview: scoped.filter((row) => text(row.status) === "draft" || text(row.status) === "changes_requested").length,
      pendingApprovals: scoped.filter((row) => text(row.status) === "in_review").length,
      approvedNotEffective: scoped.filter((row) => text(row.status) === "approved").length,
      effectiveDocuments: scoped.filter((row) => text(row.status) === "effective").length,
      supersededDocuments: scoped.filter((row) => text(row.status) === "superseded").length,
      reviewsDue: scoped.filter((row) => ["due", "due_soon"].includes(reviewState(row))).length,
      reviewsOverdue: scoped.filter((row) => reviewState(row) === "overdue").length,
      externalExpiring: externalDocuments.filter((row) =>
        ["due", "due_soon", "overdue"].includes(expiryState(text(row.expiryDate), today, expirySoon))
      ).length,
      changesAwaitingImplementation: changeRequests.filter((row) =>
        ["approved", "in_implementation", "submitted", "in_review"].includes(text(row.status))
      ).length,
      trainingImpact: scoped.filter((row) => text(row.trainingImpactStatus) === "retraining_required").length,
      trainingPending,
    },
    periodicReviews: periodicReviews.length,
    notes: {
      search: "Registry search matches the start of the document number, title, or department stored in searchIndex. It is not unrestricted full-text search.",
      training: trainingPending === null
        ? "Pending LMS assignments could not be read with this account. Retraining flags on documents are still shown."
        : "Pending training counts come from LMS assignments linked to an SOP version. Opening a file does not complete them.",
      signatures: "Critical signatures require the authenticated account email to be re-entered. This is not a validated 21 CFR Part 11 certification.",
    },
  };
}

export async function loadDmsReport(type: string, query: DmsListQuery, idToken: string, session: SessionPayload) {
  if (type === "registry" || type === "reviews_due" || type === "training_impact" || type === "pending_approvals") {
    const list = await listDmsRecords(
      "documents",
      {
        ...query,
        status: type === "pending_approvals" ? "in_review" : query.status,
        review: type === "reviews_due" ? "due" : query.review,
        pageSize: 200,
      },
      idToken,
      session
    );
    let rows = list.rows;
    if (type === "training_impact") rows = rows.filter((row) => text(row.trainingImpactStatus));
    return {
      rows: rows.map(publicDocumentRow),
      nextCursor: list.nextCursor,
      meta: { source: DMS_COLLECTIONS.documents },
    };
  }
  if (type === "expiring_external") {
    const list = await listDmsRecords("externalDocuments", { ...query, pageSize: 200 }, idToken, session);
    return { rows: list.rows, nextCursor: list.nextCursor, meta: { source: DMS_COLLECTIONS.externalDocuments } };
  }
  if (type === "change_requests") {
    const list = await listDmsRecords("changeRequests", { ...query, pageSize: 200 }, idToken, session);
    return { rows: list.rows, nextCursor: list.nextCursor, meta: { source: DMS_COLLECTIONS.changeRequests } };
  }
  return { rows: [], nextCursor: null, meta: { source: "unsupported" } };
}

function publicDocumentRow(row: MasterRecord) {
  return {
    documentNumber: row.documentNumber,
    title: row.title,
    documentType: row.documentType,
    status: row.status,
    currentVersionLabel: row.currentVersionLabel,
    effectiveVersionLabel: row.effectiveVersionLabel,
    departmentId: row.departmentId,
    ownerId: row.ownerId,
    nextReviewDate: row.nextReviewDate,
    effectiveDate: row.effectiveDate,
    confidentiality: row.confidentiality,
    trainingImpactStatus: row.trainingImpactStatus,
  };
}

export async function loadPendingDmsWork(idToken: string) {
  const [reviews, requests] = await Promise.all([
    queryMasterDocuments(DMS_COLLECTIONS.documents, idToken, {
      filters: [{ field: "status", value: "in_review" }],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      limit: 50,
    }).catch(() => []),
    queryMasterDocuments(DMS_COLLECTIONS.changeRequests, idToken, {
      filters: [{ field: "status", value: "in_review" }],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      limit: 50,
    }).catch(() => []),
  ]);
  return {
    rows: [
      ...reviews.map((row) => ({ ...row, queue: "document" })),
      ...requests.map((row) => ({ ...row, queue: "change_request" })),
    ],
  };
}

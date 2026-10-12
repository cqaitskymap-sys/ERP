import { ARTWORK_COLLECTIONS } from "@/lib/artwork/collections";
import { queryMasterDocuments, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";

const SEARCH_END = "\uf8ff";
const REVIEW = new Set(["packaging_review", "qa_review", "regulatory_review", "customer_review"]);
const CLOSED = new Set(["effective", "obsolete"]);

export interface ArtworkListQuery {
  status?: string;
  search?: string;
  pageSize?: number;
  cursor?: string;
  requestId?: string;
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

export async function listArtworkRecords(collection: string, query: ArtworkListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 25), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.requestId) filters.push({ field: "requestId", value: query.requestId });
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

function dueSoon(value: unknown, horizon: string) {
  const due = String(value || "");
  return Boolean(due) && due <= horizon;
}

export async function loadArtworkDashboard(idToken: string) {
  const rows = await queryMasterDocuments(ARTWORK_COLLECTIONS.requests, idToken, {
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 50,
  });
  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const open = rows.filter((row) => !CLOSED.has(String(row.status)));
  return {
    kpis: {
      open: open.length,
      inReview: rows.filter((row) => REVIEW.has(String(row.status))).length,
      withCustomer: rows.filter((row) => row.status === "customer_review").length,
      changes: rows.filter((row) => row.status === "changes_requested").length,
      effective: rows.filter((row) => row.status === "effective").length,
      dueSoon: open.filter((row) => dueSoon(row.dueDate, horizon)).length,
    },
    queue: rows.slice(0, 6),
  };
}

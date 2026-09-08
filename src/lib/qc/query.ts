import { QC_COLLECTIONS } from "@/lib/qc/collections";
import { listByField, text } from "@/lib/qc/helpers";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { QC_REPORT_TYPES } from "@/types/qc";

const SEARCH_END = "\uf8ff";

export interface QcListQuery {
  status?: string;
  productId?: string;
  materialId?: string;
  customerId?: string;
  vendorId?: string;
  batchNumber?: string;
  sampleId?: string;
  analystId?: string;
  testRequestId?: string;
  search?: string;
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

export async function listQcRecords(collection: string, query: QcListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.materialId) filters.push({ field: "materialId", value: query.materialId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.vendorId) filters.push({ field: "vendorId", value: query.vendorId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  if (query.sampleId) filters.push({ field: "sampleId", value: query.sampleId });
  if (query.analystId) filters.push({ field: "analystId", value: query.analystId });
  if (query.testRequestId) filters.push({ field: "testRequestId", value: query.testRequestId });
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

export async function loadQcDashboard(idToken: string) {
  const [samples, tests, oos, oot, retests, coas] = await Promise.all([
    queryMasterDocuments(QC_COLLECTIONS.samples, idToken, { limit: 200 }),
    queryMasterDocuments(QC_COLLECTIONS.tests, idToken, { limit: 300 }),
    queryMasterDocuments(QC_COLLECTIONS.oos, idToken, { limit: 100 }),
    queryMasterDocuments(QC_COLLECTIONS.oot, idToken, { limit: 100 }),
    queryMasterDocuments(QC_COLLECTIONS.retests, idToken, { limit: 50 }),
    queryMasterDocuments(QC_COLLECTIONS.coas, idToken, { limit: 100 }),
  ]);
  const byStatus: Record<string, number> = {};
  const byMaterial: Record<string, number> = {};
  const byProduct: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  const byAnalyst: Record<string, number> = {};
  let pass = 0;
  let fail = 0;
  const tats: number[] = [];
  for (const test of tests) {
    byStatus[text(test.status)] = (byStatus[text(test.status)] || 0) + 1;
    if (test.materialId) byMaterial[text(test.materialId)] = (byMaterial[text(test.materialId)] || 0) + 1;
    if (test.productId) byProduct[text(test.productId)] = (byProduct[text(test.productId)] || 0) + 1;
    if (test.customerId) byCustomer[text(test.customerId)] = (byCustomer[text(test.customerId)] || 0) + 1;
    if (test.analystId) byAnalyst[text(test.analystId)] = (byAnalyst[text(test.analystId)] || 0) + 1;
    if (text(test.overallResult) === "pass") pass += 1;
    if (text(test.overallResult) === "fail") fail += 1;
    if (test.startedAt && test.submittedAt) {
      const hours = (new Date(String(test.submittedAt)).getTime() - new Date(String(test.startedAt)).getTime()) / 36e5;
      if (Number.isFinite(hours) && hours >= 0) tats.push(hours);
    }
  }
  const oosTrend: Record<string, number> = {};
  for (const row of oos) {
    const month = text(row.reportedAt || row.createdAt).slice(0, 7) || "unknown";
    oosTrend[month] = (oosTrend[month] || 0) + 1;
  }
  return {
    kpis: {
      samplesPending: samples.filter((row) => ["planned", "sampled", "in_transit"].includes(text(row.status))).length,
      samplesReceived: samples.filter((row) => text(row.status) === "received").length,
      testsPending: tests.filter((row) => ["draft", "requested", "assigned"].includes(text(row.status))).length,
      testsInProgress: tests.filter((row) => text(row.status) === "in_testing").length,
      testsCompleted: tests.filter((row) => text(row.status) === "completed").length,
      oosOpen: oos.filter((row) => text(row.status) !== "closed").length,
      ootOpen: oot.filter((row) => text(row.status) !== "closed").length,
      retestsPending: retests.length,
      coaPending: coas.filter((row) => text(row.status) !== "approved").length,
      reviewPending: tests.filter((row) => text(row.status) === "review_pending").length,
      averageTatHours: tats.length ? Math.round((tats.reduce((sum, value) => sum + value, 0) / tats.length) * 10) / 10 : 0,
      minTatHours: tats.length ? Math.round(Math.min(...tats) * 10) / 10 : 0,
      maxTatHours: tats.length ? Math.round(Math.max(...tats) * 10) / 10 : 0,
    },
    charts: { byStatus, passFail: { pass, fail }, oosTrend, byMaterial, byProduct, byCustomer, byAnalyst },
  };
}

export async function loadTestWorkbench(id: string, idToken: string) {
  const test = await readMasterDocument(QC_COLLECTIONS.tests, id, idToken);
  if (!test) return null;
  const [request, sample, specItems, results, assignments, methods] = await Promise.all([
    readMasterDocument(QC_COLLECTIONS.testRequests, text(test.testRequestId), idToken),
    readMasterDocument(QC_COLLECTIONS.samples, text(test.sampleId), idToken),
    test.specificationId ? listByField(QC_COLLECTIONS.specificationItems, "specificationId", text(test.specificationId), idToken) : Promise.resolve([]),
    listByField(QC_COLLECTIONS.results, "testId", id, idToken),
    listByField(QC_COLLECTIONS.assignments, "testRequestId", text(test.testRequestId), idToken),
    queryMasterDocuments(QC_COLLECTIONS.methods, idToken, { limit: 50 }),
  ]);
  return { record: test, extra: { request, sample, specItems, results, assignments, methods } };
}

export async function loadQcReport(type: (typeof QC_REPORT_TYPES)[number], query: QcListQuery, idToken: string) {
  const collection =
    type === "sample_register"
      ? QC_COLLECTIONS.samples
      : type === "oos"
        ? QC_COLLECTIONS.oos
        : type === "oot"
          ? QC_COLLECTIONS.oot
          : type === "retest"
            ? QC_COLLECTIONS.retests
            : type === "coa_register"
              ? QC_COLLECTIONS.coas
              : type === "stability"
                ? QC_COLLECTIONS.stability
                : type === "instrument_usage"
                  ? QC_COLLECTIONS.instruments
                  : type === "test_result"
                    ? QC_COLLECTIONS.results
                    : QC_COLLECTIONS.tests;
  return listQcRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken);
}

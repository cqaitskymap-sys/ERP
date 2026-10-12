import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { COMPLAINT_COLLECTIONS } from "@/lib/complaints/collections";
import { listByField, text } from "@/lib/complaints/helpers";
import { calculateComplaintTAT, daysUntilUtc, summarizeTats } from "@/lib/complaints/sla";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { COMPLAINT_REPORT_TYPES } from "@/types/complaints";

const SEARCH_END = "\uf8ff";

export interface ComplaintListQuery {
  status?: string;
  severity?: string;
  productId?: string;
  customerId?: string;
  batchNumber?: string;
  marketId?: string;
  assignedTo?: string;
  category?: string;
  complaintId?: string;
  investigationId?: string;
  recallId?: string;
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

export async function listComplaintRecords(collection: string, query: ComplaintListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.severity) filters.push({ field: "severity", value: query.severity });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  if (query.marketId) filters.push({ field: "marketId", value: query.marketId });
  if (query.assignedTo) filters.push({ field: "assignedTo", value: query.assignedTo });
  if (query.category) filters.push({ field: "category", value: query.category });
  if (query.complaintId) filters.push({ field: "complaintId", value: query.complaintId });
  if (query.investigationId) filters.push({ field: "investigationId", value: query.investigationId });
  if (query.recallId) filters.push({ field: "recallId", value: query.recallId });
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

export async function loadComplaintDashboard(idToken: string) {
  const [complaints, investigations, recalls, capas] = await Promise.all([
    queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { limit: 250 }),
    queryMasterDocuments(COMPLAINT_COLLECTIONS.investigations, idToken, { limit: 120 }),
    queryMasterDocuments(COMPLAINT_COLLECTIONS.recalls, idToken, { limit: 80 }),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "sourceType", value: "complaint" }], limit: 80 }).catch(() => []),
  ]);
  const now = new Date();
  const byMonth: Record<string, number> = {};
  const byProduct: Record<string, number> = {};
  const byBatch: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  const byMarket: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const rootCauses: Record<string, number> = {};
  const capaTrend: Record<string, number> = {};
  const recallTrend: Record<string, number> = {};
  const tats: number[] = [];
  for (const row of complaints) {
    increment(byMonth, text(row.receivedDate || row.createdAt).slice(0, 7) || "unknown");
    increment(byStatus, text(row.status || "unknown"));
    increment(bySeverity, text(row.severity || "unassigned"));
    if (row.productId) increment(byProduct, text(row.productName || row.productId));
    if (row.batchNumber) increment(byBatch, text(row.batchNumber));
    if (row.customerId) increment(byCustomer, text(row.customerId));
    if (row.marketId) increment(byMarket, text(row.marketId));
    if (row.category) increment(byCategory, text(row.category));
    const tat = calculateComplaintTAT(row.receivedDate || row.createdAt, row.closureDate);
    if (tat !== null && row.closureDate) tats.push(tat);
  }
  for (const row of capas) increment(capaTrend, text(row.createdAt).slice(0, 7) || "unknown");
  for (const row of recalls) increment(recallTrend, text(row.initiationDate || row.createdAt).slice(0, 7) || "unknown");
  const causes = await queryMasterDocuments(COMPLAINT_COLLECTIONS.rootCauses, idToken, { limit: 120 }).catch(() => []);
  for (const row of causes) increment(rootCauses, text(row.category || row.method || "unclassified"));
  return {
    kpis: {
      totalComplaints: complaints.length,
      newComplaints: complaints.filter((row) => text(row.status) === "received").length,
      underTriage: complaints.filter((row) => text(row.status) === "triage").length,
      underInvestigation: complaints.filter((row) => ["investigation_pending", "under_investigation"].includes(text(row.status))).length,
      highRiskComplaints: complaints.filter((row) => ["high", "critical"].includes(text(row.riskLevel)) || text(row.severity) === "major").length,
      criticalComplaints: complaints.filter((row) => text(row.severity) === "critical").length,
      overdueComplaints: complaints.filter((row) => (daysUntilUtc(row.dueDate, now) ?? 1) < 0 && !["closed", "cancelled"].includes(text(row.status))).length,
      pendingQaDecisions: complaints.filter((row) => text(row.status) === "qa_review").length,
      capaRequired: complaints.filter((row) => text(row.status) === "capa_pending" || row.capaId).length,
      recallRequired: complaints.filter((row) => text(row.status) === "recall_assessment" || row.recallId).length,
      openRecalls: recalls.filter((row) => text(row.status) !== "closed").length,
      closedComplaints: complaints.filter((row) => text(row.status) === "closed").length,
      openInvestigations: investigations.filter((row) => !["completed", "closed"].includes(text(row.status))).length,
      ...summarizeTats(tats),
    },
    charts: { byMonth, byProduct, byBatch, byCustomer, byMarket, byCategory, bySeverity, byStatus, rootCauses, capaTrend, recallTrend },
  };
}

export async function loadComplaintDetail(id: string, idToken: string) {
  const record = await readMasterDocument(COMPLAINT_COLLECTIONS.complaints, id, idToken);
  if (!record) return null;
  const productId = text(record.productId);
  const batchNumber = text(record.batchNumber);
  const customerId = text(record.customerId);
  const [
    product,
    customer,
    investigations,
    samples,
    rootCauses,
    risks,
    communications,
    notifications,
    recalls,
    withdrawals,
    capas,
    changes,
    pvCases,
    batches,
    orders,
    bmrs,
    qcTests,
    oos,
    qaReviews,
    deviations,
    issues,
    related,
    registrations,
  ] = await Promise.all([
    productId ? readMasterDocument("products", productId, idToken) : Promise.resolve(null),
    customerId ? readMasterDocument("customers", customerId, idToken) : Promise.resolve(null),
    listByField(COMPLAINT_COLLECTIONS.investigations, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.samples, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.rootCauses, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.risks, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.communications, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.notifications, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.recalls, "complaintId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.withdrawals, "complaintId", id, idToken),
    record.capaId ? queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "id", value: text(record.capaId) }], limit: 3 }).catch(() => []) : queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "sourceId", value: id }], limit: 5 }).catch(() => []),
    record.changeControlId ? queryMasterDocuments("qaChangeControls", idToken, { filters: [{ field: "id", value: text(record.changeControlId) }], limit: 3 }).catch(() => []) : Promise.resolve([]),
    record.pvCaseId ? queryMasterDocuments("pvCases", idToken, { filters: [{ field: "id", value: text(record.pvCaseId) }], limit: 3 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments(INVENTORY_COLLECTIONS.batches, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("manufacturingOrders", idToken, { filters: [{ field: "productId", value: productId }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments("batchManufacturingRecords", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments("qcTests", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 8 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments("qcOOS", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments("qaBatchReviews", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments("qaDeviations", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []) : Promise.resolve([]),
    batchNumber ? queryMasterDocuments(INVENTORY_COLLECTIONS.issues, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 8 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters: [{ field: "productId", value: productId }], limit: 10 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("regulatoryRegistrations", idToken, { filters: [{ field: "productId", value: productId }], limit: 5 }).catch(() => []) : Promise.resolve([]),
  ]);
  const investigationIds = investigations.map((row) => row.id);
  const tasks = investigationIds.length
    ? (await Promise.all(investigationIds.map((investigationId) => listByField(COMPLAINT_COLLECTIONS.tasks, "investigationId", investigationId, idToken)))).flat()
    : [];
  const investigators = investigationIds.length
    ? (await Promise.all(investigationIds.map((investigationId) => listByField(COMPLAINT_COLLECTIONS.investigators, "investigationId", investigationId, idToken)))).flat()
    : [];
  const timeline = [
    { date: text(record.receivedDate || record.createdAt), label: `Received ${record.complaintNumber}`, type: "intake" },
    ...investigations.map((row) => ({ date: text(row.initiatedDate), label: `Investigation ${row.investigationNumber}`, type: "investigation" })),
    ...samples.map((row) => ({ date: text(row.receivedDate), label: `Sample ${row.sampleNumber}`, type: "sample" })),
    ...rootCauses.map((row) => ({ date: text(row.determinedDate), label: `Root cause · ${row.method}`, type: "rca" })),
    ...communications.map((row) => ({ date: text(row.date), label: `Communication · ${row.communicationType}`, type: "communication" })),
    ...recalls.map((row) => ({ date: text(row.createdAt), label: `Recall ${row.recallNumber}`, type: "recall" })),
    ...(record.closureDate ? [{ date: text(record.closureDate), label: "Complaint closed", type: "closure" }] : []),
  ].filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date));
  return {
    record,
    extra: {
      product,
      customer,
      investigations,
      investigators,
      tasks,
      samples,
      rootCauses,
      risks,
      communications,
      notifications,
      recalls,
      withdrawals,
      capas,
      changes,
      pvCases,
      batches,
      batchFound: batches.length > 0,
      batchMessage: batches.length ? "" : batchNumber ? "Batch Not Found — Investigation Required" : "",
      orders,
      bmrs,
      qcTests,
      oos,
      qaReviews,
      deviations,
      issues,
      related: related.filter((row) => row.id !== id),
      registrations,
      timeline,
    },
  };
}

export async function loadInvestigationDetail(id: string, idToken: string) {
  const record = await readMasterDocument(COMPLAINT_COLLECTIONS.investigations, id, idToken);
  if (!record) return null;
  const [tasks, investigators, rootCauses, complaint] = await Promise.all([
    listByField(COMPLAINT_COLLECTIONS.tasks, "investigationId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.investigators, "investigationId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.rootCauses, "investigationId", id, idToken),
    record.complaintId ? readMasterDocument(COMPLAINT_COLLECTIONS.complaints, text(record.complaintId), idToken) : Promise.resolve(null),
  ]);
  return { record, extra: { tasks, investigators, rootCauses, complaint } };
}

export async function loadRecallDetail(id: string, idToken: string) {
  const record = await readMasterDocument(COMPLAINT_COLLECTIONS.recalls, id, idToken);
  if (!record) return null;
  const [batches, customers, returns, notifications] = await Promise.all([
    listByField(COMPLAINT_COLLECTIONS.recallBatches, "recallId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.recallCustomers, "recallId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.recallReturns, "recallId", id, idToken),
    listByField(COMPLAINT_COLLECTIONS.notifications, "recallId", id, idToken),
  ]);
  const returned = returns.reduce((sum, row) => sum + Number(row.quantityReturned || 0), 0);
  const shipped = returns.reduce((sum, row) => sum + Number(row.quantityShipped || 0), 0);
  return {
    record,
    extra: {
      batches,
      customers,
      returns,
      notifications,
      returnedQuantity: returned,
      pendingQuantity: Math.max(shipped - returned, 0),
      shippedQuantity: shipped,
    },
  };
}

export async function loadProductComplaintProfile(productId: string, idToken: string) {
  const product = await readMasterDocument("products", productId, idToken);
  const [complaints, recalls, withdrawals, pvCases, capas] = await Promise.all([
    queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters: [{ field: "productId", value: productId }], limit: 50 }),
    queryMasterDocuments(COMPLAINT_COLLECTIONS.recalls, idToken, { filters: [{ field: "productId", value: productId }], limit: 20 }),
    queryMasterDocuments(COMPLAINT_COLLECTIONS.withdrawals, idToken, { filters: [{ field: "productId", value: productId }], limit: 20 }),
    queryMasterDocuments("pvCases", idToken, { filters: [{ field: "productId", value: productId }], limit: 20 }).catch(() => []),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "productId", value: productId }], limit: 20 }).catch(() => []),
  ]);
  return {
    record: product || { id: productId, productId },
    extra: { complaints, recalls, withdrawals, pvCases, capas },
  };
}

export async function loadCustomerComplaintProfile(customerId: string, idToken: string) {
  const customer = await readMasterDocument("customers", customerId, idToken);
  const complaints = await queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters: [{ field: "customerId", value: customerId }], limit: 50 });
  return { record: customer || { id: customerId, customerId }, extra: { complaints } };
}

export async function loadBatchComplaintView(batchNumber: string, idToken: string) {
  const [complaints, batches, qcTests, deviations, capas, recalls] = await Promise.all([
    queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 50 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.batches, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 5 }).catch(() => []),
    queryMasterDocuments("qcTests", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 10 }).catch(() => []),
    queryMasterDocuments("qaDeviations", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 10 }).catch(() => []),
    queryMasterDocuments("qaCAPA", idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 10 }).catch(() => []),
    queryMasterDocuments(COMPLAINT_COLLECTIONS.recallBatches, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 10 }).catch(() => []),
  ]);
  return {
    record: { id: batchNumber, batchNumber, batchFound: batches.length > 0, batchMessage: batches.length ? "" : "Batch Not Found — Investigation Required" },
    extra: { complaints, batches, qcTests, deviations, capas, recalls },
  };
}

export async function loadComplaintTrends(idToken: string) {
  const complaints = await queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { limit: 250 });
  const clusters: Record<string, { key: string; type: string; count: number; ids: string[] }> = {};
  for (const row of complaints) {
    const keys = [
      ["product", text(row.productId)],
      ["batch", text(row.batchNumber)],
      ["customer", text(row.customerId)],
      ["category", text(row.category)],
    ];
    for (const [type, value] of keys) {
      if (!value) continue;
      const key = `${type}:${value}`;
      clusters[key] = clusters[key] || { key, type, count: 0, ids: [] };
      clusters[key].count += 1;
      clusters[key].ids.push(row.id);
    }
  }
  const potential = Object.values(clusters).filter((item) => item.count >= 2).sort((a, b) => b.count - a.count);
  return { record: { status: "potential" }, extra: { potential, note: "Potential Trend — qualified review is required before confirmation." } };
}

export async function loadComplaintReport(type: (typeof COMPLAINT_REPORT_TYPES)[number], query: ComplaintListQuery, idToken: string) {
  const collection =
    type === "investigation_tat" ? COMPLAINT_COLLECTIONS.investigations
      : type === "recall" || type === "recall_reconciliation" ? COMPLAINT_COLLECTIONS.recalls
        : type === "withdrawal" ? COMPLAINT_COLLECTIONS.withdrawals
          : type === "regulatory_notification" ? COMPLAINT_COLLECTIONS.notifications
            : type === "root_cause" ? COMPLAINT_COLLECTIONS.rootCauses
              : COMPLAINT_COLLECTIONS.complaints;
  if (type === "overdue") {
    return listMatchingComplaintRecords(collection, query, idToken, (row) =>
      (daysUntilUtc(row.dueDate) ?? 1) < 0 && !["closed", "cancelled"].includes(text(row.status))
    );
  }
  if (type === "capa_linked") {
    return listMatchingComplaintRecords(collection, query, idToken, (row) => Boolean(text(row.capaId)));
  }
  if (type === "closure") {
    return listMatchingComplaintRecords(collection, query, idToken, (row) => text(row.status) === "closed");
  }
  if (type === "repeated") {
    return listMatchingComplaintRecords(
      collection,
      query,
      idToken,
      (row) => Boolean(text(row.relatedComplaintCount) || text(row.batchNumber))
    );
  }
  return listComplaintRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken);
}

async function listMatchingComplaintRecords(
  collection: string,
  query: ComplaintListQuery,
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
    const result = await listComplaintRecords(collection, { ...query, pageSize: 100, cursor }, idToken);
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

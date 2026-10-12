import { RA_COLLECTIONS } from "@/lib/ra/collections";
import { calculateExpiryStatus, daysUntil } from "@/lib/ra/expiry";
import { listByField, text } from "@/lib/ra/helpers";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { RA_REPORT_TYPES } from "@/types/ra";

const SEARCH_END = "\uf8ff";

export interface RaListQuery {
  status?: string;
  productId?: string;
  customerId?: string;
  marketId?: string;
  authorityId?: string;
  ownerId?: string;
  plantId?: string;
  registrationId?: string;
  submissionId?: string;
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

export async function listRaRecords(collection: string, query: RaListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.marketId) filters.push({ field: "marketId", value: query.marketId });
  if (query.authorityId) filters.push({ field: "authorityId", value: query.authorityId });
  if (query.ownerId) filters.push({ field: "ownerId", value: query.ownerId });
  if (query.plantId) filters.push({ field: "plantId", value: query.plantId });
  if (query.registrationId) filters.push({ field: "registrationId", value: query.registrationId });
  if (query.submissionId) filters.push({ field: "submissionId", value: query.submissionId });
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

export async function loadRaDashboard(idToken: string) {
  const [registrations, submissions, licenses, queries, commitments, documents, renewals, changes] = await Promise.all([
    queryMasterDocuments(RA_COLLECTIONS.registrations, idToken, { limit: 200 }),
    queryMasterDocuments(RA_COLLECTIONS.submissions, idToken, { limit: 150 }),
    queryMasterDocuments(RA_COLLECTIONS.licenses, idToken, { limit: 100 }),
    queryMasterDocuments(RA_COLLECTIONS.queries, idToken, { limit: 100 }),
    queryMasterDocuments(RA_COLLECTIONS.commitments, idToken, { limit: 100 }),
    queryMasterDocuments(RA_COLLECTIONS.documents, idToken, { limit: 100 }),
    queryMasterDocuments(RA_COLLECTIONS.renewals, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.changes, idToken, { limit: 80 }),
  ]);
  const today = new Date();
  const byStatus: Record<string, number> = {};
  const byMarket: Record<string, number> = {};
  const byProduct: Record<string, number> = {};
  const submissionStatus: Record<string, number> = {};
  const commitmentStatus: Record<string, number> = {};
  const queryTrend: Record<string, number> = {};
  const tats: number[] = [];
  const queryTats: number[] = [];
  for (const row of registrations) {
    byStatus[text(row.status)] = (byStatus[text(row.status)] || 0) + 1;
    if (row.marketId) byMarket[text(row.marketId)] = (byMarket[text(row.marketId)] || 0) + 1;
    if (row.productId) byProduct[text(row.productId)] = (byProduct[text(row.productId)] || 0) + 1;
  }
  for (const row of submissions) {
    submissionStatus[text(row.status)] = (submissionStatus[text(row.status)] || 0) + 1;
    if (row.submissionDate && (row.actualResponseDate || row.approvedAt)) {
      const hours = (new Date(String(row.actualResponseDate || row.approvedAt)).getTime() - new Date(String(row.submissionDate)).getTime()) / 36e5;
      if (Number.isFinite(hours) && hours >= 0) tats.push(hours);
    }
  }
  for (const row of queries) {
    const month = text(row.receivedDate || row.createdAt).slice(0, 7) || "unknown";
    queryTrend[month] = (queryTrend[month] || 0) + 1;
    if (row.receivedDate && row.responseDate) {
      const hours = (new Date(String(row.responseDate)).getTime() - new Date(String(row.receivedDate)).getTime()) / 36e5;
      if (Number.isFinite(hours) && hours >= 0) queryTats.push(hours);
    }
  }
  for (const row of commitments) commitmentStatus[text(row.status)] = (commitmentStatus[text(row.status)] || 0) + 1;
  const expiringRegistrations = registrations.filter((row) => ["expiring_soon", "critical"].includes(calculateExpiryStatus(row.expiryDate)));
  const expiringLicenses = licenses.filter((row) => ["expiring_soon", "critical"].includes(calculateExpiryStatus(row.expiryDate)));
  const upcoming: Record<string, number> = {};
  for (const row of [...expiringRegistrations, ...renewals]) {
    const month = text(row.expiryDate || row.plannedSubmissionDate || row.currentExpiryDate).slice(0, 7) || "unscheduled";
    upcoming[month] = (upcoming[month] || 0) + 1;
  }
  const workload = {
    registrations: registrations.filter((row) => !["approved", "rejected", "withdrawn", "expired"].includes(text(row.status))).length,
    submissions: submissions.filter((row) => !["approved", "rejected", "closed", "withdrawn"].includes(text(row.status))).length,
    queries: queries.filter((row) => !["closed", "accepted"].includes(text(row.status))).length,
    commitments: commitments.filter((row) => !["completed", "cancelled"].includes(text(row.status))).length,
    renewals: renewals.filter((row) => !["approved", "closed", "rejected"].includes(text(row.status))).length,
    changes: changes.filter((row) => text(row.status) !== "closed").length,
  };
  return {
    kpis: {
      activeRegistrations: registrations.filter((row) => ["approved", "submitted", "under_review"].includes(text(row.status))).length,
      pendingSubmissions: submissions.filter((row) => !["approved", "rejected", "closed", "withdrawn"].includes(text(row.status))).length,
      underAuthorityReview: submissions.filter((row) => ["submitted", "acknowledged", "under_review", "query_received"].includes(text(row.status))).length,
      approvedRegistrations: registrations.filter((row) => text(row.status) === "approved").length,
      expiringRegistrations: expiringRegistrations.length,
      expiringLicenses: expiringLicenses.length,
      openQueries: queries.filter((row) => !["closed", "accepted"].includes(text(row.status))).length,
      openCommitments: commitments.filter((row) => !["completed", "cancelled"].includes(text(row.status))).length,
      overdueCommitments: commitments.filter((row) => text(row.status) === "overdue" || (text(row.dueDate) && daysUntil(row.dueDate, today) !== null && (daysUntil(row.dueDate, today) || 0) < 0 && text(row.status) !== "completed")).length,
      documentsExpiring: documents.filter((row) => ["expiring_soon", "critical", "expired"].includes(calculateExpiryStatus(row.expiryDate))).length,
      averageTatHours: tats.length ? Math.round((tats.reduce((sum, value) => sum + value, 0) / tats.length) * 10) / 10 : 0,
      minTatHours: tats.length ? Math.round(Math.min(...tats) * 10) / 10 : 0,
      maxTatHours: tats.length ? Math.round(Math.max(...tats) * 10) / 10 : 0,
      queryAverageTatHours: queryTats.length ? Math.round((queryTats.reduce((sum, value) => sum + value, 0) / queryTats.length) * 10) / 10 : 0,
    },
    charts: { byStatus, submissionStatus, byMarket, byProduct, queryTrend, commitmentStatus, upcoming, workload },
    upcomingRenewals: [...expiringRegistrations, ...renewals].slice(0, 12),
  };
}

export async function loadRaCalendar(idToken: string) {
  const [registrations, licenses, documents, commitments, queries, submissions, renewals, changes] = await Promise.all([
    queryMasterDocuments(RA_COLLECTIONS.registrations, idToken, { limit: 120 }),
    queryMasterDocuments(RA_COLLECTIONS.licenses, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.documents, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.commitments, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.queries, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.submissions, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.renewals, idToken, { limit: 80 }),
    queryMasterDocuments(RA_COLLECTIONS.changes, idToken, { limit: 80 }),
  ]);
  const events = [
    ...registrations.map((row) => eventOf(row, "registration", "Registration expiry", row.expiryDate, `/ra/registrations/${row.id}`)),
    ...licenses.map((row) => eventOf(row, "license", "License expiry", row.expiryDate, `/ra/licenses/${row.id}`)),
    ...documents.map((row) => eventOf(row, "document", "Document expiry", row.expiryDate, `/ra/documents/${row.id}`)),
    ...commitments.map((row) => eventOf(row, "commitment", "Commitment due", row.dueDate, `/ra/commitments/${row.id}`)),
    ...queries.map((row) => eventOf(row, "query", "Query response due", row.responseDueDate, `/ra/queries/${row.id}`)),
    ...submissions.map((row) => eventOf(row, "submission", "Submission deadline", row.expectedResponseDate || row.submissionDate, `/ra/submissions/${row.id}`)),
    ...renewals.map((row) => eventOf(row, "renewal", "Renewal deadline", row.plannedSubmissionDate || row.currentExpiryDate, `/ra/renewals/${row.id}`)),
    ...changes.map((row) => eventOf(row, "change", "Regulatory change effective", row.effectiveDate, `/ra/changes/${row.id}`)),
  ].filter((event) => event.date);
  return { events };
}

function eventOf(row: MasterRecord, type: string, title: string, date: unknown, href: string) {
  return {
    id: `${type}-${row.id}`,
    type,
    title: `${title}: ${text(row.registrationNumber || row.licenseNumber || row.documentNumber || row.commitmentNumber || row.queryNumber || row.submissionNumber || row.renewalNumber || row.changeNumber || row.id)}`,
    date: text(date).slice(0, 10),
    status: calculateExpiryStatus(date),
    recordStatus: text(row.status),
    href,
  };
}

export async function loadRegistrationDetail(id: string, idToken: string) {
  const record = await readMasterDocument(RA_COLLECTIONS.registrations, id, idToken);
  if (!record) return null;
  const productId = text(record.productId);
  const [submissions, dossiers, documents, renewals, queries, communications, requirements, artworks, qaChanges, stability, specs, coas, orders] = await Promise.all([
    listByField(RA_COLLECTIONS.submissions, "registrationId", id, idToken),
    listByField(RA_COLLECTIONS.dossiers, "registrationId", id, idToken),
    listByField(RA_COLLECTIONS.documents, "registrationId", id, idToken),
    listByField(RA_COLLECTIONS.renewals, "registrationId", id, idToken),
    listByField(RA_COLLECTIONS.queries, "registrationId", id, idToken),
    listByField(RA_COLLECTIONS.communications, "registrationId", id, idToken),
    productId ? listByField(RA_COLLECTIONS.requirements, "productId", productId, idToken) : Promise.resolve([]),
    productId ? listByField(RA_COLLECTIONS.artworks, "productId", productId, idToken) : Promise.resolve([]),
    productId ? queryMasterDocuments("qaChangeControls", idToken, { filters: [{ field: "affectedProducts", value: productId }], limit: 10 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("qcStabilityStudies", idToken, { filters: [{ field: "productId", value: productId }], limit: 10 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("qcSpecifications", idToken, { filters: [{ field: "productId", value: productId }], limit: 10 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("qcCOAs", idToken, { filters: [{ field: "productId", value: productId }], limit: 10 }).catch(() => []) : Promise.resolve([]),
    productId ? queryMasterDocuments("manufacturingOrders", idToken, { filters: [{ field: "productId", value: productId }], limit: 10 }).catch(() => []) : Promise.resolve([]),
  ]);
  return {
    record: { ...record, expiryStatus: calculateExpiryStatus(record.expiryDate) },
    extra: { submissions, dossiers, documents, renewals, queries, communications, requirements, artworks, qaChanges, stability, specs, coas, orders },
  };
}

export async function loadSubmissionDetail(id: string, idToken: string) {
  const record = await readMasterDocument(RA_COLLECTIONS.submissions, id, idToken);
  if (!record) return null;
  const [versions, documents, queries, communications] = await Promise.all([
    listByField(RA_COLLECTIONS.versions, "submissionId", id, idToken),
    listByField(RA_COLLECTIONS.documents, "submissionId", id, idToken),
    listByField(RA_COLLECTIONS.queries, "submissionId", id, idToken),
    listByField(RA_COLLECTIONS.communications, "submissionId", id, idToken),
  ]);
  return { record, extra: { versions, documents, queries, communications } };
}

export async function loadDossierDetail(id: string, idToken: string) {
  const record = await readMasterDocument(RA_COLLECTIONS.dossiers, id, idToken);
  if (!record) return null;
  const sections = await listByField(RA_COLLECTIONS.sections, "dossierId", id, idToken);
  return { record, extra: { sections } };
}

export async function loadQueryDetail(id: string, idToken: string) {
  const record = await readMasterDocument(RA_COLLECTIONS.queries, id, idToken);
  if (!record) return null;
  const tasks = await listByField(RA_COLLECTIONS.queryTasks, "queryId", id, idToken);
  return { record, extra: { tasks } };
}

export async function loadRaReport(type: (typeof RA_REPORT_TYPES)[number], query: RaListQuery, idToken: string) {
  const collection =
    type === "submission"
      ? RA_COLLECTIONS.submissions
      : type === "license_expiry"
        ? RA_COLLECTIONS.licenses
        : type === "renewal"
          ? RA_COLLECTIONS.renewals
          : type === "query"
            ? RA_COLLECTIONS.queries
            : type === "commitment" || type === "overdue_commitment"
              ? RA_COLLECTIONS.commitments
              : type === "communication"
                ? RA_COLLECTIONS.communications
                : type === "document"
                  ? RA_COLLECTIONS.documents
                  : type === "artwork"
                    ? RA_COLLECTIONS.artworks
                    : type === "regulatory_change"
                      ? RA_COLLECTIONS.changes
                      : type === "customer_requirement"
                        ? RA_COLLECTIONS.requirements
                        : RA_COLLECTIONS.registrations;
  if (type === "compliance_calendar") {
    const calendar = await loadRaCalendar(idToken);
    return { rows: calendar.events, nextCursor: null };
  }
  if (type === "registration_expiry" || type === "license_expiry") {
    return listMatchingRaRecords(collection, query, idToken, (row) =>
      ["expiring_soon", "critical", "expired"].includes(calculateExpiryStatus(row.expiryDate))
    );
  }
  return listRaRecords(
    collection,
    { ...query, pageSize: query.pageSize || 50, status: type === "overdue_commitment" ? "overdue" : query.status },
    idToken
  );
}

async function listMatchingRaRecords(
  collection: string,
  query: RaListQuery,
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
    const result = await listRaRecords(collection, { ...query, pageSize: 100, cursor }, idToken);
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

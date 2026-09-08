import { searchIndex } from "@/lib/inventory/keys";
import { RA_COLLECTIONS } from "@/lib/ra/collections";
import { DEFAULT_DOSSIER_SECTIONS } from "@/lib/ra/config";
import { calculateExpiryStatus } from "@/lib/ra/expiry";
import {
  actorStamp,
  auditRa,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueRaNumber,
  listByField,
  notifyRa,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/ra/helpers";
import {
  ARTWORK_TRANSITIONS,
  canTransition,
  CHANGE_TRANSITIONS,
  COMMITMENT_TRANSITIONS,
  DOCUMENT_TRANSITIONS,
  LICENSE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUERY_TRANSITIONS,
  REGISTRATION_TRANSITIONS,
  RENEWAL_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
} from "@/lib/ra/status";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import {
  artworkSchema,
  authoritySchema,
  changeSchema,
  commitmentSchema,
  communicationSchema,
  documentSchema,
  dossierSchema,
  licenseSchema,
  marketSchema,
  profileSchema,
  querySchema,
  queryTaskSchema,
  registrationSchema,
  renewalSchema,
  requirementSchema,
  submissionSchema,
} from "@/lib/validation/ra";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

function lockedApproved(status: string) {
  return ["approved", "submitted", "superseded", "obsolete", "closed"].includes(status);
}

export async function createRegulatoryProfile(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raProduct:update");
  const data = parseOrFail(profileSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey || `ra-profile-${data.productId}`, options.idToken);
  if (reused) return reused;
  const existing = await queryMasterDocuments(RA_COLLECTIONS.profiles, options.idToken, {
    filters: [{ field: "productId", value: data.productId }],
    limit: 1,
  });
  if (existing.length) return { id: String(existing[0].id), record: existing[0] };
  const product = await readMasterDocument("products", data.productId, options.idToken);
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("PROFILE", options.session, options.idToken);
  const record = {
    regulatoryProfileId: id,
    profileNumber: numbered.documentNumber,
    ...data,
    productCode: data.productCode || text(product?.productCode),
    productName: data.productName || text(product?.productName),
    status: data.status || "not_assessed",
    searchIndex: searchIndex(numbered.documentNumber, data.productId, product?.productCode, product?.productName),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(RA_COLLECTIONS.profiles, id, record, { exists: false }),
      idempotencyWrite(data.idempotencyKey || `ra-profile-${data.productId}`, { id, record }, options.session),
    ],
    options.idToken
  );
  return { id, record };
}

export async function createMarket(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raMarket:create");
  const data = parseOrFail(marketSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    marketId: id,
    ...data,
    status: data.status || "active",
    searchIndex: searchIndex(data.marketCode, data.marketName, data.country),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.markets, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createAuthority(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raAuthority:create");
  const data = parseOrFail(authoritySchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    authorityId: id,
    ...data,
    status: data.status || "active",
    searchIndex: searchIndex(data.authorityName, data.country, data.region),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.authorities, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createRegistration(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raRegistration:create");
  const data = parseOrFail(registrationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("REG", options.session, options.idToken);
  const record = {
    registrationId: id,
    registrationNumber: numbered.documentNumber,
    ...data,
    status: data.status || "draft",
    expiryStatus: calculateExpiryStatus(data.expiryDate),
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.marketId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(RA_COLLECTIONS.registrations, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "REGISTRATION_CREATED",
    resource: RA_COLLECTIONS.registrations,
    resourceId: id,
    description: `Created registration ${numbered.documentNumber}.`,
    newData: { productId: data.productId, marketId: data.marketId },
  });
  return { id, record };
}

export async function updateRegistration(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raRegistration:update");
  const record = await requireRecord(RA_COLLECTIONS.registrations, options.id, options.idToken, "Registration");
  if (["approved", "withdrawn"].includes(text(record.status)) && !options.payload.status) {
    fail("Approved registrations cannot be silently overwritten. Create a renewal or variation.");
  }
  const nextStatus = text(options.payload.status || record.status);
  if (nextStatus !== text(record.status) && !canTransition(REGISTRATION_TRANSITIONS, text(record.status), nextStatus)) {
    workflowFail(text(record.status), nextStatus);
  }
  const next = {
    ...record,
    ...options.payload,
    registrationNumber: record.registrationNumber,
    status: nextStatus,
    expiryStatus: calculateExpiryStatus(options.payload.expiryDate || record.expiryDate),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.registrations, options.id, next)], options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "REGISTRATION_UPDATED",
    resource: RA_COLLECTIONS.registrations,
    resourceId: options.id,
    description: `Updated registration ${text(record.registrationNumber)}.`,
    oldData: { status: record.status },
    newData: { status: nextStatus },
  });
  return { id: options.id, record: next };
}

export async function approveRegistration(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.registrations,
    id: options.id,
    next: "approved",
    map: REGISTRATION_TRANSITIONS,
    permission: "raRegistration:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "REGISTRATION_APPROVED",
    extra: { approvalDate: new Date().toISOString().slice(0, 10) },
    label: "Registration",
  });
}

export async function createSubmission(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raSubmission:create");
  const data = parseOrFail(submissionSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("SUB", options.session, options.idToken);
  const record = {
    submissionId: id,
    submissionNumber: numbered.documentNumber,
    submissionVersion: 1,
    submittedBy: "",
    authorityReferenceNumber: "",
    actualResponseDate: "",
    status: "draft",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.marketId),
    ...actorStamp(options.session),
  };
  const versionId = crypto.randomUUID();
  const version = {
    versionId,
    submissionId: id,
    version: 1,
    status: "draft",
    comments: "Initial version",
    documents: [],
    ...actorStamp(options.session),
  };
  const writes = [
    writeOf(RA_COLLECTIONS.submissions, id, record, { exists: false }),
    writeOf(RA_COLLECTIONS.versions, versionId, version, { exists: false }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "SUBMISSION_CREATED",
    resource: RA_COLLECTIONS.submissions,
    resourceId: id,
    description: `Created submission ${numbered.documentNumber}.`,
    newData: { productId: data.productId },
  });
  return { id, record, extra: { versions: [version] } };
}

export async function createSubmissionVersion(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raSubmission:update");
  const record = await requireRecord(RA_COLLECTIONS.submissions, options.id, options.idToken, "Submission");
  const versions = await listByField(RA_COLLECTIONS.versions, "submissionId", options.id, options.idToken);
  const nextVersion = Math.max(1, ...versions.map((row) => Number(row.version || 1))) + 1;
  const versionId = crypto.randomUUID();
  const version = {
    versionId,
    submissionId: options.id,
    version: nextVersion,
    status: "draft",
    comments: options.comment || `Version ${nextVersion}`,
    previousVersion: record.submissionVersion,
    documents: [],
    ...actorStamp(options.session),
  };
  const next = { ...record, submissionVersion: nextVersion, status: "draft", ...actorStamp(options.session, record) };
  await commitWrites([
    writeOf(RA_COLLECTIONS.versions, versionId, version, { exists: false }),
    writeOf(RA_COLLECTIONS.submissions, options.id, next),
  ], options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "SUBMISSION_VERSION_CREATED",
    resource: RA_COLLECTIONS.versions,
    resourceId: versionId,
    description: `Created ${text(record.submissionNumber)} v${nextVersion}.`,
    oldData: { version: record.submissionVersion },
    newData: { version: nextVersion },
  });
  return { id: options.id, record: next, extra: { version } };
}

export async function approveSubmission(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.submissions,
    id: options.id,
    next: "approved_for_submission",
    map: SUBMISSION_TRANSITIONS,
    permission: "raSubmission:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "SUBMISSION_APPROVED",
    label: "Submission",
  });
}

export async function submitSubmission(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  const result = await advance({
    collection: RA_COLLECTIONS.submissions,
    id: options.id,
    next: "submitted",
    map: SUBMISSION_TRANSITIONS,
    permission: "raSubmission:submit",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "SUBMISSION_SUBMITTED",
    extra: { submittedBy: options.session.uid, submissionDate: new Date().toISOString() },
    label: "Submission",
  });
  await notifyRa(options.idToken, options.session, {
    type: "submission_deadline",
    title: "Submission sent",
    message: `${text(result.record.submissionNumber)} was submitted.`,
    resource: RA_COLLECTIONS.submissions,
    resourceId: options.id,
    audienceRoles: ["regulatory", "qa"],
  });
  return result;
}

export async function createDossier(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raDossier:create");
  const data = parseOrFail(dossierSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("DOS", options.session, options.idToken);
  const record = {
    dossierId: id,
    dossierNumber: numbered.documentNumber,
    version: 1,
    status: "draft",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.title, data.productId),
    ...actorStamp(options.session),
  };
  const sourceSections = data.sections?.length
    ? data.sections.map((item) => ({ section: item.section, title: item.title || item.section }))
    : DEFAULT_DOSSIER_SECTIONS.map((item) => ({ section: item.key, title: item.title }));
  const sections = sourceSections.map((section, index) => {
    const sectionId = crypto.randomUUID();
    return {
      id: sectionId,
      dossierId: id,
      sequence: index + 1,
      section: section.section,
      title: section.title,
      status: "draft",
      ...actorStamp(options.session),
    };
  });
  await commitWrites(
    [
      writeOf(RA_COLLECTIONS.dossiers, id, record, { exists: false }),
      ...sections.map((section) => writeOf(RA_COLLECTIONS.sections, section.id, section, { exists: false })),
    ],
    options.idToken
  );
  return { id, record, extra: { sections } };
}

export async function approveDossier(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(RA_COLLECTIONS.dossiers, options.id, options.idToken, "Dossier");
  if (lockedApproved(text(record.status)) && text(record.status) === "approved") fail("Approved dossiers cannot be modified.");
  ensurePermission(options.session, "raDossier:approve");
  const next = {
    ...record,
    status: "approved",
    approvalSignature: electronicSignature(options.session, "dossier_approve", options.comment),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.dossiers, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createRegulatoryDocument(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raDocument:create");
  const data = parseOrFail(documentSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("DOC", options.session, options.idToken);
  const record = {
    documentId: id,
    documentNumber: numbered.documentNumber,
    version: data.version || "1",
    status: data.status || "draft",
    expiryStatus: calculateExpiryStatus(data.expiryDate),
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.documentTitle),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function approveRegulatoryDocument(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(RA_COLLECTIONS.documents, options.id, options.idToken, "Document");
  if (["approved", "submitted", "superseded"].includes(text(record.status))) {
    fail("Approved documents cannot be modified. Create a new version.");
  }
  if (!canTransition(DOCUMENT_TRANSITIONS, text(record.status), "approved")) workflowFail(text(record.status), "approve");
  ensurePermission(options.session, "raDocument:approve");
  const previous = await queryMasterDocuments(RA_COLLECTIONS.documents, options.idToken, {
    filters: [{ field: "documentTitle", value: text(record.documentTitle) }],
    limit: 20,
  });
  const writes = previous
    .filter((row) => String(row.id) !== options.id && text(row.status) === "approved")
    .map((row) => writeOf(RA_COLLECTIONS.documents, String(row.id), { ...row, status: "superseded", ...actorStamp(options.session, row) }));
  const next = {
    ...record,
    status: "approved",
    approvalSignature: electronicSignature(options.session, "document_approve", options.comment),
    ...actorStamp(options.session, record),
  };
  writes.push(writeOf(RA_COLLECTIONS.documents, options.id, next));
  await commitWrites(writes, options.idToken);
  await auditRa(options.idToken, options.session, {
    action: writes.length > 1 ? "DOCUMENT_SUPERSEDED" : "DOCUMENT_APPROVED",
    resource: RA_COLLECTIONS.documents,
    resourceId: options.id,
    description: `Approved document ${text(record.documentNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "approved" },
  });
  return { id: options.id, record: next };
}

export async function createLicense(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raLicense:create");
  const data = parseOrFail(licenseSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("LIC", options.session, options.idToken);
  const expiryStatus = calculateExpiryStatus(data.expiryDate);
  const record = {
    licenseId: id,
    licenseNumber: numbered.documentNumber,
    ...data,
    status: data.status || (expiryStatus === "expired" ? "expired" : expiryStatus === "expiring_soon" || expiryStatus === "critical" ? "expiring_soon" : "draft"),
    expiryStatus,
    searchIndex: searchIndex(numbered.documentNumber, data.licenseType, data.plantId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(RA_COLLECTIONS.licenses, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "LICENSE_CREATED",
    resource: RA_COLLECTIONS.licenses,
    resourceId: id,
    description: `Created license ${numbered.documentNumber}.`,
    newData: { licenseType: data.licenseType },
  });
  return { id, record };
}

export async function renewLicense(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raLicense:update");
  const record = await requireRecord(RA_COLLECTIONS.licenses, options.id, options.idToken, "License");
  const next = {
    ...record,
    expiryDate: options.payload.expiryDate || record.expiryDate,
    issueDate: options.payload.issueDate || new Date().toISOString().slice(0, 10),
    status: "active",
    expiryStatus: calculateExpiryStatus(options.payload.expiryDate || record.expiryDate),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.licenses, options.id, next)], options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "LICENSE_RENEWED",
    resource: RA_COLLECTIONS.licenses,
    resourceId: options.id,
    description: `Renewed license ${text(record.licenseNumber)}.`,
    oldData: { expiryDate: record.expiryDate },
    newData: { expiryDate: next.expiryDate },
  });
  return { id: options.id, record: next };
}

export async function createRenewal(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raRenewal:create");
  const data = parseOrFail(renewalSchema, options.payload);
  const registration = await requireRecord(RA_COLLECTIONS.registrations, data.registrationId, options.idToken, "Registration");
  const reused = await reuseIdempotent(data.idempotencyKey || `ra-ren-${data.registrationId}-${data.currentExpiryDate || ""}`, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("REN", options.session, options.idToken);
  const record = {
    renewalId: id,
    renewalNumber: numbered.documentNumber,
    currentExpiryDate: data.currentExpiryDate || text(registration.expiryDate),
    actualSubmissionDate: "",
    newExpiryDate: "",
    status: data.status || "not_started",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.registrationId),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(RA_COLLECTIONS.renewals, id, record, { exists: false }),
      idempotencyWrite(data.idempotencyKey || `ra-ren-${data.registrationId}-${record.currentExpiryDate}`, { id, record }, options.session),
    ],
    options.idToken
  );
  return { id, record };
}

export async function approveRenewal(options: { id: string; payload?: Record<string, unknown>; comment?: string; session: SessionPayload; idToken: string }) {
  const result = await advance({
    collection: RA_COLLECTIONS.renewals,
    id: options.id,
    next: "approved",
    map: RENEWAL_TRANSITIONS,
    permission: "raRenewal:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    extra: { newExpiryDate: options.payload?.newExpiryDate || "" },
    label: "Renewal",
  });
  const registrationId = text(result.record.registrationId);
  if (registrationId && result.record.newExpiryDate) {
    const registration = await requireRecord(RA_COLLECTIONS.registrations, registrationId, options.idToken, "Registration");
    await commitWrites([
      writeOf(RA_COLLECTIONS.registrations, registrationId, {
        ...registration,
        expiryDate: result.record.newExpiryDate,
        status: "approved",
        expiryStatus: calculateExpiryStatus(result.record.newExpiryDate),
        ...actorStamp(options.session, registration),
      }),
    ], options.idToken);
  }
  return result;
}

export async function createRegulatoryQuery(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raQuery:create");
  const data = parseOrFail(querySchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("QRY", options.session, options.idToken);
  const record = {
    queryId: id,
    queryNumber: numbered.documentNumber,
    responseDate: "",
    status: data.status || "received",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.submissionId, data.description),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(RA_COLLECTIONS.queries, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "QUERY_CREATED",
    resource: RA_COLLECTIONS.queries,
    resourceId: id,
    description: `Created query ${numbered.documentNumber}.`,
    newData: { submissionId: data.submissionId },
  });
  await notifyRa(options.idToken, options.session, {
    type: "query_received",
    title: "Regulatory query received",
    message: `${numbered.documentNumber} requires a response.`,
    resource: RA_COLLECTIONS.queries,
    resourceId: id,
    audienceRoles: ["regulatory", "qa"],
  });
  return { id, record };
}

export async function assignQuery(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raQuery:assign");
  const record = await requireRecord(RA_COLLECTIONS.queries, options.id, options.idToken, "Query");
  if (!canTransition(QUERY_TRANSITIONS, text(record.status), "assigned") && text(record.status) !== "assigned") {
    workflowFail(text(record.status), "assign");
  }
  const task = parseOrFail(queryTaskSchema, options.payload);
  const taskId = crypto.randomUUID();
  const taskRecord = {
    taskId,
    queryId: options.id,
    status: "open",
    ...task,
    ...actorStamp(options.session),
  };
  const next = { ...record, status: "assigned", assignedTo: task.responsiblePerson || record.assignedTo, ...actorStamp(options.session, record) };
  await commitWrites([
    writeOf(RA_COLLECTIONS.queries, options.id, next),
    writeOf(RA_COLLECTIONS.queryTasks, taskId, taskRecord, { exists: false }),
  ], options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "QUERY_ASSIGNED",
    resource: RA_COLLECTIONS.queries,
    resourceId: options.id,
    description: `Assigned query ${text(record.queryNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "assigned", department: task.department },
  });
  return { id: options.id, record: next, extra: { task: taskRecord } };
}

export async function submitQueryResponse(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.queries,
    id: options.id,
    next: "submitted",
    map: QUERY_TRANSITIONS,
    permission: "raQuery:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "QUERY_SUBMITTED",
    extra: { responseDate: new Date().toISOString() },
    label: "Query",
  });
}

export async function closeQuery(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.queries,
    id: options.id,
    next: "closed",
    map: QUERY_TRANSITIONS,
    permission: "raQuery:close",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "QUERY_CLOSED",
    label: "Query",
  });
}

export async function createCommitment(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raCommitment:create");
  const data = parseOrFail(commitmentSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("COM", options.session, options.idToken);
  const record = {
    commitmentId: id,
    commitmentNumber: numbered.documentNumber,
    completionDate: "",
    status: data.status || "open",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.sourceType, data.description),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.commitments, id, record, { exists: false })], options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "COMMITMENT_CREATED",
    resource: RA_COLLECTIONS.commitments,
    resourceId: id,
    description: `Created commitment ${numbered.documentNumber}.`,
    newData: { sourceType: data.sourceType },
  });
  return { id, record };
}

export async function completeCommitment(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.commitments,
    id: options.id,
    next: "completed",
    map: COMMITMENT_TRANSITIONS,
    permission: "raCommitment:close",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "COMMITMENT_COMPLETED",
    extra: { completionDate: new Date().toISOString() },
    label: "Commitment",
  });
}

export async function createRegulatoryCommunication(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raCommunication:create");
  const data = parseOrFail(communicationSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("MSG", options.session, options.idToken);
  const record = {
    communicationId: id,
    communicationNumber: numbered.documentNumber,
    status: "logged",
    date: data.date || new Date().toISOString(),
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.subject, data.authorityId),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.communications, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createCustomerRequirement(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raProduct:update");
  const data = parseOrFail(requirementSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    requirementId: id,
    status: data.status || "active",
    ...data,
    searchIndex: searchIndex(data.customerId, data.productId, data.marketId, data.requirementType),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.requirements, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createArtworkReview(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raArtwork:create");
  const data = parseOrFail(artworkSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("ART", options.session, options.idToken);
  const record = {
    artworkId: id,
    artworkNumber: numbered.documentNumber,
    version: data.version || "1",
    approvedDate: "",
    reviewer: "",
    status: data.status || "draft",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.customerId),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.artworks, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function approveArtwork(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.artworks,
    id: options.id,
    next: "approved",
    map: ARTWORK_TRANSITIONS,
    permission: "raArtwork:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "ARTWORK_APPROVED",
    extra: { approvedDate: new Date().toISOString(), reviewer: options.session.uid },
    label: "Artwork",
  });
}

export async function createRegulatoryChange(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "raRegulatoryChange:create");
  const data = parseOrFail(changeSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueRaNumber("CHG", options.session, options.idToken);
  const record = {
    regulatoryChangeId: id,
    changeNumber: numbered.documentNumber,
    status: data.status || "new_requirement",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.title),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(RA_COLLECTIONS.changes, id, record, { exists: false })], options.idToken);
  await auditRa(options.idToken, options.session, {
    action: "REGULATORY_CHANGE_CREATED",
    resource: RA_COLLECTIONS.changes,
    resourceId: id,
    description: `Created regulatory change ${numbered.documentNumber}.`,
    newData: { title: data.title },
  });
  await notifyRa(options.idToken, options.session, {
    type: "regulatory_change",
    title: "Regulatory change requires assessment",
    message: `${numbered.documentNumber}: ${data.title}`,
    resource: RA_COLLECTIONS.changes,
    resourceId: id,
    audienceRoles: ["regulatory", "qa"],
  });
  return { id, record };
}

export async function approveRegulatoryChange(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: RA_COLLECTIONS.changes,
    id: options.id,
    next: "closed",
    map: CHANGE_TRANSITIONS,
    permission: "raRegulatoryChange:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "REGULATORY_CHANGE_APPROVED",
    label: "Regulatory change",
  });
}

export async function advanceRaRecord(options: {
  collection: string;
  id: string;
  action: string;
  next: string;
  map: Record<string, string[]>;
  permission: Permission;
  session: SessionPayload;
  idToken: string;
  comment?: string;
}) {
  return advance({ ...options, label: "Record" });
}

export async function updateMasterLike(options: {
  collection: string;
  id: string;
  permission: Permission;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  label: string;
}) {
  ensurePermission(options.session, options.permission);
  const record = await requireRecord(options.collection, options.id, options.idToken, options.label);
  const next = { ...record, ...options.payload, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

async function advance(options: {
  collection: string;
  id: string;
  next: string;
  map: Record<string, string[]>;
  permission: Permission;
  session: SessionPayload;
  idToken: string;
  comment?: string;
  audit?: string;
  extra?: Record<string, unknown>;
  label: string;
}) {
  ensurePermission(options.session, options.permission);
  const record = await requireRecord(options.collection, options.id, options.idToken, options.label);
  if (!canTransition(options.map, text(record.status), options.next)) workflowFail(text(record.status), options.next);
  const next: Record<string, unknown> = {
    ...record,
    ...options.extra,
    status: options.next,
    approvalSignature: electronicSignature(options.session, options.next, options.comment),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  if (options.audit) {
    await auditRa(options.idToken, options.session, {
      action: options.audit,
      resource: options.collection,
      resourceId: options.id,
      description: `${options.label} moved to ${options.next}.`,
      oldData: { status: record.status },
      newData: { status: options.next },
      reason: options.comment,
    });
  }
  return { id: options.id, record: next };
}

export {
  ARTWORK_TRANSITIONS,
  CHANGE_TRANSITIONS,
  COMMITMENT_TRANSITIONS,
  DOCUMENT_TRANSITIONS,
  LICENSE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUERY_TRANSITIONS,
  REGISTRATION_TRANSITIONS,
  RENEWAL_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
};

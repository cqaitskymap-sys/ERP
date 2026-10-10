import { QA_COLLECTIONS } from "@/lib/qa/collections";
import { HR_COLLECTIONS } from "@/lib/hr/collections";
import { sanitizeMasterRecord } from "@/lib/masters/firestore";
import { DOCUMENT_TYPE_DEFAULTS, DEFAULT_DMS_SETTINGS, DMS_MAX_FILE_BYTES } from "@/lib/dms/config";
import { DMS_COLLECTIONS } from "@/lib/dms/collections";
import {
  applyPeriodicDecision,
  approvalProgress,
  assertExpectedStatus,
  buildVersionStoragePath,
  bumpVersion,
  diffLines,
  diffMetadata,
  formatVersion,
  isSha256,
  releaseBlockers,
  retentionUntil,
  reviewDueState,
  selfApprovalBlock,
  validateFileMeta,
  versionContentLocked,
} from "@/lib/dms/lifecycle";
import {
  actorStamp,
  assertSignature,
  auditDms,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueDmsNumber,
  issueSeriesNumber,
  listByField,
  notifyDms,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  searchIndex,
  splitList,
  text,
  today,
  writeOf,
} from "@/lib/dms/helpers";
import { canTransition, isContentEditable } from "@/lib/dms/status";
import {
  assignTrainingSchema,
  changeRequestSchema,
  documentCreateSchema,
  documentUpdateSchema,
  externalDocumentSchema,
  fileConfirmSchema,
  filePrepareSchema,
  periodicReviewSchema,
  reviseSchema,
  settingsSchema,
  templateSchema,
} from "@/lib/validation/dms";
import type { SessionPayload } from "@/types/auth";
import type { MasterRecord } from "@/lib/masters/firestore";

const COMPARE_KEYS = [
  "title",
  "description",
  "documentType",
  "category",
  "departmentId",
  "siteId",
  "ownerId",
  "confidentiality",
  "changeSummary",
  "status",
  "versionLabel",
];

function clean(record: MasterRecord | Record<string, unknown>) {
  return sanitizeMasterRecord(record);
}

function updateTime(record: MasterRecord) {
  return record._updateTime ? String(record._updateTime) : undefined;
}

export async function loadDmsSettings(idToken: string) {
  const stored = await requireRecord(DMS_COLLECTIONS.settings, "default", idToken, "DMS settings").catch(() => null);
  return { ...DEFAULT_DMS_SETTINGS, ...(stored || {}), id: "default" };
}

async function typePolicy(documentType: string, idToken: string, settings: Record<string, unknown>) {
  const fallback = DOCUMENT_TYPE_DEFAULTS[documentType] || DOCUMENT_TYPE_DEFAULTS.other;
  const templates = await listByField(DMS_COLLECTIONS.templates, "documentType", documentType, idToken, 5).catch(
    () => [] as MasterRecord[]
  );
  const template = templates.find((row) => text(row.status) === "active") || templates[0];
  return {
    prefix: text(template?.prefix) || fallback.prefix,
    reviewIntervalDays: Number(template?.reviewIntervalDays || fallback.reviewIntervalDays || settings.defaultReviewIntervalDays),
    trainingRequired: Boolean(template?.trainingRequired ?? fallback.trainingRequired),
    gmp: Boolean(template?.gmpDefault ?? fallback.gmp),
    requiredApprovals: Number(template?.requiredApprovals || settings.requiredApprovals || 1),
    requireReview: template?.requireReview === undefined ? Boolean(settings.requireReviewBeforeApproval) : Boolean(template.requireReview),
    templateId: text(template?.id),
  };
}

function versionShell(input: {
  id: string;
  documentId: string;
  documentNumber: string;
  major: number;
  minor: number;
  status: string;
  predecessorVersionId: string;
  changeSummary: string;
  snapshot: Record<string, unknown>;
  session: SessionPayload;
}) {
  const versionLabel = formatVersion(input.major, input.minor);
  return {
    versionId: input.id,
    documentId: input.documentId,
    documentNumber: input.documentNumber,
    major: input.major,
    minor: input.minor,
    versionLabel,
    revision: versionLabel,
    status: input.status,
    predecessorVersionId: input.predecessorVersionId,
    changeSummary: input.changeSummary,
    storagePath: "",
    fileName: "",
    contentType: "",
    sizeBytes: 0,
    checksumSha256: "",
    pendingUpload: {},
    textExtract: text(input.snapshot.textExtract),
    metadataSnapshot: input.snapshot,
    effectiveDate: "",
    approvedAt: "",
    releasedAt: "",
    searchIndex: searchIndex(input.documentNumber, versionLabel, input.changeSummary),
    ...actorStamp(input.session),
  };
}

export async function createControlledDocument(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsDocument:create");
  const data = parseOrFail(documentCreateSchema, options.payload);
  const reused = await reuseIdempotent(text(data.idempotencyKey), options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  const settings = await loadDmsSettings(options.idToken);
  const policy = await typePolicy(data.documentType, options.idToken, settings);
  const numbered = await issueDmsNumber(
    { documentType: `DMS-${policy.prefix}`, prefix: policy.prefix },
    options.session,
    options.idToken
  );
  const duplicates = await listByField(
    DMS_COLLECTIONS.documents,
    "documentNumber",
    numbered.documentNumber,
    options.idToken,
    2
  ).catch(() => []);
  if (duplicates.length) fail("That document number is already in use. Retry so a new number can be issued.");

  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const snapshot = {
    title: data.title,
    description: data.description || "",
    documentType: data.documentType,
    category: data.category || "",
    confidentiality: data.confidentiality,
    textExtract: data.textExtract || "",
  };
  const version = versionShell({
    id: versionId,
    documentId,
    documentNumber: numbered.documentNumber,
    major: 1,
    minor: 0,
    status: "draft",
    predecessorVersionId: "",
    changeSummary: data.changeSummary || "Initial draft",
    snapshot,
    session: options.session,
  });
  const record = {
    documentId,
    documentNumber: numbered.documentNumber,
    title: data.title,
    description: data.description || "",
    documentType: data.documentType,
    category: data.category || "",
    departmentId: data.departmentId || "",
    siteId: data.siteId || "",
    ownerId: data.ownerId || options.session.uid,
    authorId: options.session.uid,
    reviewerId: data.reviewerId || "",
    approverId: data.approverId || "",
    confidentiality: data.confidentiality,
    status: "draft",
    currentVersionId: versionId,
    effectiveVersionId: "",
    effectiveVersionLabel: "",
    currentVersionLabel: version.versionLabel,
    reviewIntervalDays: data.reviewIntervalDays || policy.reviewIntervalDays,
    nextReviewDate: "",
    effectiveDate: "",
    trainingRequired: policy.trainingRequired || data.documentType === "sop",
    trainingCourseId: data.trainingCourseId || "",
    trainingImpactStatus: "",
    relatedProducts: splitList(data.relatedProducts),
    relatedProcesses: splitList(data.relatedProcesses),
    relatedEquipment: splitList(data.relatedEquipment),
    relatedMaterials: splitList(data.relatedMaterials),
    relatedDepartments: splitList(data.relatedDepartments),
    changeControlId: data.changeControlId || "",
    deviationId: data.deviationId || "",
    capaId: data.capaId || "",
    validationRef: data.validationRef || "",
    batchRef: data.batchRef || "",
    templateId: policy.templateId,
    requiredApprovals: policy.requiredApprovals,
    requireReview: policy.requireReview,
    gmp: policy.gmp,
    searchIndex: searchIndex(numbered.documentNumber, data.title, data.documentType, data.departmentId),
    ...actorStamp(options.session),
  };
  const writes = [
    writeOf(DMS_COLLECTIONS.documents, documentId, record, { exists: false }),
    writeOf(DMS_COLLECTIONS.versions, versionId, version, { exists: false }),
  ];
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(text(data.idempotencyKey), { id: documentId, record }, options.session));
  }
  await commitWrites(writes, options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "DOCUMENT_CREATED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: documentId,
    description: `Created controlled document ${numbered.documentNumber} as draft ${version.versionLabel}.`,
    newData: { documentNumber: numbered.documentNumber, status: "draft", versionLabel: version.versionLabel },
  });
  return { id: documentId, record };
}

export async function updateControlledDocument(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsDocument:update");
  const data = parseOrFail(documentUpdateSchema, options.payload);
  const current = await requireRecord(DMS_COLLECTIONS.documents, options.id, options.idToken, "Document");
  const version = await requireRecord(
    DMS_COLLECTIONS.versions,
    text(current.currentVersionId),
    options.idToken,
    "Current version"
  );
  if (!isContentEditable(text(current.status)) || versionContentLocked(text(version.status))) {
    fail("Approved and effective versions cannot be edited. Create a controlled revision.");
  }
  const next = {
    ...clean(current),
    title: data.title ?? current.title,
    description: data.description ?? current.description,
    category: data.category ?? current.category,
    departmentId: data.departmentId ?? current.departmentId,
    siteId: data.siteId ?? current.siteId,
    ownerId: data.ownerId ?? current.ownerId,
    reviewerId: data.reviewerId ?? current.reviewerId,
    approverId: data.approverId ?? current.approverId,
    confidentiality: data.confidentiality ?? current.confidentiality,
    documentNumber: current.documentNumber,
    authorId: current.authorId,
    status: current.status,
    currentVersionId: current.currentVersionId,
    effectiveVersionId: current.effectiveVersionId,
    searchIndex: searchIndex(current.documentNumber, data.title ?? current.title, current.documentType, data.departmentId ?? current.departmentId),
    ...actorStamp(options.session, current),
  };
  const nextVersion = {
    ...clean(version),
    textExtract: data.textExtract ?? version.textExtract,
    changeSummary: data.changeSummary ?? version.changeSummary,
    metadataSnapshot: {
      ...(typeof version.metadataSnapshot === "object" && version.metadataSnapshot ? version.metadataSnapshot : {}),
      title: next.title,
      description: next.description,
      confidentiality: next.confidentiality,
    },
    storagePath: version.storagePath,
    checksumSha256: version.checksumSha256,
    ...actorStamp(options.session, version),
  };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.documents, options.id, next, { updateTime: updateTime(current) }),
      writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "DOCUMENT_UPDATED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `Updated draft metadata for ${text(current.documentNumber)}.`,
    oldData: { title: current.title, confidentiality: current.confidentiality },
    newData: { title: next.title, confidentiality: next.confidentiality },
  });
  return { id: options.id, record: next };
}

export async function reviseControlledDocument(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsDocument:update");
  const data = parseOrFail(reviseSchema, options.payload);
  const settings = await loadDmsSettings(options.idToken);
  assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation));
  const current = await requireRecord(DMS_COLLECTIONS.documents, options.id, options.idToken, "Document");
  if (!text(current.effectiveVersionId) || text(current.status) !== "effective") {
    fail("A new controlled version can only be opened from the currently effective document.");
  }
  const conflict = assertExpectedStatus(text(current.status), ["effective"]);
  if (conflict) fail(conflict);
  const predecessor = await requireRecord(
    DMS_COLLECTIONS.versions,
    text(current.effectiveVersionId),
    options.idToken,
    "Effective version"
  );
  const bumped = bumpVersion(Number(predecessor.major || 1), Number(predecessor.minor || 0), data.revisionType);
  const versionId = crypto.randomUUID();
  const version = versionShell({
    id: versionId,
    documentId: options.id,
    documentNumber: text(current.documentNumber),
    major: bumped.major,
    minor: bumped.minor,
    status: "draft",
    predecessorVersionId: text(predecessor.id),
    changeSummary: data.reason,
    snapshot: {
      title: current.title,
      description: current.description,
      documentType: current.documentType,
      confidentiality: current.confidentiality,
      textExtract: predecessor.textExtract || "",
    },
    session: options.session,
  });
  version.textExtract = text(predecessor.textExtract);
  const next = {
    ...clean(current),
    status: "draft",
    currentVersionId: versionId,
    currentVersionLabel: version.versionLabel,
    effectiveVersionId: current.effectiveVersionId,
    effectiveVersionLabel: current.effectiveVersionLabel,
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.versions, versionId, version, { exists: false }),
      writeOf(DMS_COLLECTIONS.documents, options.id, next, { updateTime: updateTime(current) }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "VERSION_CREATED",
    resource: DMS_COLLECTIONS.versions,
    resourceId: versionId,
    description: `Opened revision ${version.versionLabel} of ${text(current.documentNumber)} because: ${data.reason}`,
    oldData: { effectiveVersionId: current.effectiveVersionId, versionLabel: predecessor.versionLabel },
    newData: { versionId, versionLabel: version.versionLabel, predecessorVersionId: predecessor.id },
    reason: data.reason,
  });
  return { id: options.id, record: next, version };
}

export async function prepareDocumentUpload(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsDocument:update");
  const data = parseOrFail(filePrepareSchema, options.payload);
  if (!isSha256(data.checksumSha256)) fail("A SHA-256 checksum is required before upload.");
  const fileErrors = validateFileMeta({ contentType: data.contentType, sizeBytes: data.sizeBytes, maxBytes: DMS_MAX_FILE_BYTES });
  if (fileErrors.length) fail(fileErrors[0]);
  const current = await requireRecord(DMS_COLLECTIONS.documents, data.documentId, options.idToken, "Document");
  const version = await requireRecord(DMS_COLLECTIONS.versions, data.versionId, options.idToken, "Version");
  if (text(version.documentId) !== data.documentId) fail("That version does not belong to this document.");
  if (versionContentLocked(text(version.status))) fail("This version is locked. Upload the file on a new revision.");
  const storagePath = buildVersionStoragePath(
    text(current.confidentiality),
    data.documentId,
    data.versionId,
    data.fileName
  );
  if (text(version.storagePath) && text(version.storagePath) === storagePath && text(version.checksumSha256)) {
    fail("This version already has a confirmed file. Create a revision instead of replacing it.");
  }
  const pending = {
    storagePath,
    fileName: data.fileName,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    checksumSha256: data.checksumSha256.toLowerCase(),
    preparedBy: options.session.uid,
    preparedAt: new Date().toISOString(),
  };
  const nextVersion = { ...clean(version), pendingUpload: pending, ...actorStamp(options.session, version) };
  await commitWrites(
    [writeOf(DMS_COLLECTIONS.versions, data.versionId, nextVersion, { updateTime: updateTime(version) })],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "FILE_UPLOAD_PREPARED",
    resource: DMS_COLLECTIONS.versions,
    resourceId: data.versionId,
    description: `Authorized upload for ${text(current.documentNumber)} ${text(version.versionLabel)}.`,
    newData: { storagePath, fileName: data.fileName, sizeBytes: data.sizeBytes },
  });
  return { storagePath, maxBytes: DMS_MAX_FILE_BYTES, versionId: data.versionId };
}

export async function confirmDocumentUpload(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsDocument:update");
  const data = parseOrFail(fileConfirmSchema, options.payload);
  const version = await requireRecord(DMS_COLLECTIONS.versions, data.versionId, options.idToken, "Version");
  if (versionContentLocked(text(version.status))) fail("This version is locked.");
  const pending = (version.pendingUpload || {}) as Record<string, unknown>;
  if (text(pending.storagePath) !== data.storagePath) fail("Upload confirmation does not match the authorized path.");
  if (text(pending.checksumSha256) !== data.checksumSha256.toLowerCase()) {
    fail("Checksum does not match the file that was authorized.");
  }
  if (text(version.storagePath) && text(version.checksumSha256) && text(version.storagePath) !== data.storagePath) {
    fail("A confirmed file already exists for this version and will not be overwritten.");
  }
  const nextVersion = {
    ...clean(version),
    storagePath: data.storagePath,
    fileName: data.fileName,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    checksumSha256: data.checksumSha256.toLowerCase(),
    pendingUpload: {},
    fileConfirmedAt: new Date().toISOString(),
    ...actorStamp(options.session, version),
  };
  await commitWrites(
    [writeOf(DMS_COLLECTIONS.versions, data.versionId, nextVersion, { updateTime: updateTime(version) })],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "FILE_CONFIRMED",
    resource: DMS_COLLECTIONS.versions,
    resourceId: data.versionId,
    description: `Confirmed file ${data.fileName} for version ${text(version.versionLabel)}. The download URL is not stored.`,
    newData: { storagePath: data.storagePath, checksumSha256: data.checksumSha256.toLowerCase() },
  });
  return { id: data.versionId, record: nextVersion };
}

export async function authorizeDocumentFile(options: {
  documentId: string;
  versionId: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsDocument:read");
  const current = await requireRecord(DMS_COLLECTIONS.documents, options.documentId, options.idToken, "Document");
  const classification = text(current.confidentiality);
  if ((classification === "confidential" || classification === "restricted") && !options.session.permissions.includes("dmsConfidential:read") && options.session.role !== "super_admin") {
    ensurePermission(options.session, "dmsConfidential:read");
  }
  const version = await requireRecord(DMS_COLLECTIONS.versions, options.versionId, options.idToken, "Version");
  if (text(version.documentId) !== options.documentId) fail("That version does not belong to this document.");
  if (!text(version.storagePath)) fail("This version has no confirmed file.");
  await auditDms(options.idToken, options.session, {
    action: "FILE_ACCESS",
    resource: DMS_COLLECTIONS.versions,
    resourceId: options.versionId,
    description: `Authorized ${text(version.fileName) || "file"} access for ${text(current.documentNumber)} ${text(version.versionLabel)}.`,
    newData: { storagePath: version.storagePath, versionLabel: version.versionLabel },
  });
  return {
    storagePath: text(version.storagePath),
    fileName: text(version.fileName),
    contentType: text(version.contentType),
    checksumSha256: text(version.checksumSha256),
    versionLabel: text(version.versionLabel),
    previewable: ["application/pdf", "image/jpeg", "image/png"].includes(text(version.contentType)),
  };
}

async function reviewsForVersion(versionId: string, idToken: string) {
  const rows = await listByField(DMS_COLLECTIONS.reviews, "versionId", versionId, idToken, 50).catch(() => []);
  return rows;
}

async function approvalsForVersion(versionId: string, idToken: string) {
  return listByField(DMS_COLLECTIONS.approvals, "versionId", versionId, idToken, 20).catch(() => []);
}

export async function transitionControlledDocument(options: {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(DMS_COLLECTIONS.documents, options.id, options.idToken, "Document");
  const version = await requireRecord(
    DMS_COLLECTIONS.versions,
    text(current.currentVersionId),
    options.idToken,
    "Current version"
  );
  const settings = await loadDmsSettings(options.idToken);
  const action = options.action;
  const reason = text(options.payload.reason || options.payload.comment);

  if (action === "submit") {
    ensurePermission(options.session, "dmsDocument:submit");
    if (!canTransition({ draft: ["in_review"], changes_requested: ["in_review"] }, text(current.status), "in_review")) {
      fail(`Cannot submit a record in "${text(current.status)}" status.`);
    }
    if (!text(version.storagePath)) fail("Confirm the controlled file before submitting for review.");
    return writeStatus(current, version, "in_review", options, "DOCUMENT_SUBMITTED", reason);
  }

  if (action === "request_changes" || action === "reject" || action === "recommend") {
    ensurePermission(options.session, action === "reject" ? "dmsReview:reject" : "dmsReview:review");
    if (text(current.status) !== "in_review") fail(`Cannot ${action} a record in "${text(current.status)}" status.`);
    if (Boolean(settings.segregationOfDuties) && text(current.authorId) === options.session.uid) {
      fail("The author cannot review their own document when segregation of duties is required.");
    }
    if (text(current.reviewerId) && text(current.reviewerId) !== options.session.uid) {
      fail("This document is assigned to a different reviewer.");
    }
    assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation));
    const decision = action === "recommend" ? "recommend_approve" : action === "request_changes" ? "changes_requested" : "rejected";
    const nextStatus = action === "recommend" ? "in_review" : action === "request_changes" ? "changes_requested" : "rejected";
    const reviewId = crypto.randomUUID();
    const signature = electronicSignature(options.session, {
      meaning: decision,
      reason,
      documentNumber: text(current.documentNumber),
      versionLabel: text(version.versionLabel),
      stage: text(current.status),
    });
    const review = {
      reviewId,
      documentId: options.id,
      versionId: text(version.id),
      documentNumber: current.documentNumber,
      versionLabel: version.versionLabel,
      decision,
      reason,
      signature,
      status: "recorded",
      searchIndex: searchIndex(current.documentNumber, version.versionLabel, decision),
      ...actorStamp(options.session),
    };
    const nextDoc = { ...clean(current), status: nextStatus, ...actorStamp(options.session, current) };
    const nextVersion = { ...clean(version), status: nextStatus, ...actorStamp(options.session, version) };
    await commitWrites(
      [
        writeOf(DMS_COLLECTIONS.reviews, reviewId, review, { exists: false }),
        writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
        writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
      ],
      options.idToken
    );
    await auditDms(options.idToken, options.session, {
      action: "DOCUMENT_REVIEWED",
      resource: DMS_COLLECTIONS.reviews,
      resourceId: reviewId,
      description: `Review decision ${decision} on ${text(current.documentNumber)} ${text(version.versionLabel)}.`,
      reason,
      newData: { decision, versionLabel: version.versionLabel },
    });
    await notifyDms(options.idToken, options.session, {
      type: "dms_review",
      title: `Document review ${decision.replaceAll("_", " ")}`,
      message: `${text(current.documentNumber)} ${text(version.versionLabel)}: ${reason}`,
      resource: DMS_COLLECTIONS.documents,
      resourceId: options.id,
      severity: action === "reject" ? "warning" : "info",
      audienceRoles: ["qa", "department_head"],
    });
    return { id: options.id, record: nextDoc };
  }

  if (action === "approve") {
    ensurePermission(options.session, "dmsApproval:approve");
    if (text(current.status) !== "in_review") fail(`Cannot approve a record in "${text(current.status)}" status.`);
    const block = selfApprovalBlock(text(current.authorId), options.session.uid, Boolean(settings.segregationOfDuties));
    if (block) fail(block);
    if (text(current.approverId) && text(current.approverId) !== options.session.uid) {
      fail("This document is assigned to a different approver.");
    }
    assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation));
    const reviews = await reviewsForVersion(text(version.id), options.idToken);
    const reviewAccepted = reviews.some((row) => text(row.decision) === "recommend_approve");
    if (Boolean(current.requireReview) && !reviewAccepted) {
      fail("A reviewer must recommend approval before this document can be approved.");
    }
    const existing = await approvalsForVersion(text(version.id), options.idToken);
    if (existing.some((row) => text(row.signedBy) === options.session.uid)) {
      fail("You have already approved this version.");
    }
    const progress = approvalProgress(existing.length, Number(current.requiredApprovals || settings.requiredApprovals || 1));
    const nextStatus = progress.complete ? "approved" : "in_review";
    const approvalId = crypto.randomUUID();
    const signature = electronicSignature(options.session, {
      meaning: "approved",
      reason,
      documentNumber: text(current.documentNumber),
      versionLabel: text(version.versionLabel),
      stage: "approval",
    });
    const approval = {
      approvalId,
      documentId: options.id,
      versionId: version.id,
      documentNumber: current.documentNumber,
      versionLabel: version.versionLabel,
      meaning: "approved",
      reason,
      signedBy: options.session.uid,
      signature,
      status: "recorded",
      searchIndex: searchIndex(current.documentNumber, version.versionLabel, "approved"),
      ...actorStamp(options.session),
    };
    const nextDoc = {
      ...clean(current),
      status: nextStatus,
      approvedAt: progress.complete ? new Date().toISOString() : current.approvedAt || "",
      ...actorStamp(options.session, current),
    };
    const nextVersion = {
      ...clean(version),
      status: nextStatus,
      approvedAt: nextDoc.approvedAt,
      approvedSnapshot: clean(version),
      ...actorStamp(options.session, version),
    };
    await commitWrites(
      [
        writeOf(DMS_COLLECTIONS.approvals, approvalId, approval, { exists: false }),
        writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
        writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
      ],
      options.idToken
    );
    await auditDms(options.idToken, options.session, {
      action: "DOCUMENT_APPROVED",
      resource: DMS_COLLECTIONS.approvals,
      resourceId: approvalId,
      description: `Approval ${progress.count}/${progress.required} recorded for ${text(current.documentNumber)} ${text(version.versionLabel)}.`,
      reason,
      newData: { status: nextStatus, signatureReference: signature.signatureReference },
    });
    return { id: options.id, record: nextDoc };
  }

  if (action === "release") return releaseDocument(current, version, settings, options);
  if (action === "withdraw") return endDocument(current, version, "withdrawn", ["approved", "effective"], "dmsDocument:cancel", options);
  if (action === "cancel") return endDocument(current, version, "cancelled", ["draft", "changes_requested", "in_review", "rejected"], "dmsDocument:cancel", options);
  if (action === "archive") return archiveDocument(current, version, settings, options);
  if (action === "restore") return restoreDocument(current, version, options);

  fail(`Unsupported document action "${action}".`);
}

async function writeStatus(
  current: MasterRecord,
  version: MasterRecord,
  status: string,
  options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string },
  auditAction: string,
  reason: string
) {
  const nextDoc = { ...clean(current), status, ...actorStamp(options.session, current) };
  const nextVersion = { ...clean(version), status, ...actorStamp(options.session, version) };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
      writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: auditAction,
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `${text(current.documentNumber)} moved to ${status}.`,
    oldData: { status: current.status },
    newData: { status },
    reason,
  });
  return { id: options.id, record: nextDoc };
}

async function releaseDocument(
  current: MasterRecord,
  version: MasterRecord,
  settings: Record<string, unknown>,
  options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }
) {
  ensurePermission(options.session, "dmsRelease:release");
  const reason = text(options.payload.reason || options.payload.comment);
  assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation));
  const approvals = await approvalsForVersion(text(version.id), options.idToken);
  const reviews = await reviewsForVersion(text(version.id), options.idToken);
  const blockers = releaseBlockers({
    status: text(current.status),
    fileReady: Boolean(text(version.storagePath) && text(version.checksumSha256)),
    requireFile: Boolean(settings.requireFileBeforeRelease),
    approvalCount: approvals.length,
    requiredApprovals: Number(current.requiredApprovals || settings.requiredApprovals || 1),
    reviewAccepted: reviews.some((row) => text(row.decision) === "recommend_approve"),
    requireReview: Boolean(current.requireReview),
    authorId: text(current.authorId),
    actorId: options.session.uid,
    segregation: Boolean(settings.segregationOfDuties),
  });
  if (blockers.length) fail(blockers[0]);
  const effectiveDate = text(options.payload.effectiveDate) || today();
  const writes = [];
  if (text(current.effectiveVersionId) && text(current.effectiveVersionId) !== text(version.id)) {
    const previous = await requireRecord(
      DMS_COLLECTIONS.versions,
      text(current.effectiveVersionId),
      options.idToken,
      "Previous effective version"
    );
    writes.push(
      writeOf(
        DMS_COLLECTIONS.versions,
        text(previous.id),
        {
          ...clean(previous),
          status: "superseded",
          supersededByVersionId: version.id,
          supersededAt: new Date().toISOString(),
          storagePath: previous.storagePath,
          checksumSha256: previous.checksumSha256,
          ...actorStamp(options.session, previous),
        },
        { updateTime: updateTime(previous) }
      )
    );
  }
  const signature = electronicSignature(options.session, {
    meaning: "released",
    reason,
    documentNumber: text(current.documentNumber),
    versionLabel: text(version.versionLabel),
    stage: "release",
  });
  const nextReviewDate = new Date(Date.UTC(
    Number(effectiveDate.slice(0, 4)),
    Number(effectiveDate.slice(5, 7)) - 1,
    Number(effectiveDate.slice(8, 10))
  ));
  nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + Number(current.reviewIntervalDays || settings.defaultReviewIntervalDays));
  const training = await trainingImpact(current, version, options);
  const nextVersion = {
    ...clean(version),
    status: "effective",
    effectiveDate,
    releasedAt: new Date().toISOString(),
    releaseSignature: signature,
    storagePath: version.storagePath,
    ...actorStamp(options.session, version),
  };
  const nextDoc = {
    ...clean(current),
    status: "effective",
    effectiveDate,
    effectiveVersionId: version.id,
    effectiveVersionLabel: version.versionLabel,
    currentVersionId: version.id,
    currentVersionLabel: version.versionLabel,
    nextReviewDate: nextReviewDate.toISOString().slice(0, 10),
    trainingCourseId: training.courseId || current.trainingCourseId || "",
    trainingImpactStatus: training.status,
    releaseSignature: signature,
    ...actorStamp(options.session, current),
  };
  writes.push(
    writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
    writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) })
  );
  await commitWrites(writes, options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "DOCUMENT_RELEASED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `Released ${text(current.documentNumber)} ${text(version.versionLabel)} effective ${effectiveDate}.`,
    oldData: { status: current.status, effectiveVersionId: current.effectiveVersionId },
    newData: { status: "effective", effectiveDate, signatureReference: signature.signatureReference },
    reason,
  });
  await notifyDms(options.idToken, options.session, {
    type: "dms_effective",
    title: `${text(current.documentNumber)} is effective`,
    message: `Version ${text(version.versionLabel)} is effective from ${effectiveDate}. Next review ${nextDoc.nextReviewDate}.`,
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    severity: "info",
    audienceRoles: ["qa", "department_head", "trainer"],
  });
  return { id: options.id, record: nextDoc };
}

async function trainingImpact(
  current: MasterRecord,
  version: MasterRecord,
  options: { session: SessionPayload; idToken: string }
) {
  const required = Boolean(current.trainingRequired) || ["sop", "work_instruction", "procedure", "training"].includes(text(current.documentType));
  if (!required) return { status: "not_required", courseId: text(current.trainingCourseId) };
  const courses = await listByField(HR_COLLECTIONS.trainingCourses, "documentRef", text(current.documentNumber), options.idToken, 10).catch(
    () => [] as MasterRecord[]
  );
  const matched = courses.find((row) => text(row.status) !== "inactive");
  if (!matched) {
    return { status: "retraining_required", courseId: "" };
  }
  return { status: "retraining_required", courseId: text(matched.id) };
}

export async function assignDocumentTraining(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "training:create");
  const data = parseOrFail(assignTrainingSchema, options.payload);
  const current = await requireRecord(DMS_COLLECTIONS.documents, options.id, options.idToken, "Document");
  if (!text(current.effectiveVersionId)) fail("Training is linked to an effective SOP version. Release the document first.");
  const version = await requireRecord(DMS_COLLECTIONS.versions, text(current.effectiveVersionId), options.idToken, "Effective version");
  let courseId = text(current.trainingCourseId);
  if (!courseId) {
    courseId = crypto.randomUUID();
    const course = {
      courseId,
      code: `${text(current.documentNumber)}-V${text(version.versionLabel)}`.slice(0, 40),
      title: text(current.title),
      category: "sop",
      mandatory: true,
      validityDays: Number(current.reviewIntervalDays || 730),
      documentRef: text(current.documentNumber),
      sopDocumentId: options.id,
      sopVersionId: version.id,
      sopVersionLabel: version.versionLabel,
      status: "active",
      searchIndex: searchIndex(current.documentNumber, current.title, version.versionLabel),
      ...actorStamp(options.session),
    };
    await commitWrites([writeOf(HR_COLLECTIONS.trainingCourses, courseId, course, { exists: false })], options.idToken);
  }
  const writes = data.employeeIds.map((employeeId) => {
    const id = crypto.randomUUID();
    return writeOf(
      HR_COLLECTIONS.trainingAssignments,
      id,
      {
        assignmentId: id,
        assignmentNumber: "",
        employeeId,
        courseId,
        dueDate: data.dueDate || "",
        departmentId: text(current.departmentId),
        notes: data.reason,
        status: "assigned",
        completionId: "",
        sopDocumentId: options.id,
        sopVersionId: version.id,
        sopVersionLabel: version.versionLabel,
        documentNumber: current.documentNumber,
        searchIndex: searchIndex(current.documentNumber, employeeId, version.versionLabel),
        ...actorStamp(options.session),
      },
      { exists: false }
    );
  });
  await commitWrites(writes, options.idToken);
  const next = {
    ...clean(current),
    trainingCourseId: courseId,
    trainingImpactStatus: "assigned",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(DMS_COLLECTIONS.documents, options.id, next, { updateTime: updateTime(current) })], options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "TRAINING_ASSIGNED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `Assigned retraining for ${text(current.documentNumber)} ${text(version.versionLabel)} to ${data.employeeIds.length} employee(s). Completion still requires LMS evidence.`,
    newData: { courseId, versionId: version.id, employees: data.employeeIds.length },
    reason: data.reason,
  });
  return { id: options.id, record: next };
}

async function endDocument(
  current: MasterRecord,
  version: MasterRecord,
  status: string,
  from: string[],
  permission: "dmsDocument:cancel",
  options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }
) {
  ensurePermission(options.session, permission);
  const settings = await loadDmsSettings(options.idToken);
  const reason = text(options.payload.reason || options.payload.comment);
  if (reason.length < 3) fail("A reason is required.");
  assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation));
  const conflict = assertExpectedStatus(text(current.status), from);
  if (conflict) fail(conflict);
  const signature = electronicSignature(options.session, {
    meaning: status,
    reason,
    documentNumber: text(current.documentNumber),
    versionLabel: text(version.versionLabel),
    stage: status,
  });
  const nextDoc = {
    ...clean(current),
    status,
    effectiveVersionId: status === "withdrawn" ? "" : current.effectiveVersionId,
    effectiveVersionLabel: status === "withdrawn" ? "" : current.effectiveVersionLabel,
    withdrawalSignature: signature,
    ...actorStamp(options.session, current),
  };
  const nextVersion = { ...clean(version), status, ...actorStamp(options.session, version) };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
      writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: status === "withdrawn" ? "DOCUMENT_WITHDRAWN" : "DOCUMENT_CANCELLED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `${text(current.documentNumber)} ${status}.`,
    oldData: { status: current.status },
    newData: { status },
    reason,
  });
  return { id: options.id, record: nextDoc };
}

async function archiveDocument(
  current: MasterRecord,
  version: MasterRecord,
  settings: Record<string, unknown>,
  options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }
) {
  ensurePermission(options.session, "dmsDocument:close");
  const reason = text(options.payload.reason || options.payload.comment);
  if (!["superseded", "withdrawn", "cancelled", "rejected"].includes(text(current.status))) {
    fail("Only superseded, withdrawn, cancelled, or rejected documents can be archived.");
  }
  if (reason.length < 3) fail("A reason is required.");
  const retentionId = crypto.randomUUID();
  const retainUntil = retentionUntil(today(), Number(settings.retentionYears || 10));
  const retention = {
    retentionId,
    documentId: options.id,
    documentNumber: current.documentNumber,
    versionId: version.id,
    archivedAt: new Date().toISOString(),
    retainUntil,
    reason,
    status: "retained",
    searchIndex: searchIndex(current.documentNumber, "archived"),
    ...actorStamp(options.session),
  };
  const nextDoc = { ...clean(current), status: "archived", ...actorStamp(options.session, current) };
  const nextVersion = { ...clean(version), status: "archived", ...actorStamp(options.session, version) };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.retention, retentionId, retention, { exists: false }),
      writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
      writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "DOCUMENT_ARCHIVED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `Archived ${text(current.documentNumber)}. Retain until ${retainUntil}. The record was not deleted.`,
    reason,
    newData: { status: "archived", retainUntil },
  });
  return { id: options.id, record: nextDoc };
}

async function restoreDocument(
  current: MasterRecord,
  version: MasterRecord,
  options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }
) {
  ensurePermission(options.session, "dmsDocument:reopen");
  const reason = text(options.payload.reason || options.payload.comment);
  if (!["archived", "rejected"].includes(text(current.status))) {
    fail("Only archived or rejected documents can be restored to draft.");
  }
  if (reason.length < 3) fail("A reason is required.");
  const nextDoc = { ...clean(current), status: "draft", ...actorStamp(options.session, current) };
  const nextVersion = { ...clean(version), status: "draft", ...actorStamp(options.session, version) };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.documents, options.id, nextDoc, { updateTime: updateTime(current) }),
      writeOf(DMS_COLLECTIONS.versions, text(version.id), nextVersion, { updateTime: updateTime(version) }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "DOCUMENT_RESTORED",
    resource: DMS_COLLECTIONS.documents,
    resourceId: options.id,
    description: `Restored ${text(current.documentNumber)} to draft. It is not effective.`,
    reason,
    oldData: { status: current.status },
    newData: { status: "draft" },
  });
  return { id: options.id, record: nextDoc };
}

export async function compareDocumentVersions(options: {
  id: string;
  leftId: string;
  rightId: string;
  idToken: string;
}) {
  const left = await requireRecord(DMS_COLLECTIONS.versions, options.leftId, options.idToken, "Version");
  const right = await requireRecord(DMS_COLLECTIONS.versions, options.rightId, options.idToken, "Version");
  if (text(left.documentId) !== options.id || text(right.documentId) !== options.id) {
    fail("Both versions must belong to this document.");
  }
  const leftSnap = (left.metadataSnapshot || left) as Record<string, unknown>;
  const rightSnap = (right.metadataSnapshot || right) as Record<string, unknown>;
  const textDiff = text(left.textExtract) || text(right.textExtract)
    ? diffLines(text(left.textExtract), text(right.textExtract))
    : [];
  return {
    metadata: diffMetadata(leftSnap, rightSnap, COMPARE_KEYS),
    textDiff,
    limitation: textDiff.length
      ? "Text comparison uses the stored text extract, not a rendered PDF."
      : "No text extract is stored for these versions, so only metadata is compared.",
    left: { id: left.id, versionLabel: left.versionLabel, status: left.status },
    right: { id: right.id, versionLabel: right.versionLabel, status: right.status },
  };
}

export async function createDocumentChangeRequest(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsChangeRequest:create");
  const data = parseOrFail(changeRequestSchema, options.payload);
  const reused = await reuseIdempotent(text(data.idempotencyKey), options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  if (data.documentId) await requireRecord(DMS_COLLECTIONS.documents, data.documentId, options.idToken, "Document");
  const numbered = await issueSeriesNumber("DCR", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    changeRequestId: id,
    requestNumber: numbered.documentNumber,
    ...data,
    affectedDepartments: splitList(data.affectedDepartments),
    affectedProducts: splitList(data.affectedProducts),
    affectedProcesses: splitList(data.affectedProcesses),
    affectedEquipment: splitList(data.affectedEquipment),
    relatedDocuments: splitList(data.relatedDocuments),
    status: "draft",
    changeControlStatusUnchanged: true,
    searchIndex: searchIndex(numbered.documentNumber, data.title, data.requestType, data.documentId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(DMS_COLLECTIONS.changeRequests, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(text(data.idempotencyKey), { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "DCR_CREATED",
    resource: DMS_COLLECTIONS.changeRequests,
    resourceId: id,
    description: `Created document change request ${numbered.documentNumber}.`,
    newData: { requestType: data.requestType, documentId: data.documentId || "" },
  });
  return { id, record };
}

export async function transitionChangeRequest(options: {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(DMS_COLLECTIONS.changeRequests, options.id, options.idToken, "Change request");
  const reason = text(options.payload.reason || options.payload.comment);
  const settings = await loadDmsSettings(options.idToken);
  const map: Record<string, { from: string; to: string; permission: "dmsChangeRequest:submit" | "dmsChangeRequest:approve" | "dmsChangeRequest:reject" | "dmsChangeRequest:update" | "dmsChangeRequest:close" }> = {
    submit: { from: "draft", to: "submitted", permission: "dmsChangeRequest:submit" },
    review: { from: "submitted", to: "in_review", permission: "dmsChangeRequest:approve" },
    approve: { from: "in_review", to: "approved", permission: "dmsChangeRequest:approve" },
    reject: { from: "in_review", to: "rejected", permission: "dmsChangeRequest:reject" },
    implement: { from: "approved", to: "in_implementation", permission: "dmsChangeRequest:update" },
    close: { from: "in_implementation", to: "closed", permission: "dmsChangeRequest:close" },
    cancel: { from: text(current.status), to: "cancelled", permission: "dmsChangeRequest:update" },
  };
  const step = map[options.action];
  if (!step) fail(`Unsupported change request action "${options.action}".`);
  ensurePermission(options.session, step.permission);
  if (options.action !== "cancel" && text(current.status) !== step.from) {
    fail(`Cannot ${options.action} a change request in "${text(current.status)}" status.`);
  }
  if (["approve", "reject", "close", "cancel", "implement"].includes(options.action)) {
    if (reason.length < 3) fail("A reason is required.");
    assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation) && options.action !== "implement");
  }
  if (options.action === "approve" && Boolean(current.gmpImpact)) {
    if (text(current.impactAssessment).length < 3 && text(options.payload.impactAssessment).length < 3) {
      fail("GMP changes require a documented impact assessment before approval.");
    }
    const changeControlId = text(options.payload.changeControlId || current.changeControlId);
    if (!changeControlId) fail("Link an existing change control before approving a GMP document change.");
    await requireRecord(QA_COLLECTIONS.changes, changeControlId, options.idToken, "Change control");
  }
  if (options.action === "cancel" && ["closed", "cancelled"].includes(text(current.status))) {
    fail("This change request is already finished.");
  }
  if (options.action === "close") {
    await assertChangeRequestReadyToClose(
      { ...current, documentId: text(options.payload.documentId || current.documentId) },
      options.idToken
    );
  }
  let implementation: Record<string, unknown> = {};
  if (options.action === "implement") {
    implementation = await startChangeImplementation(current, options);
  }
  const next = {
    ...clean(current),
    status: step.to,
    impactAssessment: text(options.payload.impactAssessment || current.impactAssessment),
    changeControlId: text(options.payload.changeControlId || current.changeControlId),
    documentId: text(options.payload.documentId || current.documentId),
    changeControlClosedByDms: false,
    implementation,
    decisionReason: reason,
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [writeOf(DMS_COLLECTIONS.changeRequests, options.id, next, { updateTime: updateTime(current) })],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "DCR_UPDATED",
    resource: DMS_COLLECTIONS.changeRequests,
    resourceId: options.id,
    description: `Change request ${text(current.requestNumber)} moved to ${step.to}. Linked change control records were not closed.`,
    oldData: { status: current.status },
    newData: { status: step.to, changeControlId: next.changeControlId },
    reason,
  });
  return { id: options.id, record: next };
}

async function startChangeImplementation(
  current: MasterRecord,
  options: { session: SessionPayload; idToken: string; payload: Record<string, unknown> }
) {
  const type = text(current.requestType);
  if ((type === "revision" || type === "correction") && text(current.documentId)) {
    const document = await requireRecord(DMS_COLLECTIONS.documents, text(current.documentId), options.idToken, "Document");
    if (text(document.status) === "effective") {
      const revised = await reviseControlledDocument({
        id: text(current.documentId),
        payload: {
          revisionType: "minor",
          reason: text(current.reason),
          signatureEmail: options.session.email,
        },
        session: options.session,
        idToken: options.idToken,
      });
      return { startedRevision: true, versionLabel: revised.version?.versionLabel || "" };
    }
  }
  if (type === "new_document" && !text(current.documentId)) {
    return { startedRevision: false, note: "Create the draft from Document registry. Approval of this request does not make a document effective." };
  }
  if (type === "withdrawal" || type === "retirement") {
    return { startedRevision: false, note: "Withdraw or archive the document through its own authorized workflow." };
  }
  return { startedRevision: false };
}

async function assertChangeRequestReadyToClose(current: MasterRecord, idToken: string) {
  const type = text(current.requestType);
  if (!text(current.documentId) && type !== "new_document") return;
  if (!text(current.documentId)) fail("Link the new document before closing this request.");
  const document = await requireRecord(DMS_COLLECTIONS.documents, text(current.documentId), idToken, "Document");
  if ((type === "revision" || type === "correction") && text(document.status) !== "effective") {
    fail("The revised document is not effective yet. Do not close the request early.");
  }
  if ((type === "withdrawal" || type === "retirement") && !["withdrawn", "archived"].includes(text(document.status))) {
    fail("The document has not been withdrawn or archived.");
  }
}

export async function completePeriodicReview(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsPeriodicReview:review");
  const data = parseOrFail(periodicReviewSchema, options.payload);
  const settings = await loadDmsSettings(options.idToken);
  assertSignature(options.session, options.payload, Boolean(settings.requireSignatureEmailConfirmation));
  const current = await requireRecord(DMS_COLLECTIONS.documents, options.id, options.idToken, "Document");
  if (text(current.status) !== "effective") fail("Periodic review applies to the effective document.");
  const decision = applyPeriodicDecision({
    decision: data.decision,
    reason: data.reason,
    currentNextReview: text(current.nextReviewDate),
    intervalDays: Number(current.reviewIntervalDays || settings.defaultReviewIntervalDays),
    today: today(),
  });
  if (!decision.ok) fail(decision.message);
  const reviewId = crypto.randomUUID();
  const numbered = await issueSeriesNumber("PRV", options.session, options.idToken);
  const signature = electronicSignature(options.session, {
    meaning: "periodic_review",
    reason: data.reason,
    documentNumber: text(current.documentNumber),
    versionLabel: text(current.effectiveVersionLabel),
    stage: "periodic_review",
  });
  const review = {
    periodicReviewId: reviewId,
    reviewNumber: numbered.documentNumber,
    documentId: options.id,
    versionId: current.effectiveVersionId,
    documentNumber: current.documentNumber,
    decision: data.decision,
    reason: data.reason,
    evidenceNote: data.evidenceNote || "",
    previousNextReviewDate: current.nextReviewDate || "",
    nextReviewDate: decision.nextReviewDate,
    signature,
    status: "completed",
    searchIndex: searchIndex(numbered.documentNumber, current.documentNumber, data.decision),
    ...actorStamp(options.session),
  };
  const next = {
    ...clean(current),
    nextReviewDate: decision.nextReviewDate,
    lastPeriodicReviewId: reviewId,
    lastReviewReason: data.reason,
    lastReviewDecision: data.decision,
    status: "effective",
    ...actorStamp(options.session, current),
  };
  const writes = [
    writeOf(DMS_COLLECTIONS.periodicReviews, reviewId, review, { exists: false }),
    writeOf(DMS_COLLECTIONS.documents, options.id, next, { updateTime: updateTime(current) }),
  ];
  if (decision.openChange) {
    const requestNumber = await issueSeriesNumber("DCR", options.session, options.idToken);
    const requestId = crypto.randomUUID();
    writes.push(
      writeOf(
        DMS_COLLECTIONS.changeRequests,
        requestId,
        {
          changeRequestId: requestId,
          requestNumber: requestNumber.documentNumber,
          requestType: data.decision === "retirement_proposed" ? "retirement" : "revision",
          title: `Periodic review ${numbered.documentNumber}`,
          reason: data.reason,
          expectedImpact: data.evidenceNote || data.reason,
          documentId: options.id,
          gmpImpact: Boolean(current.gmp),
          impactAssessment: data.evidenceNote || "",
          changeControlId: text(current.changeControlId),
          status: "submitted",
          changeControlStatusUnchanged: true,
          searchIndex: searchIndex(requestNumber.documentNumber, current.documentNumber, data.decision),
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  await commitWrites(writes, options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "PERIODIC_REVIEW_COMPLETED",
    resource: DMS_COLLECTIONS.periodicReviews,
    resourceId: reviewId,
    description: `Periodic review ${data.decision} for ${text(current.documentNumber)}.`,
    oldData: { nextReviewDate: current.nextReviewDate },
    newData: { nextReviewDate: decision.nextReviewDate, decision: data.decision },
    reason: data.reason,
  });
  return { id: options.id, record: next };
}

export async function createExternalDocument(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsExternal:create");
  const data = parseOrFail(externalDocumentSchema, options.payload);
  const numbered = await issueSeriesNumber("EXT", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    externalDocumentId: id,
    externalNumber: numbered.documentNumber,
    ...data,
    status: "active",
    reminderDays: data.reminderDays || 30,
    searchIndex: searchIndex(numbered.documentNumber, data.title, data.issuer, data.referenceNumber),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(DMS_COLLECTIONS.externalDocuments, id, record, { exists: false })], options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "EXTERNAL_DOCUMENT_CREATED",
    resource: DMS_COLLECTIONS.externalDocuments,
    resourceId: id,
    description: `Registered external document ${numbered.documentNumber}.`,
    newData: { expiryDate: data.expiryDate },
  });
  return { id, record };
}

export async function updateExternalDocument(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsExternal:update");
  const data = parseOrFail(externalDocumentSchema.partial(), options.payload);
  const current = await requireRecord(DMS_COLLECTIONS.externalDocuments, options.id, options.idToken, "External document");
  const next = {
    ...clean(current),
    ...data,
    externalNumber: current.externalNumber,
    status: text(current.status),
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [writeOf(DMS_COLLECTIONS.externalDocuments, options.id, next, { updateTime: updateTime(current) })],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "EXTERNAL_DOCUMENT_UPDATED",
    resource: DMS_COLLECTIONS.externalDocuments,
    resourceId: options.id,
    description: `Updated external document ${text(current.externalNumber)}.`,
    oldData: { expiryDate: current.expiryDate, status: current.status },
    newData: { expiryDate: next.expiryDate, status: next.status },
  });
  return { id: options.id, record: next };
}

export async function saveDmsTemplate(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsNumbering:update");
  const data = parseOrFail(templateSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    templateId: id,
    ...data,
    prefix: data.prefix.toUpperCase(),
    searchIndex: searchIndex(data.prefix, data.label, data.documentType),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(DMS_COLLECTIONS.templates, id, record, { exists: false })], options.idToken);
  await auditDms(options.idToken, options.session, {
    action: "TEMPLATE_SAVED",
    resource: DMS_COLLECTIONS.templates,
    resourceId: id,
    description: `Saved numbering template ${record.prefix} for ${data.documentType}.`,
  });
  return { id, record };
}

export async function saveDmsSettings(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "dmsNumbering:update");
  const data = parseOrFail(settingsSchema, options.payload);
  const existing = await requireRecord(DMS_COLLECTIONS.settings, "default", options.idToken, "Settings").catch(() => null);
  const record = {
    ...(existing ? clean(existing) : {}),
    settingsId: "default",
    ...data,
    ...actorStamp(options.session, existing || undefined),
  };
  await commitWrites(
    [
      writeOf(DMS_COLLECTIONS.settings, "default", record, existing ? { updateTime: updateTime(existing) } : { exists: false }),
    ],
    options.idToken
  );
  await auditDms(options.idToken, options.session, {
    action: "SETTINGS_UPDATED",
    resource: DMS_COLLECTIONS.settings,
    resourceId: "default",
    description: "Updated document control settings.",
    oldData: existing ? { segregationOfDuties: existing.segregationOfDuties } : {},
    newData: { segregationOfDuties: data.segregationOfDuties, requiredApprovals: data.requiredApprovals },
  });
  return { id: "default", record };
}

export function describeReview(document: MasterRecord, soonDays: number) {
  return reviewDueState(text(document.nextReviewDate), today(), soonDays);
}

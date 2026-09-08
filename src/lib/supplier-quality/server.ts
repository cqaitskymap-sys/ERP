import { searchIndex } from "@/lib/inventory/keys";
import { SQ_COLLECTIONS } from "@/lib/supplier-quality/collections";
import {
  actorStamp,
  assertOpen,
  auditSq,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueSqNumber,
  notifySq,
  parseOrFail,
  preventSelfApproval,
  requireRecord,
  reuseIdempotent,
  text,
  writeOf,
} from "@/lib/supplier-quality/helpers";
import {
  calculateExpiryStatus,
  calculateSupplierRisk,
  calculateSupplierScore,
  evaluateSupplierQualityGate,
} from "@/lib/supplier-quality/scoring";
import {
  AUDIT_TRANSITIONS,
  CHANGE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUALIFICATION_TRANSITIONS,
  QUESTIONNAIRE_TRANSITIONS,
  REQUAL_TRANSITIONS,
  SUSPENSION_TRANSITIONS,
  canTransition,
} from "@/lib/supplier-quality/status";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { isRegulatedMaterialType } from "@/lib/procurement/eligibility";
import {
  agreementSchema,
  auditSchema,
  certificateSchema,
  changeSchema,
  communicationSchema,
  documentSchema,
  evaluationSchema,
  findingSchema,
  linkSchema,
  materialQualSchema,
  profileSchema,
  qualificationSchema,
  questionnaireSchema,
  requalificationSchema,
  riskSchema,
  suspensionSchema,
} from "@/lib/validation/supplier-quality";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

export {
  AUDIT_TRANSITIONS,
  CHANGE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUALIFICATION_TRANSITIONS,
  QUESTIONNAIRE_TRANSITIONS,
  REQUAL_TRANSITIONS,
  SUSPENSION_TRANSITIONS,
};

async function vendorOrFail(supplierId: string, idToken: string) {
  const vendor = await readMasterDocument("vendors", supplierId, idToken);
  if (!vendor) fail("Vendor / supplier was not found. Use Vendor Master — do not create a duplicate.");
  return vendor;
}

export async function createSupplierQualityProfile(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQuality:update");
  const data = parseOrFail(profileSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const vendor = await vendorOrFail(data.supplierId, options.idToken);
  const existing = await queryMasterDocuments(SQ_COLLECTIONS.profiles, options.idToken, {
    filters: [{ field: "supplierId", value: data.supplierId }],
    limit: 1,
  });
  if (existing[0]) return { id: existing[0].id, record: existing[0] };
  const id = crypto.randomUUID();
  const record = {
    profileId: id,
    supplierId: data.supplierId,
    supplierCode: text(vendor.vendorCode || vendor.code),
    supplierName: text(vendor.vendorName || vendor.name),
    supplierType: text(vendor.vendorType || vendor.supplierType),
    country: text(vendor.country),
    status: "not_assessed",
    riskLevel: "",
    remarks: data.remarks || "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(vendor.vendorCode, vendor.vendorName, vendor.name, data.supplierId),
  };
  const writes = [writeOf(SQ_COLLECTIONS.profiles, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "SUPPLIER_QUALITY_PROFILE_CREATED",
    resource: SQ_COLLECTIONS.profiles,
    resourceId: id,
    description: `Created supplier quality profile for ${record.supplierName}.`,
    newData: { supplierId: data.supplierId },
  });
  return { id, record };
}

export async function createRiskAssessment(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityRisk:create");
  const data = parseOrFail(riskSchema, options.payload);
  await vendorOrFail(data.supplierId, options.idToken);
  const scored = calculateSupplierRisk({
    materialCriticality: data.materialCriticality,
    productImpact: data.productImpact,
    regulatoryImpact: data.regulatoryImpact,
    supplierHistory: data.supplierHistory,
    geographicRisk: data.geographicRisk,
    manufacturingComplexity: data.manufacturingComplexity,
    qualityPerformance: data.qualityPerformance,
    auditHistory: data.auditHistory,
    certificateStatus: data.certificateStatus,
    changeHistory: data.changeHistory,
  });
  const id = crypto.randomUUID();
  const record = {
    assessmentId: id,
    ...data,
    ...scored,
    assessedBy: options.session.uid,
    assessmentDate: new Date().toISOString(),
    status: "draft",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.risks, id, record, { exists: false })], options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "RISK_ASSESSMENT_CREATED",
    resource: SQ_COLLECTIONS.risks,
    resourceId: id,
    description: `Recorded supplier risk ${scored.riskLevel}.`,
    newData: { riskScore: scored.riskScore, riskLevel: scored.riskLevel },
  });
  return { id, record };
}

export async function createQualification(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityQualification:create");
  const data = parseOrFail(qualificationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await vendorOrFail(data.supplierId, options.idToken);
  const numbered = await issueSqNumber("QUAL", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    qualificationId: id,
    qualificationNumber: numbered.documentNumber,
    initiationDate: new Date().toISOString(),
    ...data,
    status: "draft",
    decision: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId, data.qualificationType),
  };
  const writes = [writeOf(SQ_COLLECTIONS.qualifications, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "QUALIFICATION_CREATED",
    resource: SQ_COLLECTIONS.qualifications,
    resourceId: id,
    description: `Opened qualification ${numbered.documentNumber}.`,
    newData: { supplierId: data.supplierId },
  });
  await notifySq(options.idToken, options.session, {
    type: "qualification_pending",
    title: "Qualification pending",
    message: `${numbered.documentNumber} requires document collection and QA review.`,
    resource: SQ_COLLECTIONS.qualifications,
    resourceId: id,
    audienceRoles: ["qa"],
  });
  return { id, record };
}

export async function addQualificationDocument(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityQualification:update");
  const data = parseOrFail(documentSchema, options.payload);
  const qualification = await requireRecord(SQ_COLLECTIONS.qualifications, data.qualificationId, options.idToken, "Qualification");
  assertOpen(qualification.status, "qualifications");
  const expiry = calculateExpiryStatus(data.expiryDate);
  const id = crypto.randomUUID();
  const record = {
    documentId: id,
    ...data,
    supplierId: qualification.supplierId,
    status: data.status || expiry.status,
    verificationStatus: "pending",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createQuestionnaire(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityQuestionnaire:create");
  const data = parseOrFail(questionnaireSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    questionnaireId: id,
    ...data,
    status: "draft",
    score: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.supplierId, data.title),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.questionnaires, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createEvaluation(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityEvaluation:create");
  const data = parseOrFail(evaluationSchema, options.payload);
  await vendorOrFail(data.supplierId, options.idToken);
  const previous = await queryMasterDocuments(SQ_COLLECTIONS.evaluations, options.idToken, {
    filters: [{ field: "supplierId", value: data.supplierId }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 1,
  });
  const scored = calculateSupplierScore({
    quality: data.quality,
    delivery: data.delivery,
    documentation: data.documentation,
    compliance: data.compliance,
    service: data.service,
  });
  const numbered = await issueSqNumber("EV", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    evaluationId: id,
    evaluationNumber: numbered.documentNumber,
    supplierId: data.supplierId,
    quality: data.quality,
    delivery: data.delivery,
    documentation: data.documentation,
    compliance: data.compliance,
    service: data.service,
    remarks: data.remarks || "",
    previousScore: previous[0]?.overallScore || "",
    evaluationDate: new Date().toISOString(),
    status: "draft",
    ...scored,
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.evaluations, id, record, { exists: false })], options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "EVALUATION_CREATED",
    resource: SQ_COLLECTIONS.evaluations,
    resourceId: id,
    description: `Recorded evaluation ${numbered.documentNumber}.`,
    newData: { overallScore: scored.overallScore },
  });
  return { id, record };
}

export async function qualifyMaterial(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityQualification:update");
  const data = parseOrFail(materialQualSchema, options.payload);
  await vendorOrFail(data.supplierId, options.idToken);
  const material = await readMasterDocument("materials", data.materialId, options.idToken);
  if (!material) fail("Material was not found. Use Material Master.");
  const id = crypto.randomUUID();
  const record = {
    materialQualificationId: id,
    ...data,
    materialCode: text(material.materialCode || material.code),
    materialName: text(material.materialName || material.name),
    status: data.qualificationStatus,
    approvalDate: data.qualificationStatus === "qualified" || data.qualificationStatus === "conditional" ? new Date().toISOString() : "",
    approvedBy: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.supplierId, data.materialId, material.materialCode),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.materials, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createAudit(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityAudit:create");
  const data = parseOrFail(auditSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await vendorOrFail(data.supplierId, options.idToken);
  const numbered = await issueSqNumber("AUD", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    auditId: id,
    auditNumber: numbered.documentNumber,
    ...data,
    status: "planned",
    conclusion: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId, data.auditType),
  };
  const writes = [writeOf(SQ_COLLECTIONS.audits, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "AUDIT_CREATED",
    resource: SQ_COLLECTIONS.audits,
    resourceId: id,
    description: `Planned audit ${numbered.documentNumber}.`,
    newData: { supplierId: data.supplierId },
  });
  return { id, record };
}

export async function addAuditFinding(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityAudit:update");
  const data = parseOrFail(findingSchema, options.payload);
  const audit = await requireRecord(SQ_COLLECTIONS.audits, data.auditId, options.idToken, "Audit");
  if (text(audit.status) === "closed") fail("Closed audits cannot be modified.");
  const id = crypto.randomUUID();
  const record = {
    findingId: id,
    ...data,
    supplierId: audit.supplierId,
    supplierResponse: "",
    status: "open",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.findings, id, record, { exists: false })], options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "AUDIT_FINDING_CREATED",
    resource: SQ_COLLECTIONS.findings,
    resourceId: id,
    description: `Recorded ${data.severity} finding on ${audit.auditNumber}.`,
    newData: { severity: data.severity },
  });
  return { id, record };
}

export async function createCertificate(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityCertificate:create");
  const data = parseOrFail(certificateSchema, options.payload);
  const expiry = calculateExpiryStatus(data.expiryDate);
  const id = crypto.randomUUID();
  const record = {
    certificateId: id,
    ...data,
    status: expiry.status,
    verificationStatus: "pending",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.supplierId, data.certificateType, data.certificateNumber),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.certificates, id, record, { exists: false })], options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "CERTIFICATE_ADDED",
    resource: SQ_COLLECTIONS.certificates,
    resourceId: id,
    description: `Added certificate ${data.certificateType}.`,
    newData: { expiryDate: data.expiryDate },
  });
  return { id, record };
}

export async function createAgreement(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityAgreement:create");
  const data = parseOrFail(agreementSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const numbered = await issueSqNumber("AGR", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    agreementId: id,
    agreementNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    approvalStatus: "draft",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId, data.agreementType),
  };
  const writes = [writeOf(SQ_COLLECTIONS.agreements, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createSupplierChange(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityChange:create");
  const data = parseOrFail(changeSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const numbered = await issueSqNumber("CHG", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    supplierChangeId: id,
    changeNumber: numbered.documentNumber,
    ...data,
    status: "received",
    changeControlId: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId, data.changeType),
  };
  const writes = [writeOf(SQ_COLLECTIONS.changes, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "SUPPLIER_CHANGE_CREATED",
    resource: SQ_COLLECTIONS.changes,
    resourceId: id,
    description: `Logged supplier change ${numbered.documentNumber}.`,
    newData: { changeType: data.changeType },
  });
  return { id, record };
}

export async function createSuspension(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualitySuspension:create");
  const data = parseOrFail(suspensionSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const numbered = await issueSqNumber("SUS", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    suspensionId: id,
    suspensionNumber: numbered.documentNumber,
    ...data,
    status: "proposed",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId, data.reason),
  };
  const writes = [writeOf(SQ_COLLECTIONS.suspensions, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await notifySq(options.idToken, options.session, {
    type: "suspension_approval_pending",
    title: "Supplier suspension approval pending",
    message: `${numbered.documentNumber} requires authorized QA approval.`,
    resource: SQ_COLLECTIONS.suspensions,
    resourceId: id,
    audienceRoles: ["qa", "management"],
    severity: "warning",
  });
  return { id, record };
}

export async function createRequalification(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQualityRequalification:create");
  const data = parseOrFail(requalificationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const numbered = await issueSqNumber("RQ", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    requalificationId: id,
    requalificationNumber: numbered.documentNumber,
    ...data,
    status: "not_started",
    decision: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.supplierId),
  };
  const writes = [writeOf(SQ_COLLECTIONS.requalifications, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSq(options.idToken, options.session, {
    action: "REQUALIFICATION_CREATED",
    resource: SQ_COLLECTIONS.requalifications,
    resourceId: id,
    description: `Opened requalification ${numbered.documentNumber}.`,
    newData: { supplierId: data.supplierId },
  });
  return { id, record };
}

export async function createCommunication(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "supplierQuality:update");
  const data = parseOrFail(communicationSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    communicationId: id,
    ...data,
    date: new Date().toISOString(),
    responsiblePerson: options.session.uid,
    status: "draft",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.supplierId, data.subject, data.type),
  };
  await commitWrites([writeOf(SQ_COLLECTIONS.communications, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function linkCapaOrChange(options: { collection: string; id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string; permission: Permission }) {
  ensurePermission(options.session, options.permission);
  const data = parseOrFail(linkSchema, options.payload);
  const record = await requireRecord(options.collection, options.id, options.idToken, "Record");
  const next: Record<string, unknown> = { ...record, ...actorStamp(options.session, record) };
  if (data.capaId) {
    const capa = await readMasterDocument("qaCAPA", data.capaId, options.idToken);
    if (!capa) fail("CAPA was not found. Use the existing CAPA engine.");
    next.capaId = data.capaId;
  }
  if (data.changeControlId) {
    const change = await readMasterDocument("qaChangeControls", data.changeControlId, options.idToken);
    if (!change) fail("Change control was not found.");
    next.changeControlId = data.changeControlId;
  }
  if (data.deviationId) {
    const deviation = await readMasterDocument("qaDeviations", data.deviationId, options.idToken);
    if (!deviation) fail("Deviation was not found. Use the existing deviation module.");
    next.deviationId = data.deviationId;
  }
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function assertSupplierQualityForProcurement(options: {
  vendorId: string;
  materialIds: string[];
  idToken: string;
}) {
  const profiles = await queryMasterDocuments(SQ_COLLECTIONS.profiles, options.idToken, {
    filters: [{ field: "supplierId", value: options.vendorId }],
    limit: 1,
  }).catch(() => []);
  const profile = profiles[0] || null;
  for (const materialId of options.materialIds.length ? options.materialIds : [""]) {
    const material = materialId ? await readMasterDocument("materials", materialId, options.idToken) : null;
    const regulated = isRegulatedMaterialType(material?.materialType);
    const quals = materialId
      ? await queryMasterDocuments(SQ_COLLECTIONS.materials, options.idToken, {
          filters: [
            { field: "supplierId", value: options.vendorId },
            { field: "materialId", value: materialId },
          ],
          limit: 1,
        }).catch(() => [])
      : [];
    const gate = evaluateSupplierQualityGate({
      profile,
      materialQualification: quals[0] || null,
      regulatedMaterial: regulated,
      allowConditional: true,
      allowExpiredException: false,
    });
    if (!gate.allowed) fail(gate.reasons[0] || "Supplier quality status blocks this purchase.");
  }
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
  if (["closed", "approved", "disqualified"].includes(text(record.status)) && options.collection !== SQ_COLLECTIONS.profiles) {
    fail(`${options.label} in "${record.status}" cannot be silently modified.`);
  }
  const next = {
    ...record,
    ...options.payload,
    qualificationNumber: record.qualificationNumber,
    auditNumber: record.auditNumber,
    evaluationNumber: record.evaluationNumber,
    agreementNumber: record.agreementNumber,
    changeNumber: record.changeNumber,
    requalificationNumber: record.requalificationNumber,
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function advanceSqRecord(options: {
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
  lockStatuses?: string[];
  requireSod?: boolean;
}) {
  ensurePermission(options.session, options.permission);
  const record = await requireRecord(options.collection, options.id, options.idToken, options.label);
  if (options.lockStatuses?.includes(text(record.status))) fail(`${options.label} in "${record.status}" cannot be modified.`);
  if (options.requireSod) preventSelfApproval(options.session, record.createdBy);
  if (!canTransition(options.map, text(record.status), options.next)) fail(`Cannot move ${options.label} from "${record.status}" to "${options.next}".`);
  const next: Record<string, unknown> = {
    ...record,
    ...options.extra,
    status: options.next,
    approvalSignature: electronicSignature(options.session, options.next, options.comment),
    ...actorStamp(options.session, record),
  };
  if (options.next === "approved" || options.next === "closed") next.completionDate = new Date().toISOString();
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  await auditSq(options.idToken, options.session, {
    action: options.audit || `${options.label.toUpperCase().replace(/\s+/g, "_")}_UPDATED`,
    resource: options.collection,
    resourceId: options.id,
    description: `${options.label} moved to ${options.next}.`,
    oldData: { status: record.status },
    newData: { status: options.next },
    reason: options.comment || "",
  });
  return { id: options.id, record: next };
}

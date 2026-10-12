import { ARTWORK_COLLECTIONS } from "@/lib/artwork/collections";
import { ARTWORK_LANES, type ArtworkLaneKey } from "@/lib/artwork/status";
import { listArtworkRecords } from "@/lib/artwork/query";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument, writeMasterDocument, type MasterRecord } from "@/lib/masters/firestore";
import { canAccess } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function searchIndex(id: string, fields: Record<string, unknown>) {
  return [id, ...Object.values(fields).filter((value) => typeof value === "string")]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

async function readOrNull(collection: string, id: string, idToken: string) {
  try {
    return await readMasterDocument(collection, id, idToken);
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") return null;
    throw error;
  }
}

function assertLive(record: MasterRecord) {
  if (record.createdBy === "demo-preview") {
    throw createNamedError(
      "ValidationError",
      "This preview job is read-only. Create a new artwork to run the approval."
    );
  }
}

export async function loadArtworkDetail(resource: "requests" | "approvals" | "versions", id: string, idToken: string) {
  const collection = ARTWORK_COLLECTIONS[resource];
  const record = await readOrNull(collection, id, idToken);
  if (!record) return null;
  if (resource !== "requests") return { record };
  const [approvals, versions] = await Promise.all([
    listArtworkRecords(ARTWORK_COLLECTIONS.approvals, { requestId: id, pageSize: 20 }, idToken),
    listArtworkRecords(ARTWORK_COLLECTIONS.versions, { requestId: id, pageSize: 20 }, idToken),
  ]);
  return { record, extra: { approvals: approvals.rows, versions: versions.rows } };
}

export async function createArtworkRequest(body: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (!canAccess(session, "artwork:create")) {
    throw createNamedError("ForbiddenError", "You do not have permission for this action.");
  }
  const title = text(body.title);
  const productId = text(body.productId);
  const customerId = text(body.customerId);
  const component = text(body.component);
  if (!title || !productId || !customerId || !component) {
    throw createNamedError("ValidationError", "Title, product, customer, and component are required.");
  }
  const now = new Date().toISOString();
  const id = `art-${Date.now().toString(36)}`;
  const artworkNumber = `ART-${now.slice(0, 4)}-${String(Date.now()).slice(-3)}`;
  const fields: Record<string, unknown> = {
    artworkNumber,
    title,
    productId,
    customerId,
    component,
    market: text(body.market) || "India",
    versionLabel: "1",
    dueDate: text(body.dueDate),
    ownerName: session.name,
    remarks: text(body.remarks),
    currentLane: "packaging",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy: session.uid,
    updatedBy: session.uid,
  };
  fields.searchIndex = searchIndex(id, fields);
  fields.nameIndex = title.toLowerCase();
  await writeMasterDocument(ARTWORK_COLLECTIONS.requests, id, fields, idToken);
  const versionId = `${id}-v1`;
  const version: Record<string, unknown> = {
    requestId: id,
    artworkNumber,
    title,
    versionLabel: "1",
    summary: text(body.remarks) || "First draft raised for approval.",
    preparedBy: session.name,
    versionStatus: "current",
    status: "current",
    createdAt: now,
    updatedAt: now,
    createdBy: session.uid,
    updatedBy: session.uid,
  };
  version.searchIndex = searchIndex(versionId, version);
  version.nameIndex = title.toLowerCase();
  await writeMasterDocument(ARTWORK_COLLECTIONS.versions, versionId, version, idToken);
  return { id, record: { ...fields, id } };
}

async function ensureLaneRows(record: MasterRecord, session: SessionPayload, idToken: string) {
  const now = new Date().toISOString();
  for (const lane of ARTWORK_LANES) {
    const laneId = `${record.id}-${lane.key}`;
    const existing = await readOrNull(ARTWORK_COLLECTIONS.approvals, laneId, idToken);
    if (existing && existing.createdBy !== "demo-preview") continue;
    const fields: Record<string, unknown> = {
      requestId: record.id,
      artworkNumber: record.artworkNumber,
      title: record.title,
      customerId: record.customerId,
      lane: lane.key,
      decision: "waiting",
      actorName: "",
      decidedAt: "",
      comment: "",
      status: "waiting",
      createdAt: now,
      updatedAt: now,
      createdBy: session.uid,
      updatedBy: session.uid,
    };
    fields.searchIndex = searchIndex(laneId, fields);
    fields.nameIndex = String(record.title || record.id).toLowerCase();
    await writeMasterDocument(ARTWORK_COLLECTIONS.approvals, laneId, fields, idToken);
  }
}

function nextLane(current: string): ArtworkLaneKey | null {
  const index = ARTWORK_LANES.findIndex((lane) => lane.key === current);
  const next = ARTWORK_LANES[index + 1];
  return next?.key ?? null;
}

export async function actOnArtwork(
  id: string,
  action: string,
  comment: string,
  session: SessionPayload,
  idToken: string
) {
  const needed = action === "approve" || action === "effective" ? "artwork:approve" : "artwork:update";
  if (!canAccess(session, needed)) {
    throw createNamedError("ForbiddenError", "You do not have permission for this action.");
  }
  const record = await readOrNull(ARTWORK_COLLECTIONS.requests, id, idToken);
  if (!record) throw createNamedError("ValidationError", "Artwork job was not found.");
  assertLive(record);
  const now = new Date().toISOString();
  const lane = String(record.currentLane || "packaging") as ArtworkLaneKey;
  let status = String(record.status || "draft");
  let currentLane = lane;

  if (action === "submit") {
    if (status !== "draft" && status !== "changes_requested") {
      throw createNamedError("ValidationError", "Only a draft or a job with changes can be submitted.");
    }
    await ensureLaneRows(record, session, idToken);
    status = ARTWORK_LANES.find((item) => item.key === currentLane)?.status || "packaging_review";
    await writeLane(id, currentLane, "pending", session, idToken, comment || "Submitted for review.", now);
  } else if (action === "changes") {
    if (!ARTWORK_LANES.some((item) => item.status === status)) {
      throw createNamedError("ValidationError", "Changes can be requested only while a lane is reviewing the job.");
    }
    status = "changes_requested";
    await writeLane(id, currentLane, "changes_requested", session, idToken, comment || "Changes requested.", now);
  } else if (action === "approve") {
    const active = ARTWORK_LANES.find((item) => item.status === status);
    if (!active) throw createNamedError("ValidationError", "This job is not waiting on an approval.");
    await writeLane(id, active.key, "approved", session, idToken, comment || "Approved.", now);
    const following = nextLane(active.key);
    if (following) {
      currentLane = following;
      status = ARTWORK_LANES.find((item) => item.key === following)?.status || status;
      await writeLane(id, following, "pending", session, idToken, "", now);
    } else {
      status = "approved";
    }
  } else if (action === "effective") {
    if (status !== "approved") {
      throw createNamedError("ValidationError", "Make the job effective only after every lane has approved it.");
    }
    status = "effective";
  } else {
    throw createNamedError("ValidationError", "Unknown artwork action.");
  }

  const next: Record<string, unknown> = {
    ...record,
    status,
    currentLane,
    updatedAt: now,
    updatedBy: session.uid,
  };
  delete next.id;
  delete next._updateTime;
  next.searchIndex = searchIndex(id, next);
  await writeMasterDocument(ARTWORK_COLLECTIONS.requests, id, next, idToken);
  return { id, record: { ...next, id } };
}

async function writeLane(
  requestId: string,
  lane: ArtworkLaneKey,
  decision: string,
  session: SessionPayload,
  idToken: string,
  comment: string,
  now: string
) {
  const laneId = `${requestId}-${lane}`;
  const existing = await readOrNull(ARTWORK_COLLECTIONS.approvals, laneId, idToken);
  const base = existing && existing.createdBy !== "demo-preview" ? existing : null;
  const fields: Record<string, unknown> = {
    ...(base || {
      requestId,
      lane,
      createdAt: now,
      createdBy: session.uid,
    }),
    decision,
    status: decision,
    actorName: decision === "approved" || decision === "changes_requested" ? session.name : "",
    decidedAt: decision === "approved" || decision === "changes_requested" ? now : "",
    comment: comment || String(base?.comment || ""),
    updatedAt: now,
    updatedBy: session.uid,
  };
  delete fields.id;
  delete fields._updateTime;
  fields.searchIndex = searchIndex(laneId, fields);
  await writeMasterDocument(ARTWORK_COLLECTIONS.approvals, laneId, fields, idToken);
}

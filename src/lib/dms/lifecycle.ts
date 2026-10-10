import { DMS_ALLOWED_CONTENT_TYPES, DMS_MAX_FILE_BYTES } from "@/lib/dms/config";

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatVersion(major: number, minor: number) {
  return `${Math.max(0, major)}.${Math.max(0, minor)}`;
}

export function bumpVersion(major: number, minor: number, kind: "major" | "minor") {
  if (kind === "major") return { major: major + 1, minor: 0 };
  return { major, minor: minor + 1 };
}

export function versionContentLocked(status: string) {
  return !["draft", "changes_requested"].includes(status);
}

export function reviewDueState(nextReviewDate: string, today: string, soonDays: number) {
  if (!nextReviewDate) return "none" as const;
  const due = nextReviewDate.slice(0, 10);
  if (due < today) return "overdue" as const;
  if (due === today) return "due" as const;
  if (due <= addDays(today, soonDays)) return "due_soon" as const;
  return "scheduled" as const;
}

export function expiryState(expiryDate: string, today: string, soonDays: number) {
  return reviewDueState(expiryDate, today, soonDays);
}

export function releaseBlockers(input: {
  status: string;
  fileReady: boolean;
  requireFile: boolean;
  approvalCount: number;
  requiredApprovals: number;
  reviewAccepted: boolean;
  requireReview: boolean;
  authorId: string;
  actorId: string;
  segregation: boolean;
}) {
  const reasons: string[] = [];
  if (input.status !== "approved") reasons.push("Document is not approved.");
  if (input.requireFile && !input.fileReady) reasons.push("The approved version has no confirmed file.");
  if (input.approvalCount < input.requiredApprovals) reasons.push("Required approvals are incomplete.");
  if (input.requireReview && !input.reviewAccepted) reasons.push("A completed review is required before release.");
  if (input.segregation && input.authorId && input.authorId === input.actorId) {
    reasons.push("Authors cannot release their own documents when segregation of duties is required.");
  }
  return reasons;
}

export function selfApprovalBlock(authorId: string, actorId: string, segregation: boolean) {
  if (segregation && authorId && authorId === actorId) {
    return "Authors cannot approve their own documents when segregation of duties is required.";
  }
  return "";
}

export function approvalProgress(existingCount: number, required: number) {
  const next = existingCount + 1;
  return {
    count: next,
    required,
    complete: next >= Math.max(1, required),
  };
}

export function applyPeriodicDecision(input: {
  decision: "no_change" | "revision_required" | "retirement_proposed";
  reason: string;
  currentNextReview: string;
  intervalDays: number;
  today: string;
}) {
  if (!input.reason.trim()) {
    return { ok: false as const, message: "A documented reason is required. Review dates are not extended silently." };
  }
  if (input.decision === "no_change") {
    return {
      ok: true as const,
      nextReviewDate: addDays(input.today, input.intervalDays),
      extended: true,
      openChange: false,
    };
  }
  return {
    ok: true as const,
    nextReviewDate: input.currentNextReview,
    extended: false,
    openChange: true,
  };
}

export function validateFileMeta(input: { contentType: string; sizeBytes: number; maxBytes?: number }) {
  const errors: string[] = [];
  const max = input.maxBytes ?? DMS_MAX_FILE_BYTES;
  if (!DMS_ALLOWED_CONTENT_TYPES.includes(input.contentType as (typeof DMS_ALLOWED_CONTENT_TYPES)[number])) {
    errors.push("File type is not supported. Use PDF, Word, Excel, or a PNG/JPEG image.");
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > max) {
    errors.push(`File size must be between 1 byte and ${max} bytes.`);
  }
  return errors;
}

export function isSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value.trim());
}

export function buildVersionStoragePath(
  classification: string,
  documentId: string,
  versionId: string,
  fileName: string
) {
  const folder = classification === "confidential" || classification === "restricted" ? classification : "internal";
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120);
  return `dms/${folder}/${documentId}/versions/${versionId}/${safe || "file"}`;
}

export function pathsAreDistinct(previousPath: string, nextPath: string) {
  return Boolean(previousPath) && Boolean(nextPath) && previousPath !== nextPath;
}

export function diffMetadata(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[]
) {
  return keys
    .filter((key) => JSON.stringify(before[key] ?? "") !== JSON.stringify(after[key] ?? ""))
    .map((key) => ({ field: key, before: before[key] ?? "", after: after[key] ?? "" }));
}

export function diffLines(before: string, after: string) {
  const left = before.split(/\r?\n/);
  const right = after.split(/\r?\n/);
  const max = Math.max(left.length, right.length);
  const rows: Array<{ type: "same" | "remove" | "add"; text: string }> = [];
  for (let index = 0; index < max && rows.length < 400; index += 1) {
    if (left[index] === right[index]) {
      rows.push({ type: "same", text: left[index] ?? "" });
      continue;
    }
    if (left[index] !== undefined) rows.push({ type: "remove", text: left[index] });
    if (right[index] !== undefined && rows.length < 400) rows.push({ type: "add", text: right[index] });
  }
  return rows;
}

export function trainingMarkedCompleteByAccess(source: string) {
  return source === "download" || source === "open" || source === "preview";
}

export function hasDuplicateNumber(existing: string[], candidate: string) {
  return existing.filter((value) => value === candidate).length > 0;
}

export function assertExpectedStatus(actual: string, expected: string[]) {
  if (!expected.includes(actual)) {
    return `This record is now "${actual}". Refresh before retrying so a concurrent update is not overwritten.`;
  }
  return "";
}

export function signatureEmailMatches(sessionEmail: string, confirmedEmail: string) {
  return Boolean(sessionEmail) && sessionEmail.trim().toLowerCase() === confirmedEmail.trim().toLowerCase();
}

export function retentionUntil(fromIsoDate: string, years: number) {
  return addDays(fromIsoDate.slice(0, 10), Math.max(1, years) * 365);
}

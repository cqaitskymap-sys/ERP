import { strictEqual, ok, deepEqual } from "node:assert/strict";
import {
  addDays,
  applyPeriodicDecision,
  approvalProgress,
  assertExpectedStatus,
  buildVersionStoragePath,
  bumpVersion,
  diffLines,
  diffMetadata,
  formatVersion,
  hasDuplicateNumber,
  isSha256,
  pathsAreDistinct,
  releaseBlockers,
  reviewDueState,
  selfApprovalBlock,
  signatureEmailMatches,
  trainingMarkedCompleteByAccess,
  validateFileMeta,
  versionContentLocked,
} from "@/lib/dms/lifecycle";
import { canTransition, DOCUMENT_TRANSITIONS } from "@/lib/dms/status";

export function runDmsSelfTests() {
  strictEqual(formatVersion(1, 0), "1.0");
  deepEqual(bumpVersion(1, 0, "minor"), { major: 1, minor: 1 });
  deepEqual(bumpVersion(1, 3, "major"), { major: 2, minor: 0 });
  ok(pathsAreDistinct("dms/internal/a/versions/v1/file.pdf", "dms/internal/a/versions/v2/file.pdf"));
  ok(!pathsAreDistinct("dms/internal/a/versions/v1/file.pdf", "dms/internal/a/versions/v1/file.pdf"));

  ok(canTransition(DOCUMENT_TRANSITIONS, "draft", "in_review"));
  ok(!canTransition(DOCUMENT_TRANSITIONS, "draft", "effective"));
  ok(canTransition(DOCUMENT_TRANSITIONS, "approved", "effective"));
  ok(versionContentLocked("effective"));
  ok(!versionContentLocked("draft"));

  strictEqual(
    selfApprovalBlock("author-1", "author-1", true),
    "Authors cannot approve their own documents when segregation of duties is required."
  );
  strictEqual(selfApprovalBlock("author-1", "qa-2", true), "");

  const blocked = releaseBlockers({
    status: "in_review",
    fileReady: true,
    requireFile: true,
    approvalCount: 0,
    requiredApprovals: 1,
    reviewAccepted: false,
    requireReview: true,
    authorId: "author-1",
    actorId: "author-1",
    segregation: true,
  });
  ok(blocked.length >= 3);

  const ready = releaseBlockers({
    status: "approved",
    fileReady: true,
    requireFile: true,
    approvalCount: 1,
    requiredApprovals: 1,
    reviewAccepted: true,
    requireReview: true,
    authorId: "author-1",
    actorId: "qa-2",
    segregation: true,
  });
  deepEqual(ready, []);

  deepEqual(approvalProgress(0, 2), { count: 1, required: 2, complete: false });
  ok(approvalProgress(1, 2).complete);

  const silent = applyPeriodicDecision({
    decision: "no_change",
    reason: "   ",
    currentNextReview: "2026-01-01",
    intervalDays: 30,
    today: "2026-10-09",
  });
  strictEqual(silent.ok, false);

  const extended = applyPeriodicDecision({
    decision: "no_change",
    reason: "Content remains current.",
    currentNextReview: "2026-10-01",
    intervalDays: 30,
    today: "2026-10-09",
  });
  ok(extended.ok && extended.extended);
  if (extended.ok) strictEqual(extended.nextReviewDate, addDays("2026-10-09", 30));

  const revise = applyPeriodicDecision({
    decision: "revision_required",
    reason: "Process changed.",
    currentNextReview: "2026-10-01",
    intervalDays: 30,
    today: "2026-10-09",
  });
  ok(revise.ok && revise.openChange && !revise.extended);

  strictEqual(reviewDueState("2026-10-01", "2026-10-09", 30), "overdue");
  strictEqual(reviewDueState("2026-10-20", "2026-10-09", 30), "due_soon");
  ok(hasDuplicateNumber(["SOP-2026-00001", "SOP-2026-00001"], "SOP-2026-00001"));
  ok(!hasDuplicateNumber(["SOP-2026-00001"], "SOP-2026-00002"));
  ok(assertExpectedStatus("effective", ["draft"]).includes("effective"));

  ok(!signatureEmailMatches("qa@plant.example", "someone@plant.example"));
  ok(signatureEmailMatches("QA@plant.example", "qa@plant.example"));
  ok(trainingMarkedCompleteByAccess("download"));
  ok(!trainingMarkedCompleteByAccess("acknowledgement"));

  ok(validateFileMeta({ contentType: "application/pdf", sizeBytes: 1200 }).length === 0);
  ok(validateFileMeta({ contentType: "text/html", sizeBytes: 1200 }).length > 0);
  ok(validateFileMeta({ contentType: "application/pdf", sizeBytes: 20 * 1024 * 1024 }).length > 0);
  ok(isSha256("a".repeat(64)));
  ok(!isSha256("not-a-checksum"));

  const path = buildVersionStoragePath("confidential", "doc-1", "ver-1", "SOP 1.pdf");
  ok(path.startsWith("dms/confidential/doc-1/versions/ver-1/"));
  ok(!path.includes(" "));

  const metadata = diffMetadata({ title: "A", status: "draft" }, { title: "B", status: "draft" }, ["title", "status"]);
  strictEqual(metadata.length, 1);
  ok(diffLines("Line 1\nLine 2", "Line 1\nLine 3").some((row) => row.type === "add" && row.text === "Line 3"));
}

console.log(runDmsSelfTests() ?? "dms self-test passed");

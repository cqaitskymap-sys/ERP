import { ok, strictEqual } from "node:assert/strict";
import { calculateExpiryStatus, daysUntil } from "@/lib/ra/expiry";
import {
  ARTWORK_TRANSITIONS,
  canTransition,
  CHANGE_TRANSITIONS,
  COMMITMENT_TRANSITIONS,
  DOCUMENT_TRANSITIONS,
  QUERY_TRANSITIONS,
  REGISTRATION_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
} from "@/lib/ra/status";
import { electronicSignature } from "@/lib/ra/helpers";
import type { SessionPayload } from "@/types/auth";

const now = new Date("2026-09-05T00:00:00.000Z");

export function runRaSelfTests() {
  strictEqual(calculateExpiryStatus("2026-10-20", undefined, now), "expiring_soon");
  strictEqual(calculateExpiryStatus("2026-09-20", undefined, now), "critical");
  strictEqual(calculateExpiryStatus("2026-09-01", undefined, now), "expired");
  strictEqual(calculateExpiryStatus("2028-01-01", undefined, now), "active");
  ok(daysUntil("2026-09-06", now) === 1);

  ok(canTransition(REGISTRATION_TRANSITIONS, "draft", "preparation"));
  ok(!canTransition(REGISTRATION_TRANSITIONS, "draft", "approved"));
  ok(canTransition(REGISTRATION_TRANSITIONS, "under_review", "approved"));
  ok(!canTransition(REGISTRATION_TRANSITIONS, "withdrawn", "approved"));

  ok(canTransition(SUBMISSION_TRANSITIONS, "draft", "in_preparation"));
  ok(canTransition(SUBMISSION_TRANSITIONS, "internal_review", "approved_for_submission"));
  ok(!canTransition(SUBMISSION_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(SUBMISSION_TRANSITIONS, "approved_for_submission", "submitted"));

  ok(canTransition(QUERY_TRANSITIONS, "received", "assigned"));
  ok(canTransition(QUERY_TRANSITIONS, "approved", "submitted"));
  ok(!canTransition(QUERY_TRANSITIONS, "closed", "assigned"));

  ok(canTransition(COMMITMENT_TRANSITIONS, "open", "in_progress"));
  ok(canTransition(COMMITMENT_TRANSITIONS, "in_progress", "completed"));
  ok(!canTransition(COMMITMENT_TRANSITIONS, "completed", "open"));

  ok(canTransition(DOCUMENT_TRANSITIONS, "draft", "under_review"));
  ok(!canTransition(DOCUMENT_TRANSITIONS, "approved", "draft"));

  ok(canTransition(ARTWORK_TRANSITIONS, "draft", "ra_review"));
  ok(canTransition(ARTWORK_TRANSITIONS, "customer_review", "approved"));

  ok(canTransition(CHANGE_TRANSITIONS, "new_requirement", "ra_assessment"));
  ok(!canTransition(CHANGE_TRANSITIONS, "new_requirement", "implementation"));
  ok(canTransition(CHANGE_TRANSITIONS, "verification", "closed"));

  const signature = electronicSignature(
    { uid: "ra-user", email: "ra@example.com", role: "regulatory" } as SessionPayload,
    "approve",
    "Eligible"
  );
  ok(signature.signatureReference);
  ok(!("password" in signature));

  return "ra self-tests passed";
}

console.log(runRaSelfTests());

import { queryMasterDocuments } from "@/lib/masters/firestore";
import { DEFAULT_BATCH_NUMBER_PATTERN } from "@/lib/production/config";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

export function formatBatchNumber(input: {
  pattern?: string;
  productCode: string;
  sequence: number;
  now?: Date;
}) {
  const now = input.now || new Date();
  const yy = pad(now.getFullYear() % 100, 2);
  const yyyy = String(now.getFullYear());
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);
  const seq = pad(input.sequence, 2);
  const seq3 = pad(input.sequence, 3);
  return (input.pattern || DEFAULT_BATCH_NUMBER_PATTERN)
    .replaceAll("{productCode}", input.productCode.replace(/\s+/g, "").toUpperCase())
    .replaceAll("{yyyy}", yyyy)
    .replaceAll("{yy}", yy)
    .replaceAll("{MMdd}", `${mm}${dd}`)
    .replaceAll("{yyMMdd}", `${yy}${mm}${dd}`)
    .replaceAll("{seq3}", seq3)
    .replaceAll("{seq}", seq);
}

export async function nextUniqueBatchNumber(options: {
  productCode: string;
  idToken: string;
  pattern?: string;
  now?: Date;
}) {
  const today = (options.now || new Date()).toISOString().slice(0, 10);
  const existing = await queryMasterDocuments(PRODUCTION_COLLECTIONS.orders, options.idToken, {
    filters: [{ field: "batchNumberDate", value: today }],
    limit: 200,
  });
  let sequence = existing.length + 1;
  let candidate = formatBatchNumber({
    pattern: options.pattern,
    productCode: options.productCode,
    sequence,
    now: options.now,
  });
  const used = new Set(existing.map((row) => String(row.batchNumber || "")));
  while (used.has(candidate)) {
    sequence += 1;
    candidate = formatBatchNumber({
      pattern: options.pattern,
      productCode: options.productCode,
      sequence,
      now: options.now,
    });
  }
  return { batchNumber: candidate, sequence };
}

export function plannedBatchCount(required: number, batchSize: number, rounding: "ceil" | "floor" | "nearest" = "ceil") {
  if (batchSize <= 0) return 0;
  const raw = required / batchSize;
  if (rounding === "floor") return Math.max(1, Math.floor(raw + Number.EPSILON));
  if (rounding === "nearest") return Math.max(1, Math.round(raw));
  return Math.max(1, Math.ceil(raw - Number.EPSILON));
}

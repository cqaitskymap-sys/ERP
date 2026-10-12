import type { MasterQueryFilter, MasterQueryOptions, MasterRecord } from "@/lib/masters/firestore";
import { DEMO_CATALOG } from "@/lib/demo/catalog";

export function isDemoDataEnabled() {
  return process.env.DEMO_DATA !== "false";
}

function matches(row: MasterRecord, filters: MasterQueryFilter[]) {
  return filters.every((filter) => {
    const left = row[filter.field];
    const op = filter.op ?? "EQUAL";
    if (op === "EQUAL") {
      return left === filter.value || String(left ?? "") === String(filter.value);
    }
    const a = typeof left === "number" ? left : String(left ?? "");
    const b = typeof filter.value === "number" && typeof a === "number" ? filter.value : String(filter.value);
    if (typeof a === "number" && typeof b === "number") {
      if (op === "GREATER_THAN_OR_EQUAL") return a >= b;
      if (op === "GREATER_THAN") return a > b;
      if (op === "LESS_THAN") return a < b;
      if (op === "LESS_THAN_OR_EQUAL") return a <= b;
      return true;
    }
    const as = String(a);
    const bs = String(b);
    if (op === "GREATER_THAN_OR_EQUAL") return as >= bs;
    if (op === "GREATER_THAN") return as > bs;
    if (op === "LESS_THAN") return as < bs;
    if (op === "LESS_THAN_OR_EQUAL") return as <= bs;
    return true;
  });
}

function sortRows(rows: MasterRecord[], orderBy: MasterQueryOptions["orderBy"]) {
  if (!orderBy?.length) return rows;
  const [{ field, direction }] = orderBy;
  const sign = direction === "DESCENDING" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = left[field];
    const b = right[field];
    if (typeof a === "number" && typeof b === "number") return (a - b) * sign;
    return String(a ?? "").localeCompare(String(b ?? "")) * sign;
  });
}

export function demoRecord(collection: string, id: string): MasterRecord | null {
  if (!isDemoDataEnabled()) return null;
  const match = (DEMO_CATALOG[collection] || []).find((row) => row.id === id);
  return match ? ({ ...match } as MasterRecord) : null;
}

export function mergeDemoRecords(
  collection: string,
  live: MasterRecord[],
  options: MasterQueryOptions = {}
) {
  if (!isDemoDataEnabled() || options.startAfter?.length) return live;
  const demo = (DEMO_CATALOG[collection] || []) as MasterRecord[];
  if (!demo.length) return live;
  const seen = new Set(live.map((row) => row.id));
  const extras = demo.filter((row) => !seen.has(row.id) && matches(row, options.filters ?? []));
  const merged = sortRows([...extras, ...live], options.orderBy);
  const limit = options.limit ?? merged.length;
  return merged.slice(0, limit);
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { listMasterRecords } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import type { MasterEntity, MasterListQuery } from "@/types/masters";

export function useMasterList(entity: MasterEntity, query: MasterListQuery) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = [
    entity,
    query.status ?? "",
    query.companyId ?? "",
    query.plantId ?? "",
    query.warehouseId ?? "",
    query.departmentId ?? "",
    query.productId ?? "",
    query.materialId ?? "",
    query.customerId ?? "",
    query.supplierId ?? "",
    query.formulaId ?? "",
    query.productType ?? "",
    query.materialType ?? "",
    query.dosageForm ?? "",
    query.uom ?? "",
    query.vendorId ?? "",
    query.customerType ?? "",
    query.vendorType ?? "",
    query.qualificationStatus ?? "",
    query.riskCategory ?? "",
    query.country ?? "",
    query.search ?? "",
    String(query.pageSize ?? ""),
    query.cursor ?? "",
  ].join("|");

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listMasterRecords(entity, query);
      setRows(result.rows);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(publicMasterError(err));
      setRows([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
    // queryKey captures every list filter used by this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, entity]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { rows, nextCursor, loading, error, reload };
}

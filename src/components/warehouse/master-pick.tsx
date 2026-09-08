"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listMasterRecords } from "@/lib/masters/client";
import type { MasterEntity } from "@/types/masters";

export function MasterPick({
  entity,
  label,
  value,
  onChange,
  warehouseId,
  required,
}: {
  entity: MasterEntity;
  label: string;
  value: string;
  onChange: (value: string) => void;
  warehouseId?: string;
  required?: boolean;
}) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listMasterRecords(entity, {
        status: "active",
        warehouseId,
        pageSize: 100,
      })
        .then((result) => setRows(result.rows))
        .catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entity, warehouseId]);

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11 w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {String(
                row.materialName ||
                  row.productName ||
                  row.warehouseName ||
                  row.locationCode ||
                  row.supplierName ||
                  row.vendorName ||
                  row.uomCode ||
                  row.name ||
                  row.id
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

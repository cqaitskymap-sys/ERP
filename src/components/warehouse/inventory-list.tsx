"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/feedback/status-badge";
import { WarehouseList } from "@/components/warehouse/warehouse-list";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inventoryItemTypeOptions,
  inventoryStatusOptions,
  labelFor,
  qualityStatusOptions,
  qualityTone,
} from "@/lib/inventory/catalog";
import { classifyInventoryExpiry, inventoryExpiryLabel } from "@/lib/inventory/expiry";

const ALL = "__all__";

export function InventoryList() {
  const [filters, setFilters] = useState({
    itemType: "",
    qualityStatus: "",
    inventoryStatus: "",
    expiry: "",
    batchNumber: "",
  });

  return (
    <WarehouseList
      title="Inventory"
      description="Every quantity is a batch, warehouse, location, and quality-status bucket."
      resource="inventory"
      permission="inventory:read"
      exportColumns={[
        "itemCode",
        "itemName",
        "itemType",
        "batchNumber",
        "warehouseId",
        "locationId",
        "availableQuantity",
        "uom",
        "qualityStatus",
        "inventoryStatus",
        "expiryDate",
      ]}
      filterValues={filters}
      rowHref={(row) => `/warehouse/inventory/${row.id}`}
      filters={
        <>
          <Filter
            value={filters.itemType}
            placeholder="Item type"
            options={inventoryItemTypeOptions}
            onChange={(itemType) => setFilters((current) => ({ ...current, itemType }))}
          />
          <Filter
            value={filters.qualityStatus}
            placeholder="Quality status"
            options={qualityStatusOptions}
            onChange={(qualityStatus) => setFilters((current) => ({ ...current, qualityStatus }))}
          />
          <Filter
            value={filters.inventoryStatus}
            placeholder="Inventory status"
            options={inventoryStatusOptions}
            onChange={(inventoryStatus) => setFilters((current) => ({ ...current, inventoryStatus }))}
          />
          <Filter
            value={filters.expiry}
            placeholder="Expiry"
            options={[
              { value: "expired", label: "Expired" },
              { value: "expiring_7", label: "7 days" },
              { value: "expiring_30", label: "30 days" },
              { value: "expiring_60", label: "60 days" },
              { value: "expiring_90", label: "90 days" },
            ]}
            onChange={(expiry) => setFilters((current) => ({ ...current, expiry }))}
          />
        </>
      }
      columns={[
        { key: "itemCode", header: "Item code" },
        { key: "itemName", header: "Item name" },
        { key: "itemType", header: "Type", hideOnMobile: true, cell: (row) => labelFor(inventoryItemTypeOptions, row.itemType) },
        { key: "batchNumber", header: "Batch / lot" },
        { key: "warehouseId", header: "Warehouse", hideOnMobile: true },
        { key: "locationId", header: "Location", hideOnMobile: true },
        { key: "availableQuantity", header: "Qty" },
        { key: "uom", header: "UOM" },
        {
          key: "qualityStatus",
          header: "Quality",
          cell: (row) => (
            <StatusBadge label={labelFor(qualityStatusOptions, row.qualityStatus)} tone={qualityTone(row.qualityStatus)} />
          ),
        },
        {
          key: "expiryDate",
          header: "Expiry",
          hideOnMobile: true,
          cell: (row) => inventoryExpiryLabel(classifyInventoryExpiry(row.expiryDate)),
        },
        {
          key: "inventoryStatus",
          header: "Status",
          hideOnMobile: true,
          cell: (row) => labelFor(inventoryStatusOptions, row.inventoryStatus),
        },
        {
          key: "actions",
          header: "Actions",
          cell: (row) => (
            <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/warehouse/inventory/${row.id}`}>View</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/warehouse/stock-card?itemId=${String(row.itemId)}&batchNumber=${String(row.batchNumber)}`}>
                  Card
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/warehouse/traceability?batchNumber=${String(row.batchNumber)}`}>Trace</Link>
              </Button>
            </div>
          ),
        },
      ]}
    />
  );
}

function Filter({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
      <SelectTrigger className="min-h-11 w-full lg:w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import { SalesList } from "@/components/sales/sales-list";

export function FulfilmentPage() {
  return (
    <SalesList
      title="Order fulfilment"
      description="Confirmed and in-flight orders with allocation and dispatch readiness. Inventory mutations use warehouse services."
      resource="orders"
      permission="salesOrder:read"
      exportColumns={["salesOrderNumber", "customerId", "status", "fulfilmentPercent", "remainingQuantity", "promisedDeliveryDate"]}
      filterValues={{}}
      columns={[
        { key: "salesOrderNumber", header: "SO number" },
        { key: "customerId", header: "Customer" },
        { key: "status", header: "Status" },
        { key: "fulfilmentPercent", header: "Fulfilment %" },
        { key: "remainingQuantity", header: "Remaining", hideOnMobile: true },
        { key: "promisedDeliveryDate", header: "Promised", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/orders/${row.id}`}
    />
  );
}

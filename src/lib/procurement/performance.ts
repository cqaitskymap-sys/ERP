import { actorStamp, writeOf } from "@/lib/procurement/helpers";
import { money } from "@/lib/procurement/money";
import type { AtomicWrite } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export const VENDOR_PROCUREMENT_EVENTS = "vendorProcurementEvents";

export function vendorProcurementEventWrite(options: {
  vendorId: string;
  purchaseOrderId: string;
  receiptId?: string;
  expectedDeliveryDate?: string;
  actualDate?: string;
  orderedQuantity?: number;
  receivedQuantity?: number;
  documentationIssue?: boolean;
  session: SessionPayload;
}): AtomicWrite {
  const id = crypto.randomUUID();
  const actual = options.actualDate || new Date().toISOString().slice(0, 10);
  const expected = options.expectedDeliveryDate || "";
  const onTime = expected ? actual <= expected : null;
  const ordered = money(options.orderedQuantity);
  const received = money(options.receivedQuantity);
  return writeOf(
    VENDOR_PROCUREMENT_EVENTS,
    id,
    {
      eventId: id,
      vendorId: options.vendorId,
      purchaseOrderId: options.purchaseOrderId,
      receiptId: options.receiptId || "",
      expectedDeliveryDate: expected,
      actualDate: actual,
      onTime,
      late: onTime === false,
      orderedQuantity: ordered,
      receivedQuantity: received,
      quantityAccurate: ordered > 0 ? received === ordered : null,
      partialDelivery: ordered > 0 && received > 0 && received < ordered,
      documentationIssue: Boolean(options.documentationIssue),
      qualityScore: null,
      qcPending: true,
      remarks: "Procurement delivery metric only. QC quality scores are not calculated without QC data.",
      ...actorStamp(options.session),
    },
    { exists: false }
  );
}

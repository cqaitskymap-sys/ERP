import { createNamedError } from "@/lib/masters/errors";
import { queryMasterDocuments } from "@/lib/masters/firestore";

export async function convertQuantity(options: {
  fromUomId: string;
  toUomId: string;
  quantity: number;
  idToken: string;
}) {
  if (options.fromUomId === options.toUomId) return options.quantity;

  const matches = await queryMasterDocuments("uomConversions", options.idToken, {
    filters: [
      {
        field: "uniqueKey",
        value: `${options.fromUomId}__${options.toUomId}`.toUpperCase(),
      },
      { field: "status", value: "active" },
    ],
    limit: 1,
  });

  const rule = matches[0];
  if (!rule) {
    throw createNamedError(
      "ValidationError",
      "No conversion rule exists for these units."
    );
  }

  return options.quantity * Number(rule.factor);
}

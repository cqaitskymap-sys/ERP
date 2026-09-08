import { writeAuditLog } from "@/lib/auth/firestore-rest";
import { createNamedError } from "@/lib/masters/errors";
import {
  queryMasterDocuments,
  readMasterDocument,
  sanitizeMasterRecord,
  writeMasterDocument,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

function padNumber(value: number, length: number) {
  return String(value).padStart(length, "0");
}

function yearToken(value: string) {
  const match = value.match(/20\d{2}/);
  return match?.[0] || value.replace(/\s+/g, "");
}

export function formatDocumentNumber(config: {
  prefix: string;
  separator: string;
  financialYear?: string;
  currentNumber: number;
  numberLength: number;
}) {
  const parts = [config.prefix];
  if (config.financialYear) parts.push(yearToken(String(config.financialYear)));
  parts.push(padNumber(config.currentNumber, config.numberLength));
  return parts.join(config.separator || "-");
}

async function resolveYearLabel(financialYear: string | undefined, idToken: string) {
  if (!financialYear) return "";
  const direct = yearToken(financialYear);
  if (direct && direct !== financialYear.replace(/\s+/g, "")) return direct;
  const fy = await readMasterDocument("financialYears", financialYear, idToken);
  return fy ? yearToken(String(fy.name || financialYear)) : yearToken(financialYear);
}

export async function ensureDocumentNumberSeries(options: {
  documentType: string;
  prefix: string;
  financialYear?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const documentType = options.documentType.trim().toUpperCase();
  const year = options.financialYear?.trim() || "";
  const uniqueKey = `${documentType}__${year}`;
  const matches = await queryMasterDocuments("documentNumbering", options.idToken, {
    filters: year
      ? [{ field: "uniqueKey", value: uniqueKey }]
      : [{ field: "documentType", value: documentType }],
    limit: 5,
  });
  if (matches.some((item) => item.status === "active")) return;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await writeMasterDocument(
    "documentNumbering",
    id,
    {
      documentNumberingId: id,
      documentType,
      prefix: options.prefix,
      separator: "-",
      financialYear: year,
      startingNumber: 1,
      currentNumber: 0,
      numberLength: 5,
      resetFrequency: "yearly",
      status: "active",
      uniqueKey,
      searchIndex: `${documentType} ${options.prefix}`.toLowerCase(),
      nameIndex: documentType.toLowerCase(),
      createdBy: options.session.uid,
      createdAt: now,
      updatedBy: options.session.uid,
      updatedAt: now,
    },
    options.idToken
  );
}

export async function nextDocumentNumber(options: {
  documentType: string;
  financialYear?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const documentType = options.documentType.trim().toUpperCase();
  const year = options.financialYear?.trim() || "";
  const uniqueKey = `${documentType}__${year}`;

  const matches = await queryMasterDocuments("documentNumbering", options.idToken, {
    filters: year
      ? [{ field: "uniqueKey", value: uniqueKey }]
      : [{ field: "documentType", value: documentType }],
    limit: 8,
  });

  const config =
    matches.find((item) => item.status === "active") ??
    matches.find((item) => !year || String(item.financialYear || "") === year);
  if (!config) {
    throw createNamedError(
      "ValidationError",
      "No document numbering configuration exists for this document type."
    );
  }
  if (config.status !== "active") {
    throw createNamedError("ValidationError", "This number series is inactive.");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const latest = await readMasterDocument(
      "documentNumbering",
      String(config.id),
      options.idToken
    );
    if (!latest) throw createNamedError("ValidationError", "Number series was not found.");

    const start = Number(latest.startingNumber || 1);
    const last = Number(latest.currentNumber || Math.max(0, start - 1));
    const number = last + 1;
    const yearLabel = await resolveYearLabel(
      String(latest.financialYear || year || ""),
      options.idToken
    );
    const formatted = formatDocumentNumber({
      prefix: String(latest.prefix),
      separator: String(latest.separator || "-"),
      financialYear: yearLabel,
      currentNumber: number,
      numberLength: Number(latest.numberLength || 5),
    });

    try {
      await writeMasterDocument(
        "documentNumbering",
        String(latest.id),
        {
          ...sanitizeMasterRecord(latest),
          currentNumber: number,
          updatedBy: options.session.uid,
          updatedAt: new Date().toISOString(),
        },
        options.idToken,
        latest._updateTime ? String(latest._updateTime) : undefined
      );
      await writeAuditLog(options.idToken, {
        actorId: options.session.uid,
        actorEmail: options.session.email,
        action: "CONFIGURE",
        module: "masters",
        resource: "documentNumbering",
        resourceId: String(latest.id),
        description: `Issued ${formatted}.`,
        severity: "info",
        newData: { documentNumber: formatted, documentType },
        createdAt: new Date().toISOString(),
      });
      return { documentNumber: formatted, currentNumber: number, documentType };
    } catch (error) {
      lastError = error;
    }
  }

  throw createNamedError(
    "ValidationError",
    lastError instanceof Error
      ? "Unable to issue a unique document number. Try again."
      : "Unable to issue a unique document number."
  );
}

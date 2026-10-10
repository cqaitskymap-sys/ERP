import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  const key = match[1].trim();
  const value = match[2].trim();
  if (!process.env[key]) process.env[key] = value;
}

const { signInIdentityUser } = await import("../src/lib/auth/identity-toolkit");

async function main() {
  const email = process.env.PHASE3_EMAIL;
  const password = process.env.PHASE3_PASSWORD;
  if (!email || !password) {
    console.log("SKIP authenticated master tests (PHASE3_EMAIL / PHASE3_PASSWORD not set).");
    return;
  }

  const identity = await signInIdentityUser(email, password);
  const sessionRes = await fetch("http://localhost:3000/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: identity.idToken, remember: true }),
  });
  const session = (await sessionRes.json()) as { ok?: boolean; error?: string };
  console.log("session", sessionRes.status, session.ok ? "ok" : session.error);

  const headers = {
    "Content-Type": "application/json",
    "x-firebase-id-token": identity.idToken,
    cookie: sessionRes.headers.get("set-cookie") || "",
  };

  const company = {
    companyCode: "ATH1",
    companyName: "PATRI Test Pharma",
    legalName: "PATRI Test Pharma Pvt Ltd",
    addressLine1: "Plot 1 Industrial Area",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    postalCode: "500001",
    email: "qa@aetheris.test",
    gstNumber: "36AABCU9603R1ZX",
    panNumber: "AABCU9603R",
    status: "active",
  };

  const created = await fetch("http://localhost:3000/api/masters/companies", {
    method: "POST",
    headers,
    body: JSON.stringify(company),
  });
  const createdBody = (await created.json()) as {
    error?: string;
    record?: { companyCode?: string };
  };
  console.log("create", created.status, createdBody.error || createdBody.record?.companyCode);

  const invalid = await fetch("http://localhost:3000/api/masters/companies", {
    method: "POST",
    headers,
    body: JSON.stringify({ companyCode: "X", companyName: "X" }),
  });
  const invalidBody = (await invalid.json()) as { error?: string };
  console.log("validation", invalid.status, invalidBody.error);

  const dup = await fetch("http://localhost:3000/api/masters/companies", {
    method: "POST",
    headers,
    body: JSON.stringify(company),
  });
  const dupBody = (await dup.json()) as { error?: string };
  console.log("duplicate", dup.status, dupBody.error);

  const list = await fetch(
    "http://localhost:3000/api/masters/companies?status=active&pageSize=5",
    { headers }
  );
  const listBody = (await list.json()) as { rows?: unknown[]; error?: string };
  console.log("list", list.status, listBody.rows?.length ?? listBody.error);

  const unauthenticated = await fetch("http://localhost:3000/api/masters/companies");
  console.log("unauthenticated", unauthenticated.status);
}

await main();

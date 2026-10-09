import { HR_COLLECTIONS } from "@/lib/hr/collections";
import {
  calculateEmployeePayroll,
  calculateStatutoryDeductions,
  pickEffectiveStatutoryRule,
} from "@/lib/hr/calculate";
import {
  actorStamp,
  auditHr,
  canViewPayroll,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueHrNumber,
  listByField,
  maskPayrollFields,
  notifyHr,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  searchIndex,
  text,
  writeOf,
} from "@/lib/hr/helpers";
import { loadHrSettings, transitionEmployeeStatus } from "@/lib/hr/server";
import {
  PAYROLL_TRANSITIONS,
  SEPARATION_TRANSITIONS,
  canTransition,
  isFinalizedPayroll,
} from "@/lib/hr/status";
import { addMoney, money } from "@/lib/finance/money";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import { payrollRunSchema, statutoryRuleSchema } from "@/lib/validation/hr";
import type { SessionPayload } from "@/types/auth";

function assertTransition(map: Record<string, string[]>, current: string, next: string, label: string) {
  if (!canTransition(map, current, next)) fail(`Cannot ${label}: ${current} → ${next}.`);
}

export async function createStatutoryRuleVersion(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hr:update");
  const data = parseOrFail(statutoryRuleSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    ruleId: id,
    ...data,
    status: "draft",
    requiresProfessionalReview: true,
    searchIndex: searchIndex(data.name, data.effectiveFrom),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.statutoryRules, id, record, { exists: false })], options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "STATUTORY_RULE_CREATED",
    resource: HR_COLLECTIONS.statutoryRules,
    resourceId: id,
    description: `Statutory rule version draft created: ${data.name}.`,
    severity: "warning",
  });
  return { id, record };
}

export async function approveStatutoryRule(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  comment?: string;
}) {
  ensurePermission(options.session, "hrPayroll:approve");
  const current = await requireRecord(HR_COLLECTIONS.statutoryRules, options.id, options.idToken, "Statutory rule");
  if (text(current.status) === "approved") fail("Rule already approved.");
  const next = {
    ...current,
    status: "approved",
    reviewedBy: options.session.uid,
    reviewedAt: new Date().toISOString(),
    reviewComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.statutoryRules, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createPayrollRun(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrPayroll:create");
  const data = parseOrFail(payrollRunSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  if (data.periodTo < data.periodFrom) fail("Payroll period is invalid.");

  const duplicates = await queryMasterDocuments(HR_COLLECTIONS.payrollRuns, options.idToken, {
    filters: [
      { field: "periodFrom", value: data.periodFrom },
      { field: "periodTo", value: data.periodTo },
    ],
    limit: 20,
  }).catch(() => []);
  if (
    duplicates.some(
      (row) =>
        text(row.departmentId || "") === text(data.departmentId || "") &&
        !["cancelled"].includes(text(row.status))
    )
  ) {
    fail("A payroll run already exists for this period and department scope.");
  }

  const numbered = await issueHrNumber("PAY", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    payrollRunId: id,
    payrollNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    calculationVersion: 1,
    entryCount: 0,
    exceptionCount: 0,
    totals: {},
    searchIndex: searchIndex(numbered.documentNumber, data.periodFrom, data.periodTo),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.payrollRuns, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "PAYROLL_RUN_CREATED",
    resource: HR_COLLECTIONS.payrollRuns,
    resourceId: id,
    description: `Payroll run ${numbered.documentNumber} created.`,
  });
  return { id, record };
}

export async function validatePayrollInputs(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrPayroll:create");
  const run = await requireRecord(HR_COLLECTIONS.payrollRuns, options.id, options.idToken, "Payroll run");
  assertTransition(PAYROLL_TRANSITIONS, text(run.status), "input_validation", "validate inputs");
  const employees = await queryMasterDocuments(HR_COLLECTIONS.employees, options.idToken, {
    filters: [{ field: "status", value: "active" }],
    limit: 500,
  }).catch(() => []);
  const scoped = text(run.departmentId)
    ? employees.filter((row) => text(row.departmentId) === text(run.departmentId))
    : employees;
  const exceptions: string[] = [];
  for (const employee of scoped) {
    const comp = await queryMasterDocuments(HR_COLLECTIONS.compensation, options.idToken, {
      filters: [{ field: "employeeId", value: String(employee.id) }],
      limit: 1,
    }).catch(() => []);
    if (!comp.length) exceptions.push(`Missing compensation for ${text(employee.employeeCode)}`);
  }
  const next = {
    ...run,
    status: "input_validation",
    exceptionCount: exceptions.length,
    exceptions,
    validatedEmployeeCount: scoped.length,
    ...actorStamp(options.session, run),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.payrollRuns, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function calculatePayrollRun(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrPayroll:create");
  const run = await requireRecord(HR_COLLECTIONS.payrollRuns, options.id, options.idToken, "Payroll run");
  if (!["input_validation", "calculated", "exception_review"].includes(text(run.status))) {
    fail("Payroll must be validated before calculation.");
  }
  if (isFinalizedPayroll(text(run.status))) fail("Finalized payroll cannot be recalculated.");

  const existingEntries = await listByField(HR_COLLECTIONS.payrollEntries, "payrollRunId", options.id, options.idToken, 500);
  if (existingEntries.length) {
    fail("Payroll entries already exist for this run. Create an adjustment/reversal process for corrections.");
  }

  const employees = await queryMasterDocuments(HR_COLLECTIONS.employees, options.idToken, {
    filters: [{ field: "status", value: "active" }],
    limit: 500,
  }).catch(() => []);
  const scoped = text(run.departmentId)
    ? employees.filter((row) => text(row.departmentId) === text(run.departmentId))
    : employees;

  const rules = await queryMasterDocuments(HR_COLLECTIONS.statutoryRules, options.idToken, {
    filters: [{ field: "status", value: "approved" }],
    limit: 50,
  }).catch(() => []);
  const rule = pickEffectiveStatutoryRule(
    rules.map((row) => ({
      id: String(row.id),
      effectiveFrom: text(row.effectiveFrom),
      effectiveTo: text(row.effectiveTo) || null,
      pfEmployeeRate: Number(row.pfEmployeeRate || 0),
      pfEmployerRate: Number(row.pfEmployerRate || 0),
      pfWageCeiling: row.pfWageCeiling,
      esiEmployeeRate: Number(row.esiEmployeeRate || 0),
      esiEmployerRate: Number(row.esiEmployerRate || 0),
      esiWageCeiling: row.esiWageCeiling,
      professionalTax: row.professionalTax,
    })),
    text(run.periodTo)
  );

  const writes: AtomicWrite[] = [];
  let grossTotal = money(0);
  let netTotal = money(0);
  let employerTotal = money(0);
  const exceptions: string[] = Array.isArray(run.exceptions) ? [...(run.exceptions as string[])] : [];

  for (const employee of scoped) {
    const comps = await queryMasterDocuments(HR_COLLECTIONS.compensation, options.idToken, {
      filters: [{ field: "employeeId", value: String(employee.id) }],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      limit: 1,
    }).catch(() => []);
    const compensation = comps[0];
    if (!compensation) {
      exceptions.push(`Skipped ${text(employee.employeeCode)}: no compensation`);
      continue;
    }

    const overtimeRows = await queryMasterDocuments(HR_COLLECTIONS.overtime, options.idToken, {
      filters: [
        { field: "employeeId", value: String(employee.id) },
        { field: "status", value: "approved" },
      ],
      limit: 100,
    }).catch(() => []);
    const periodOt = overtimeRows.filter(
      (row) => text(row.overtimeDate) >= text(run.periodFrom) && text(row.overtimeDate) <= text(run.periodTo)
    );
    // Overtime amount is not auto-priced; include minutes metadata only unless compensation defines rate.
    const overtimeAmount = money(0);

    const statutory = rule
      ? calculateStatutoryDeductions({
          grossEarnings: money(compensation.basic),
          pfEmployeeRate: Number(rule.pfEmployeeRate || 0),
          pfEmployerRate: Number(rule.pfEmployerRate || 0),
          pfWageCeiling: rule.pfWageCeiling,
          esiEmployeeRate: Number(rule.esiEmployeeRate || 0),
          esiEmployerRate: Number(rule.esiEmployerRate || 0),
          esiWageCeiling: rule.esiWageCeiling,
          professionalTax: rule.professionalTax,
          tds: 0,
        })
      : {
          employeeDeductions: money(0),
          employerContributions: money(0),
          requiresProfessionalReview: true,
          note: "No approved statutory rule effective for this period.",
        };

    const calc = calculateEmployeePayroll({
      basic: compensation.basic,
      hra: compensation.hra,
      otherAllowances: compensation.otherAllowances,
      overtime: overtimeAmount,
      employeeDeductions: statutory.employeeDeductions,
      employerContributions: statutory.employerContributions,
    });

    const entryId = crypto.randomUUID();
    const entry = {
      entryId,
      payrollRunId: options.id,
      employeeId: String(employee.id),
      employeeCode: text(employee.employeeCode),
      fullName: text(employee.fullName),
      departmentId: text(employee.departmentId),
      compensationId: String(compensation.id),
      statutoryRuleId: rule ? String((rule as { id?: string }).id || "") : "",
      overtimeRequestIds: periodOt.map((row) => String(row.id)),
      overtimeMinutes: periodOt.reduce((sum, row) => sum + Number(row.overtimeMinutes || 0), 0),
      ...calc,
      statutoryNote: "note" in statutory ? statutory.note : "",
      requiresProfessionalReview: true,
      status: "calculated",
      payslipId: "",
      searchIndex: searchIndex(employee.employeeCode, employee.fullName, options.id),
      ...actorStamp(options.session),
    };
    writes.push(writeOf(HR_COLLECTIONS.payrollEntries, entryId, entry, { exists: false }));
    grossTotal = addMoney(grossTotal, calc.grossEarnings);
    netTotal = addMoney(netTotal, calc.netPayable);
    employerTotal = addMoney(employerTotal, calc.employerTotalCost);
  }

  const next = {
    ...run,
    status: "calculated",
    calculationVersion: Number(run.calculationVersion || 1),
    entryCount: writes.length,
    exceptionCount: exceptions.length,
    exceptions,
    statutoryRuleId: rule ? String((rule as { id?: string }).id || "") : "",
    totals: {
      grossEarnings: grossTotal,
      netPayable: netTotal,
      employerTotalCost: employerTotal,
    },
    calculatedAt: new Date().toISOString(),
    ...actorStamp(options.session, run),
  };
  writes.push(writeOf(HR_COLLECTIONS.payrollRuns, options.id, next));
  await commitWrites(writes, options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "PAYROLL_CALCULATED",
    resource: HR_COLLECTIONS.payrollRuns,
    resourceId: options.id,
    description: `Payroll ${text(run.payrollNumber)} calculated with ${writes.length - 1} entries.`,
  });
  return { id: options.id, record: next };
}

export async function transitionPayrollRun(options: {
  id: string;
  action: string;
  comment?: string;
  paymentReference?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(HR_COLLECTIONS.payrollRuns, options.id, options.idToken, "Payroll run");
  const map: Record<string, string> = {
    validate: "input_validation",
    calculate: "calculated",
    exception_review: "exception_review",
    hr_review: "hr_review",
    finance_review: "finance_review",
    approve: "approved",
    finalize: "finalized",
    payment_reference: "payment_referenced",
    reconcile: "reconciled",
    reject: "rejected",
    cancel: "cancelled",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail(`Unsupported payroll action: ${options.action}`);

  if (options.action === "validate") return validatePayrollInputs(options);
  if (options.action === "calculate") return calculatePayrollRun(options);

  if (["approve", "finalize"].includes(options.action)) {
    ensurePermission(options.session, "hrPayroll:approve");
  } else if (options.action === "finance_review") {
    ensurePermission(options.session, "hrPayroll:approve");
  } else {
    ensurePermission(options.session, "hrPayroll:create");
  }

  if (isFinalizedPayroll(text(current.status)) && !["payment_reference", "reconcile"].includes(options.action)) {
    fail("Finalized payroll cannot be silently edited. Use an authorized adjustment process.");
  }
  assertTransition(PAYROLL_TRANSITIONS, text(current.status), nextStatus, options.action);

  const settings = await loadHrSettings(options.idToken);
  if (options.action === "approve" && settings.payrollRequiresFinanceApproval && text(current.status) !== "finance_review") {
    fail("Finance review is required before payroll approval.");
  }
  if (options.action === "payment_reference" && !text(options.paymentReference)) {
    fail("Payment reference is required. Do not mark salary payments successful without confirmation.");
  }

  const next = {
    ...current,
    status: nextStatus,
    lastComment: options.comment || "",
    paymentReference:
      options.action === "payment_reference" ? text(options.paymentReference) : current.paymentReference || "",
    finalizedAt: nextStatus === "finalized" ? new Date().toISOString() : current.finalizedAt || "",
    finalizedBy: nextStatus === "finalized" ? options.session.uid : current.finalizedBy || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.payrollRuns, options.id, next)], options.idToken);

  if (nextStatus === "finalized") {
    await generatePayslipsForRun({
      payrollRunId: options.id,
      session: options.session,
      idToken: options.idToken,
    });
  }

  await auditHr(options.idToken, options.session, {
    action: "PAYROLL_STATUS",
    resource: HR_COLLECTIONS.payrollRuns,
    resourceId: options.id,
    description: `Payroll ${text(current.payrollNumber)}: ${text(current.status)} → ${nextStatus}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function generatePayslipsForRun(options: {
  payrollRunId: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrPayroll:approve");
  const run = await requireRecord(HR_COLLECTIONS.payrollRuns, options.payrollRunId, options.idToken, "Payroll run");
  const entries = await listByField(
    HR_COLLECTIONS.payrollEntries,
    "payrollRunId",
    options.payrollRunId,
    options.idToken,
    500
  );
  const writes: AtomicWrite[] = [];
  for (const entry of entries) {
    if (text(entry.payslipId)) continue;
    const numbered = await issueHrNumber("PSL", options.session, options.idToken);
    const payslipId = crypto.randomUUID();
    const payslip = {
      payslipId,
      payslipNumber: numbered.documentNumber,
      payrollRunId: options.payrollRunId,
      payrollNumber: text(run.payrollNumber),
      periodFrom: text(run.periodFrom),
      periodTo: text(run.periodTo),
      employeeId: text(entry.employeeId),
      employeeCode: text(entry.employeeCode),
      fullName: text(entry.fullName),
      earnings: {
        basic: entry.basic,
        hra: entry.hra,
        otherAllowances: entry.otherAllowances,
        overtime: entry.overtime,
        bonuses: entry.bonuses,
        reimbursements: entry.reimbursements,
      },
      deductions: {
        employeeDeductions: entry.employeeDeductions,
      },
      grossEarnings: entry.grossEarnings,
      netPayable: entry.netPayable,
      employerContributions: entry.employerContributions,
      paymentStatus: "pending_confirmation",
      paymentReference: "",
      status: "issued",
      searchIndex: searchIndex(numbered.documentNumber, entry.employeeCode),
      ...actorStamp(options.session),
    };
    writes.push(writeOf(HR_COLLECTIONS.payslips, payslipId, payslip, { exists: false }));
    writes.push(
      writeOf(HR_COLLECTIONS.payrollEntries, String(entry.id), {
        ...entry,
        payslipId,
        ...actorStamp(options.session, entry),
      })
    );
  }
  await commitWrites(writes, options.idToken);
  return { count: writes.length / 2 };
}

export async function transitionSeparation(options: {
  id: string;
  action: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrSeparation:update");
  const current = await requireRecord(HR_COLLECTIONS.separations, options.id, options.idToken, "Separation");
  const map: Record<string, string> = {
    manager_review: "manager_review",
    hr_review: "hr_review",
    department_clearance: "department_clearance",
    asset_clearance: "asset_clearance",
    finance_clearance: "finance_clearance",
    access_deactivation: "access_deactivation",
    final_approval: "final_approval",
    close: "closed",
    cancel: "cancelled",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail(`Unsupported separation action: ${options.action}`);
  assertTransition(SEPARATION_TRANSITIONS, text(current.status), nextStatus, options.action);

  if (["department_clearance", "asset_clearance", "finance_clearance", "close", "final_approval"].includes(options.action)) {
    const tasks = await listByField(HR_COLLECTIONS.clearanceTasks, "separationId", options.id, options.idToken, 50);
    const incomplete = tasks.filter((task) => !["completed", "waived"].includes(text(task.status)));
    if (options.action === "close" && incomplete.length) {
      fail("Cannot close separation while clearance tasks remain incomplete unless waived with authorization.");
    }
    if (options.action === "access_deactivation" || nextStatus === "access_deactivation") {
      // handled below
    }
  }

  let accessDeactivated = Boolean(current.accessDeactivated);
  if (nextStatus === "access_deactivation" || options.action === "access_deactivation") {
    const settings = await loadHrSettings(options.idToken);
    const employee = await requireRecord(
      HR_COLLECTIONS.employees,
      text(current.employeeId),
      options.idToken,
      "Employee"
    );
    if (settings.deactivateAccessOnSeparation && text(employee.userId)) {
      const user = await readMasterDocument("users", text(employee.userId), options.idToken);
      if (user && text(user.status) === "active") {
        await commitWrites(
          [
            writeOf("users", text(employee.userId), {
              ...user,
              status: "inactive",
              updatedAt: new Date().toISOString(),
              updatedBy: options.session.uid,
            }),
          ],
          options.idToken
        );
        accessDeactivated = true;
        await notifyHr(options.idToken, options.session, {
          type: "hr_access_deactivated",
          title: "Access deactivated on separation",
          message: `User linked to ${text(employee.employeeCode)} set inactive. Historical records retained.`,
          module: "hr",
          resource: "separations",
          resourceId: options.id,
          severity: "warning",
          audienceRoles: ["hr", "admin"],
        });
      }
    }
  }

  if (nextStatus === "closed") {
    await transitionEmployeeStatus({
      id: text(current.employeeId),
      toStatus: "separated",
      reason: `Separation ${text(current.separationNumber)} closed`,
      session: options.session,
      idToken: options.idToken,
    });
  }

  const next = {
    ...current,
    status: nextStatus,
    accessDeactivated,
    lastComment: options.comment || "",
    closedAt: nextStatus === "closed" ? new Date().toISOString() : current.closedAt || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.separations, options.id, next)], options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "SEPARATION_STATUS",
    resource: HR_COLLECTIONS.separations,
    resourceId: options.id,
    description: `Separation ${text(current.separationNumber)}: ${text(current.status)} → ${nextStatus}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function completeClearanceTask(options: {
  id: string;
  action: "complete" | "waive";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrSeparation:update");
  const task = await requireRecord(HR_COLLECTIONS.clearanceTasks, options.id, options.idToken, "Clearance task");
  if (options.action === "waive" && !text(options.comment)) {
    fail("Waiving clearance requires a documented authorization reason.");
  }
  const next = {
    ...task,
    status: options.action === "waive" ? "waived" : "completed",
    completedBy: options.session.uid,
    completedAt: new Date().toISOString(),
    comment: options.comment || "",
    ...actorStamp(options.session, task),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.clearanceTasks, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export function filterPayrollForSession<T extends Record<string, unknown>>(
  record: T,
  session: SessionPayload
) {
  if (!canViewPayroll(session)) return maskPayrollFields(record, session) as T;
  return record;
}

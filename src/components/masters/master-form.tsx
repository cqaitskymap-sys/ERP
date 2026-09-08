"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormSelect } from "@/components/forms/form-select";
import { TestParametersField } from "@/components/masters/test-parameters-field";
import { WorkflowStepsField } from "@/components/masters/workflow-steps-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listMasterRecords } from "@/lib/masters/client";
import { getMasterDefinition, type MasterField } from "@/lib/masters/registry";
import { parseForm } from "@/lib/validation/schemas";
import type { MasterEntity, WorkflowStep } from "@/types/masters";

const NONE = "__none__";

interface MasterFormProps {
  entity: MasterEntity;
  values?: Record<string, unknown>;
  readOnly?: boolean;
  submitting?: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
  onCancel?: () => void;
}

function defaultValues(entity: MasterEntity, values?: Record<string, unknown>) {
  const definition = getMasterDefinition(entity)!;
  const next: Record<string, unknown> = {
    status: definition.defaultStatus || "active",
    ...values,
  };
  if (entity === "documentNumbering") {
    next.separator = values?.separator ?? "-";
    next.numberLength = values?.numberLength ?? 5;
    next.startingNumber = values?.startingNumber ?? 1;
    next.resetFrequency = values?.resetFrequency ?? "yearly";
  }
  if (entity === "uoms") next.decimalPrecision = values?.decimalPrecision ?? 2;
  if (entity === "currencies") next.decimalPlaces = values?.decimalPlaces ?? 2;
  if (entity === "financialYears") next.isCurrent = Boolean(values?.isCurrent);
  if (entity === "approvalWorkflows") {
    next.steps = Array.isArray(values?.steps)
      ? values.steps
      : [
          {
            sequence: 1,
            role: "department_head",
            approvalType: "approve",
            required: true,
            label: "Department Head",
          },
        ];
  }
  for (const field of definition.fields) {
    if (next[field.name] === undefined) next[field.name] = "";
  }
  return next;
}

export function MasterForm({
  entity,
  values,
  readOnly,
  submitting,
  onSubmit,
  onCancel,
}: MasterFormProps) {
  const definition = getMasterDefinition(entity)!;
  const [form, setForm] = useState(() => defaultValues(entity, values));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [relations, setRelations] = useState<
    Record<string, Array<{ label: string; value: string; disabled?: boolean }>>
  >({});

  const relationFields = useMemo(
    () => definition.fields.filter((field) => field.type === "relation" && field.relation),
    [definition.fields]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm(defaultValues(entity, values));
      setErrors({});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entity, values]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all(
        relationFields.map(async (field) => {
          const result = await listMasterRecords(field.relation!, {
            status: field.activeOnly ? "active" : "all",
            pageSize: 100,
          }).catch(() => ({ rows: [] }));
          const def = getMasterDefinition(field.relation!);
          return [
            field.name,
            result.rows.map((row) => ({
              label: String(row[def?.nameField || "id"] || row[def?.codeField || "id"] || row.id),
              value: String(row.id),
              disabled: field.activeOnly && row.status !== "active",
            })),
          ] as const;
        })
      ).then((entries) => setRelations(Object.fromEntries(entries)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [relationFields]);

  function setValue(name: string, value: unknown) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseForm(definition.schema, form);
    if (!parsed.data) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data as Record<string, unknown>);
  }

  const visibleFields = definition.fields.filter((field) => {
    if (!field.visibleWhen) return true;
    return field.visibleWhen.values.includes(String(form[field.visibleWhen.field] || ""));
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      {visibleFields.map((field, index) => {
        const previousSection = visibleFields[index - 1]?.section;
        const showSection = Boolean(field.section && field.section !== previousSection);
        return (
          <Fragment key={field.name}>
            {showSection ? (
              <div className="sm:col-span-2 mt-2 border-t pt-4 first:mt-0 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-semibold">{field.section}</h3>
              </div>
            ) : null}
            <FieldControl
              field={field}
              value={form[field.name]}
              error={errors[field.name]}
              disabled={readOnly}
              options={
                field.type === "relation"
                  ? relations[field.name] ?? []
                  : field.options ?? []
              }
              onChange={(value) => setValue(field.name, value)}
            />
          </Fragment>
        );
      })}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
        ) : null}
        {!readOnly ? (
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : values?.id ? "Save changes" : "Create"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FieldControl({
  field,
  value,
  error,
  disabled,
  options,
  onChange,
}: {
  field: MasterField;
  value: unknown;
  error?: string;
  disabled?: boolean;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  onChange: (value: unknown) => void;
}) {
  const spanClass = field.span === 2 ? "sm:col-span-2" : undefined;

  if (field.type === "parameters") {
    return (
      <TestParametersField
        value={Array.isArray(value) ? value : []}
        disabled={disabled}
        error={error}
        onChange={onChange}
      />
    );
  }

  if (field.type === "steps") {
    return (
      <WorkflowStepsField
        value={Array.isArray(value) ? (value as WorkflowStep[]) : []}
        disabled={disabled}
        error={error}
        onChange={onChange}
      />
    );
  }

  if (field.type === "toggle") {
    return (
      <FormField label={field.label} hint={field.hint} error={error} className={spanClass}>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={onChange}
          />
          {Boolean(value) ? "Yes" : "No"}
        </label>
      </FormField>
    );
  }

  if (field.type === "select" || field.type === "relation") {
    const selectValue = value ? String(value) : field.required ? undefined : NONE;
    return (
      <div className={spanClass}>
        <FormSelect
          label={field.label}
          required={field.required}
          hint={field.hint}
          error={error}
          disabled={disabled}
          value={selectValue}
          placeholder={field.type === "relation" ? "Select a record" : "Select"}
          options={
            field.required
              ? options
              : [{ label: "Not specified", value: NONE }, ...options]
          }
          onChange={(next) => onChange(next === NONE ? "" : next)}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <FormField
        label={field.label}
        required={field.required}
        hint={field.hint}
        error={error}
        className={spanClass}
      >
        <Textarea
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormField>
    );
  }

  return (
    <FormField
      label={field.label}
      required={field.required}
      hint={field.hint}
      error={error}
      className={spanClass}
    >
      <Input
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
        value={value === undefined || value === null ? "" : String(value)}
        disabled={disabled}
        step={field.type === "number" ? "any" : undefined}
        onChange={(event) =>
          onChange(
            field.type === "number"
              ? event.target.value === ""
                ? ""
                : Number(event.target.value)
              : event.target.value
          )
        }
      />
    </FormField>
  );
}

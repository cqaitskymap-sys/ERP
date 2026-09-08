"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TestParameter {
  name: string;
  specification: string;
  uom?: string;
  min?: number;
  max?: number;
}

interface TestParametersFieldProps {
  value: TestParameter[];
  disabled?: boolean;
  error?: string;
  onChange: (value: TestParameter[]) => void;
}

export function TestParametersField({
  value,
  disabled,
  error,
  onChange,
}: TestParametersFieldProps) {
  const rows = value.length ? value : [{ name: "", specification: "" }];

  function update(index: number, patch: Partial<TestParameter>) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <Label>Test parameters</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...rows, { name: "", specification: "" }])}
        >
          <Plus className="size-3.5" />
          Add parameter
        </Button>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.name}-${index}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Parameter</Label>
              <Input
                value={row.name}
                disabled={disabled}
                placeholder="Assay"
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Specification</Label>
              <Input
                value={row.specification}
                disabled={disabled}
                placeholder="98.0% – 102.0%"
                onChange={(event) => update(index, { specification: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>UOM</Label>
              <Input
                value={row.uom || ""}
                disabled={disabled}
                onChange={(event) => update(index, { uom: event.target.value })}
              />
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={row.min ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    update(index, {
                      min: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={row.max ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    update(index, {
                      max: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={disabled || rows.length === 1}
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import { FormField } from "@/components/forms/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "@/types/common";

interface FormSelectProps {
  id?: string;
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  options: SelectOption[];
  onChange?: (value: string) => void;
}

export function FormSelect({
  id,
  label,
  value,
  placeholder = "Select an option",
  required,
  hint,
  error,
  disabled,
  options,
  onChange,
}: FormSelectProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      required={required}
      hint={hint}
      error={error}
    >
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

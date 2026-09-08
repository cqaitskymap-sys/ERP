"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScanInput({
  label,
  value,
  onChange,
  placeholder = "Scan or type product, batch, location, or shipment code",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        className="min-h-11"
        inputMode="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
      />
      <p className="text-xs text-muted-foreground">Manual entry is supported. Camera scanning can attach later if the device allows it.</p>
    </div>
  );
}

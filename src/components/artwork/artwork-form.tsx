"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ARTWORK_COMPONENTS } from "@/lib/artwork/status";
import { createArtwork } from "@/lib/artwork/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ArtworkForm() {
  return (
    <RequirePermission permission="artwork:create">
      <Form />
    </RequirePermission>
  );
}

function Form() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("Paracetamol 500 mg");
  const [customerId, setCustomerId] = useState("Cipla Limited");
  const [component, setComponent] = useState<string>(ARTWORK_COMPONENTS[0]);
  const [market, setMarket] = useState("India");
  const [dueDate, setDueDate] = useState("");
  const [remarks, setRemarks] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await createArtwork({ title, productId, customerId, component, market, dueDate, remarks });
      toast.success("Artwork raised", "The job is in draft until you submit it.");
      router.push(`/artwork/requests/${result.id}`);
    } catch (error) {
      toast.error("Unable to raise artwork", publicMasterError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl">
      <PageHeader
        title="New artwork"
        description="Raise a carton, label, foil, or leaflet for the approval lane."
      />
      <div className="grid gap-4 rounded-2xl border border-border/80 bg-card p-5">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Cipla carton, Braille panel" className="min-h-11" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product">
            <Input value={productId} onChange={(event) => setProductId(event.target.value)} required className="min-h-11" />
          </Field>
          <Field label="Customer">
            <Input value={customerId} onChange={(event) => setCustomerId(event.target.value)} required className="min-h-11" />
          </Field>
          <Field label="Component">
            <select className="min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm" value={component} onChange={(event) => setComponent(event.target.value)}>
              {ARTWORK_COMPONENTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Market">
            <Input value={market} onChange={(event) => setMarket(event.target.value)} className="min-h-11" />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="min-h-11" />
          </Field>
        </div>
        <Field label="Remarks">
          <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="What changed in this version" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending} className="min-h-11">
            {pending ? "Saving…" : "Raise artwork"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

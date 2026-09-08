"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { BrandMark } from "@/components/layout/brand-mark";
import { parseForm, setupSchema } from "@/lib/validation/schemas";
import { toast } from "@/lib/feedback/toast";
import { signIn } from "@/lib/auth/auth-service";

export default function SetupPage() {
  const router = useRouter();
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    void fetch("/api/auth/bootstrap")
      .then((response) => response.json())
      .then((body: { bootstrapped?: boolean }) => {
        setBootstrapped(Boolean(body.bootstrapped));
      })
      .catch(() => setBootstrapped(false));
  }, []);

  async function onSubmit(formData: FormData) {
    const parsed = parseForm(setupSchema, {
      name: String(formData.get("name") ?? ""),
      employeeId: String(formData.get("employeeId") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      department: String(formData.get("department") ?? ""),
      designation: String(formData.get("designation") ?? ""),
    });

    if (!parsed.data) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setFormError("");
    setPending(true);

    try {
      const response = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Setup failed.");
      }

      await signIn({
        email: parsed.data.email,
        password: parsed.data.password,
        remember: true,
      });
      toast.success("Workspace initialized", "Super Admin session is active.");
      router.push("/");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Setup failed.");
    } finally {
      setPending(false);
    }
  }

  if (bootstrapped === null) {
    return <p className="text-sm text-muted-foreground">Checking workspace state…</p>;
  }

  if (bootstrapped) {
    return (
      <div>
        <h1 className="font-heading text-3xl font-semibold">Workspace already initialized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an administrator to provision your operator account.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 lg:hidden">
        <BrandMark />
      </div>
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
        First-time setup
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Create the Super Admin
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This can be done once. The account receives full RBAC rights and becomes
        the first auditable operator.
      </p>

      <form action={onSubmit} className="mt-8 grid gap-4">
        <FormField label="Full name" htmlFor="name" required error={errors.name}>
          <Input id="name" name="name" autoComplete="name" />
        </FormField>
        <FormField
          label="Employee ID"
          htmlFor="employeeId"
          required
          error={errors.employeeId}
        >
          <Input id="employeeId" name="employeeId" placeholder="EMP-0001" />
        </FormField>
        <FormField label="Work email" htmlFor="email" required error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          required
          error={errors.password}
          hint="Minimum 8 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone}>
          <Input id="phone" name="phone" />
        </FormField>
        <FormField label="Department" htmlFor="department">
          <Input id="department" name="department" placeholder="Quality Assurance" />
        </FormField>
        <FormField label="Designation" htmlFor="designation">
          <Input id="designation" name="designation" placeholder="Plant Administrator" />
        </FormField>
        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Initializing…" : "Create Super Admin"}
        </Button>
      </form>
    </div>
  );
}

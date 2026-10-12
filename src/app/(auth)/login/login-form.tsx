"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/forms/form-field";
import { BrandMark } from "@/components/layout/brand-mark";
import { useAuth } from "@/hooks/use-auth";
import { mapAuthError } from "@/lib/auth/auth-context";
import { parseForm, signInSchema } from "@/lib/validation/schemas";
import { toast } from "@/lib/feedback/toast";
import { appConfig } from "@/lib/config/app";

function safeNextPath(value: string | null) {
  if (!value) return "/";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("://") ||
    decoded.includes("\0")
  ) {
    return "/";
  }
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, firebaseReady } = useAuth();
  const [pending, setPending] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState(
    searchParams.get("reason") === "inactive"
      ? "This account is deactivated. Contact HR or a system administrator."
      : searchParams.get("reason") === "not-provisioned"
        ? "This Firebase account has no ERP profile. Ask HR or Admin to provision access."
        : ""
  );

  async function onSubmit(formData: FormData) {
    const parsed = parseForm(signInSchema, {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      remember,
    });

    if (!parsed.data) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setFormError("");
    setPending(true);

    try {
      await signIn({
        email: parsed.data.email,
        password: parsed.data.password,
        remember,
      });
      toast.success("Signed in", "Secure session established.");
      router.push(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-8 lg:hidden">
        <BrandMark />
      </div>
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
        Controlled access
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Sign in to the plant workspace
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {appConfig.companyName}. Sessions are verified server-side and written
        to the audit trail.
      </p>

      {!firebaseReady ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Firebase environment variables are incomplete.
        </div>
      ) : null}

      <form action={onSubmit} className="mt-8 grid gap-4">
        <FormField label="Work email" htmlFor="email" required error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="qa.head@plant.example"
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          required
          error={errors.password}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </FormField>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={remember}
              onCheckedChange={(value) => setRemember(value === true)}
            />
            Remember this workstation
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Reset password
          </Link>
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <Button type="submit" disabled={pending || !firebaseReady}>
          {pending ? "Verifying credentials…" : "Enter workspace"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        First plant administrator?{" "}
        <Link href="/setup" className="text-foreground underline-offset-4 hover:underline">
          Initialize the workspace
        </Link>
      </p>
    </div>
  );
}

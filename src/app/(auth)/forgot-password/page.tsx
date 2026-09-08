"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { BrandMark } from "@/components/layout/brand-mark";
import { useAuth } from "@/hooks/use-auth";
import { mapAuthError } from "@/lib/auth/auth-context";
import { parseForm, passwordResetSchema } from "@/lib/validation/schemas";
import { toast } from "@/lib/feedback/toast";

export default function ForgotPasswordPage() {
  const { resetPassword, firebaseReady } = useAuth();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(formData: FormData) {
    const parsed = parseForm(passwordResetSchema, {
      email: String(formData.get("email") ?? ""),
    });
    if (!parsed.data) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setFormError("");
    setPending(true);
    try {
      await resetPassword(parsed.data.email);
      toast.success("Reset email sent", "Check the operator inbox for a password link.");
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
        Account recovery
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Firebase will email a one-time reset link to the provisioned work address.
      </p>

      <form action={onSubmit} className="mt-8 grid gap-4">
        <FormField label="Work email" htmlFor="email" required error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </FormField>
        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        <Button type="submit" disabled={pending || !firebaseReady}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}

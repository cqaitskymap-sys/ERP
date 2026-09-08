"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { FormActions } from "@/components/forms/form-actions";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { updateDocument } from "@/lib/services/firestore-service";
import { USERS_COLLECTION } from "@/lib/auth/constants";
import { getRoleLabel } from "@/lib/permissions/catalog";
import { formatDateTime } from "@/lib/utils/format";
import { toast } from "@/lib/feedback/toast";

export default function ProfilePage() {
  const { profile } = useAuth();
  const [pending, setPending] = useState(false);

  if (!profile) return null;
  const current = profile;

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await updateDocument(USERS_COLLECTION, current.uid, {
        name: String(formData.get("name") ?? current.name),
        phone: String(formData.get("phone") ?? "") || null,
        department: String(formData.get("department") ?? "") || null,
        designation: String(formData.get("designation") ?? "") || null,
        photoURL: String(formData.get("photoURL") ?? "") || null,
      });
      toast.success("Profile updated", "Non-privileged fields were saved.");
    } catch (error) {
      toast.error(
        "Update failed",
        error instanceof Error ? error.message : "Firestore rejected the write."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Operator profile"
        description="Identity used for audit trails, approvals, and training records."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge label={profile.status} tone={profile.status === "active" ? "success" : "warning"} />
        <StatusBadge label={getRoleLabel(profile.role)} tone="info" />
        <StatusBadge label={profile.employeeId} />
      </div>

      <form action={onSubmit} className="grid gap-6">
        <FormSection title="Identity" description="Role and employee ID are controlled by HR or Admin.">
          <FormField label="Full name" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={profile.name} />
          </FormField>
          <FormField label="Email">
            <Input value={profile.email} disabled />
          </FormField>
          <FormField label="Employee ID">
            <Input value={profile.employeeId} disabled />
          </FormField>
          <FormField label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
          </FormField>
          <FormField label="Department" htmlFor="department">
            <Input
              id="department"
              name="department"
              defaultValue={profile.department ?? ""}
            />
          </FormField>
          <FormField label="Designation" htmlFor="designation">
            <Input
              id="designation"
              name="designation"
              defaultValue={profile.designation ?? ""}
            />
          </FormField>
          <FormField label="Profile photo URL" htmlFor="photoURL">
            <Input
              id="photoURL"
              name="photoURL"
              defaultValue={profile.photoURL ?? ""}
            />
          </FormField>
          <FormField label="Created">
            <Input value={formatDateTime(profile.createdAt)} disabled />
          </FormField>
          <FormField label="Last login">
            <Input value={formatDateTime(profile.lastLoginAt)} disabled />
          </FormField>
          <FormActions className="md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </FormActions>
        </FormSection>
      </form>
    </div>
  );
}

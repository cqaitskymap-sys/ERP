"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RequirePermission } from "@/components/auth/require-permission";
import { FormField } from "@/components/forms/form-field";
import { FormSelect } from "@/components/forms/form-select";
import { FormSection } from "@/components/forms/form-section";
import { FormActions } from "@/components/forms/form-actions";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { listDocuments } from "@/lib/services/firestore-service";
import { USERS_COLLECTION } from "@/lib/auth/constants";
import { normalizeUserProfile } from "@/lib/auth/firestore-rest";
import { roleCatalog, getRoleLabel } from "@/lib/permissions/catalog";
import { toast } from "@/lib/feedback/toast";
import type { AccountStatus, UserProfile } from "@/types/auth";
import type { AppRole } from "@/types/permissions";

const columns: DataTableColumn<UserProfile>[] = [
  { key: "employeeId", header: "Employee ID", accessor: "employeeId", sortable: true },
  { key: "name", header: "Name", accessor: "name", sortable: true },
  { key: "email", header: "Email", accessor: "email", hideOnMobile: true },
  {
    key: "role",
    header: "Role",
    accessor: "role",
    cell: (row) => getRoleLabel(row.role),
  },
  {
    key: "status",
    header: "Status",
    accessor: "status",
    cell: (row) => (
      <StatusBadge
        label={row.status}
        tone={row.status === "active" ? "success" : row.status === "invited" ? "info" : "warning"}
      />
    ),
  },
];

export default function UsersAdminPage() {
  return (
    <RequirePermission permission="users:read">
      <UsersAdmin />
    </RequirePermission>
  );
}

function UsersAdmin() {
  const { profile, can } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>("employee");

  async function loadUsers() {
    try {
      const rows = await listDocuments<Record<string, unknown>>(USERS_COLLECTION);
      setUsers(rows.map((row) => normalizeUserProfile(row.id, row)));
    } catch (error) {
      toast.error(
        "Unable to load users",
        error instanceof Error ? error.message : "Check Firestore rules."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createUser(formData: FormData) {
    const payload = {
      name: String(formData.get("name") ?? ""),
      employeeId: String(formData.get("employeeId") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      department: String(formData.get("department") ?? ""),
      designation: String(formData.get("designation") ?? ""),
      role,
      status: "invited" as AccountStatus,
    };

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      temporaryPassword?: string;
    };

    if (!response.ok) {
      toast.error("Provisioning failed", body.error);
      return;
    }

    toast.success(
      "User provisioned",
      body.temporaryPassword
        ? `Temporary password: ${body.temporaryPassword}`
        : "Ask the operator to reset their password."
    );
    await loadUsers();
  }

  async function setStatus(user: UserProfile, status: AccountStatus) {
    const accepted = await confirm({
      title: status === "active" ? "Activate account?" : "Deactivate account?",
      description: `${user.name} will ${status === "active" ? "regain" : "lose"} workspace access immediately.`,
      confirmLabel: status === "active" ? "Activate" : "Deactivate",
      variant: status === "active" ? "default" : "destructive",
    });
    if (!accepted) return;

    const idToken = await getFirebaseAuth().currentUser?.getIdToken();
    const response = await fetch(`/api/users/${user.uid}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, idToken }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      toast.error("Status change blocked", body.error);
      return;
    }
    toast.success("Account status updated");
    await loadUsers();
  }

  return (
    <div>
      <PageHeader
        title="User directory"
        description="Provision operators, assign roles, and activate or deactivate plant access."
      />

      {can("users:create") ? (
        <form action={createUser} className="mb-6">
          <FormSection
            title="Provision operator"
            description="Creates a Firebase Auth account and a controlled ERP profile."
          >
            <FormField label="Full name" htmlFor="name" required>
              <Input id="name" name="name" />
            </FormField>
            <FormField label="Employee ID" htmlFor="employeeId">
              <Input id="employeeId" name="employeeId" />
            </FormField>
            <FormField label="Work email" htmlFor="email" required>
              <Input id="email" name="email" type="email" />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" />
            </FormField>
            <FormField label="Department" htmlFor="department">
              <Input id="department" name="department" />
            </FormField>
            <FormField label="Designation" htmlFor="designation">
              <Input id="designation" name="designation" />
            </FormField>
            <FormSelect
              label="Role"
              value={role}
              onChange={(value) => setRole(value as AppRole)}
              options={roleCatalog.map((item) => ({
                label: item.label,
                value: item.id,
              }))}
            />
            <FormActions className="md:col-span-2">
              <Button type="submit">Create user</Button>
            </FormActions>
          </FormSection>
        </form>
      ) : null}

      <DataTable
        columns={[
          ...columns,
          {
            key: "actions",
            header: "Access",
            cell: (row) =>
              can("users:update") && row.uid !== profile?.uid ? (
                <Button
                  size="sm"
                  variant={row.status === "active" ? "destructive" : "outline"}
                  onClick={() =>
                    void setStatus(row, row.status === "active" ? "inactive" : "active")
                  }
                >
                  {row.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              ) : (
                "—"
              ),
          },
        ]}
        data={users}
        loading={loading}
        searchPlaceholder="Search operators"
      />
    </div>
  );
}

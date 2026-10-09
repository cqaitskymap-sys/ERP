import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Coins,
  Factory,
  FileSearch,
  Landmark,
  MessageSquareWarning,
  PackageSearch,
  Pill,
  ShieldAlert,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import type { Permission } from "@/types/permissions";

export type WorkspaceModuleStatus = "ready" | "planned";

export type WorkspaceModuleCategory =
  | "manufacturing"
  | "supply"
  | "warehouse"
  | "enterprise"
  | "partners"
  | "masters"
  | "administration";

export interface WorkspaceModule {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  status: WorkspaceModuleStatus;
  /** Nav section ids shown in the sidebar while this module is active. */
  sectionIds: string[];
  /** Optional: limit sidebar to these nav item ids within the sections. */
  itemIds?: string[];
  category: WorkspaceModuleCategory;
  /** Path prefixes used to auto-detect the active module from the URL. */
  matchPaths: string[];
}

export const WORKSPACE_CATEGORIES: {
  id: WorkspaceModuleCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "manufacturing",
    label: "Manufacturing",
    description: "Production, quality, regulatory, and plant compliance.",
  },
  {
    id: "supply",
    label: "Supply Chain",
    description: "Procurement and commercial order flow.",
  },
  {
    id: "warehouse",
    label: "Warehouse & Logistics",
    description: "Inventory, put away, picking, dispatch, and cold chain.",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "Finance, people, and audit foundation.",
  },
  {
    id: "partners",
    label: "Partners",
    description: "Customers, vendors, and partner masters.",
  },
  {
    id: "masters",
    label: "Masters",
    description: "Products, materials, and plant reference data.",
  },
  {
    id: "administration",
    label: "Administration",
    description: "Users, company, and system controls.",
  },
];

export const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    id: "production",
    label: "Production",
    description: "Production planning, batch records, and shop-floor execution.",
    href: "/production",
    icon: Factory,
    permission: "production:read",
    status: "ready",
    sectionIds: ["production-ops"],
    category: "manufacturing",
    matchPaths: ["/production"],
  },
  {
    id: "quality",
    label: "Quality Control",
    description: "Laboratory testing, samples, specifications, and COA.",
    href: "/qc",
    icon: ClipboardCheck,
    permission: "qc:read",
    status: "ready",
    sectionIds: ["qc-ops"],
    category: "manufacturing",
    matchPaths: ["/qc"],
  },
  {
    id: "quality-assurance",
    label: "Quality Assurance",
    description: "Batch review, release, hold, rejection, and compliance.",
    href: "/qa",
    icon: BadgeCheck,
    permission: "qa:read",
    status: "ready",
    sectionIds: ["qa-ops"],
    category: "manufacturing",
    matchPaths: ["/qa"],
  },
  {
    id: "regulatory-affairs",
    label: "Regulatory Affairs",
    description: "Product registration, submissions, licenses, and authority correspondence.",
    href: "/ra",
    icon: Landmark,
    permission: "ra:read",
    status: "ready",
    sectionIds: ["ra-ops"],
    category: "manufacturing",
    matchPaths: ["/ra"],
  },
  {
    id: "pharmacovigilance",
    label: "Pharmacovigilance",
    description: "Safety case intake, ICSR foundation, signals, and reporting workflow.",
    href: "/pv",
    icon: ShieldAlert,
    permission: "pv:read",
    status: "ready",
    sectionIds: ["pv-ops"],
    category: "manufacturing",
    matchPaths: ["/pv"],
  },
  {
    id: "complaints",
    label: "Complaints & Market Feedback",
    description: "Customer complaints, investigations, CAPA linkage, and recall workflow.",
    href: "/complaints",
    icon: MessageSquareWarning,
    permission: "complaints:read",
    status: "ready",
    sectionIds: ["complaints-ops"],
    category: "manufacturing",
    matchPaths: ["/complaints"],
  },
  {
    id: "supplier-quality",
    label: "Supplier Quality",
    description: "Vendor qualification, audits, certificates, and supplier compliance.",
    href: "/sq",
    icon: BadgeCheck,
    permission: "supplierQuality:read",
    status: "ready",
    sectionIds: ["supplier-quality-ops"],
    category: "manufacturing",
    matchPaths: ["/sq"],
  },
  {
    id: "procurement",
    label: "Procurement",
    description: "Requisitions, RFQs, quotations, and purchase orders.",
    href: "/procurement",
    icon: PackageSearch,
    permission: "procurement:read",
    status: "ready",
    sectionIds: ["procurement-ops"],
    category: "supply",
    matchPaths: ["/procurement"],
  },
  {
    id: "sales",
    label: "Sales & Commercial Operations",
    description: "Customer orders, quotations, pricing, fulfilment, and order-to-cash.",
    href: "/sales",
    icon: Truck,
    permission: "sales:read",
    status: "ready",
    sectionIds: ["sales-ops"],
    category: "supply",
    matchPaths: ["/sales"],
  },
  {
    id: "warehouse",
    label: "Warehouse & Logistics",
    description: "Inventory, put away, picking, dispatch, cold chain, and distribution.",
    href: "/warehouse",
    icon: Warehouse,
    permission: "warehouse:read",
    status: "ready",
    sectionIds: ["warehouse-ops"],
    category: "warehouse",
    matchPaths: ["/warehouse"],
  },
  {
    id: "finance",
    label: "Finance & Accounting",
    description: "GL, AP/AR, payments, tax, budgets, and financial reports.",
    href: "/finance",
    icon: Landmark,
    permission: "finance:read",
    status: "ready",
    sectionIds: ["finance-ops"],
    category: "enterprise",
    matchPaths: ["/finance"],
  },
  {
    id: "costing",
    label: "Manufacturing Costing",
    description: "Standard and batch costing, variances, and profitability analytics.",
    href: "/costing",
    icon: Coins,
    permission: "costing:read",
    status: "ready",
    sectionIds: ["costing-ops"],
    category: "manufacturing",
    matchPaths: ["/costing"],
  },
  {
    id: "engineering",
    label: "Engineering & Maintenance",
    description: "Equipment, preventive maintenance, calibration, and plant utilities.",
    href: "/engineering",
    icon: Wrench,
    permission: "engineering:read",
    status: "ready",
    sectionIds: ["engineering-ops"],
    category: "manufacturing",
    matchPaths: ["/engineering", "/modules/maintenance"],
  },
  {
    id: "hr",
    label: "HR & Workforce",
    description: "Employees, attendance, leave, payroll, training, and separations.",
    href: "/hr",
    icon: Users,
    permission: "hr:read",
    status: "ready",
    sectionIds: ["hr-ops"],
    category: "enterprise",
    matchPaths: ["/hr", "/modules/hr"],
  },
  {
    id: "audit",
    label: "Audit Trail",
    description: "Immutable activity history for GMP investigations.",
    href: "/modules/audit",
    icon: FileSearch,
    permission: "audit:read",
    status: "planned",
    sectionIds: ["enterprise"],
    itemIds: ["audit"],
    category: "enterprise",
    matchPaths: ["/modules/audit"],
  },
  {
    id: "partners",
    label: "Partners",
    description: "Customer and vendor qualification from live master data.",
    href: "/masters/partners",
    icon: Building2,
    permission: "customers:read",
    status: "ready",
    sectionIds: ["partners"],
    category: "partners",
    matchPaths: [
      "/masters/partners",
      "/masters/customers",
      "/masters/vendors",
    ],
  },
  {
    id: "masters",
    label: "Product & Material Masters",
    description: "Products, materials, sites, and plant reference data.",
    href: "/masters/products",
    icon: Pill,
    permission: "products:read",
    status: "ready",
    sectionIds: ["masters"],
    category: "masters",
    matchPaths: ["/masters"],
  },
  {
    id: "administration",
    label: "Administration",
    description: "Users, company settings, and system controls.",
    href: "/admin/users",
    icon: Users,
    permission: "users:read",
    status: "ready",
    sectionIds: ["administration"],
    category: "administration",
    matchPaths: ["/admin", "/foundation"],
  },
];

const STORAGE_KEY = "patri.erp.activeModule";

export function getWorkspaceModule(id: string | null | undefined) {
  if (!id) return null;
  return WORKSPACE_MODULES.find((module) => module.id === id) ?? null;
}

export function inferWorkspaceModuleId(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;

  const ranked = WORKSPACE_MODULES.flatMap((module) =>
    module.matchPaths.map((path) => ({
      id: module.id,
      path,
      score: path.length,
    }))
  )
    .filter(
      ({ path }) => pathname === path || pathname.startsWith(`${path}/`)
    )
    .sort((left, right) => right.score - left.score);

  // Prefer partners over generic masters when both match.
  if (pathname.startsWith("/masters/partners") || pathname.startsWith("/masters/customers") || pathname.startsWith("/masters/vendors")) {
    return "partners";
  }

  return ranked[0]?.id ?? null;
}

export function readStoredWorkspaceModuleId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredWorkspaceModuleId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

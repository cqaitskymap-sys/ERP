import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/types/permissions";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  status: "ready" | "planned";
  description: string;
  group?: string;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

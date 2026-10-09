import { ENGINEERING_COLLECTIONS } from "@/lib/engineering/collections";
import type { Permission } from "@/types/permissions";

export const ENGINEERING_RESOURCES = {
  equipment: {
    collection: ENGINEERING_COLLECTIONS.equipment,
    read: "engineeringEquipment:read" as Permission,
    create: "engineeringEquipment:create" as Permission,
  },
  riskAssessments: {
    collection: ENGINEERING_COLLECTIONS.riskAssessments,
    read: "engineeringEquipment:read" as Permission,
    create: "engineeringEquipment:update" as Permission,
  },
  maintenancePlans: {
    collection: ENGINEERING_COLLECTIONS.maintenancePlans,
    read: "engineeringMaintenance:read" as Permission,
    create: "engineeringMaintenance:create" as Permission,
  },
  maintenanceTasks: {
    collection: ENGINEERING_COLLECTIONS.maintenanceTasks,
    read: "engineeringMaintenance:read" as Permission,
    create: "engineeringMaintenance:create" as Permission,
  },
  workOrders: {
    collection: ENGINEERING_COLLECTIONS.workOrders,
    read: "engineeringWorkOrder:read" as Permission,
    create: "engineeringWorkOrder:create" as Permission,
  },
  breakdowns: {
    collection: ENGINEERING_COLLECTIONS.breakdowns,
    read: "engineeringWorkOrder:read" as Permission,
    create: "engineeringWorkOrder:create" as Permission,
  },
  instruments: {
    collection: ENGINEERING_COLLECTIONS.instruments,
    read: "engineeringCalibration:read" as Permission,
    create: "engineeringCalibration:create" as Permission,
  },
  calibrations: {
    collection: ENGINEERING_COLLECTIONS.calibrationRecords,
    read: "engineeringCalibration:read" as Permission,
    create: "engineeringCalibration:create" as Permission,
  },
  qualifications: {
    collection: ENGINEERING_COLLECTIONS.qualifications,
    read: "engineeringQualification:read" as Permission,
    create: "engineeringQualification:create" as Permission,
  },
  checklists: {
    collection: ENGINEERING_COLLECTIONS.checklists,
    read: "engineeringMaintenance:read" as Permission,
    create: "engineeringMaintenance:create" as Permission,
  },
  utilitySystems: {
    collection: ENGINEERING_COLLECTIONS.utilitySystems,
    read: "engineeringUtilities:read" as Permission,
    create: "engineeringUtilities:create" as Permission,
  },
  monitoring: {
    collection: ENGINEERING_COLLECTIONS.monitoringRecords,
    read: "engineeringMonitoring:read" as Permission,
    create: "engineeringMonitoring:create" as Permission,
  },
  utilityAlerts: {
    collection: ENGINEERING_COLLECTIONS.utilityAlerts,
    read: "engineeringMonitoring:read" as Permission,
    create: "engineeringMonitoring:update" as Permission,
  },
  spareParts: {
    collection: ENGINEERING_COLLECTIONS.spareLinks,
    read: "engineering:read" as Permission,
    create: "engineering:update" as Permission,
  },
  documents: {
    collection: ENGINEERING_COLLECTIONS.documents,
    read: "engineering:read" as Permission,
    create: "engineering:update" as Permission,
  },
  settings: {
    collection: ENGINEERING_COLLECTIONS.settings,
    read: "engineering:read" as Permission,
    create: "engineering:update" as Permission,
  },
} as const;

export type EngineeringResource = keyof typeof ENGINEERING_RESOURCES;

export function isEngineeringResource(value: string): value is EngineeringResource {
  return value in ENGINEERING_RESOURCES;
}

export const READ_ALIASES: Record<EngineeringResource, Permission[]> = {
  equipment: ["engineeringEquipment:read", "engineering:read", "maintenance:read"],
  riskAssessments: ["engineeringEquipment:read", "engineering:read"],
  maintenancePlans: ["engineeringMaintenance:read", "engineering:read", "maintenance:read"],
  maintenanceTasks: ["engineeringMaintenance:read", "engineering:read", "maintenance:read"],
  workOrders: ["engineeringWorkOrder:read", "engineering:read", "maintenance:read"],
  breakdowns: ["engineeringWorkOrder:read", "engineering:read", "maintenance:read"],
  instruments: ["engineeringCalibration:read", "engineering:read", "maintenance:read"],
  calibrations: ["engineeringCalibration:read", "engineering:read", "maintenance:read"],
  qualifications: ["engineeringQualification:read", "engineering:read"],
  checklists: ["engineeringMaintenance:read", "engineering:read"],
  utilitySystems: ["engineeringUtilities:read", "engineering:read", "maintenance:read"],
  monitoring: ["engineeringMonitoring:read", "engineering:read"],
  utilityAlerts: ["engineeringMonitoring:read", "engineering:read"],
  spareParts: ["engineering:read", "maintenance:read", "inventory:read"],
  documents: ["engineering:read"],
  settings: ["engineering:read", "engineering:update"],
};

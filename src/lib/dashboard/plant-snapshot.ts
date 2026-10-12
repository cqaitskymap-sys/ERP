export interface PlantMetric {
  label: string;
  value: string;
}

export interface PlantSnapshot {
  moduleId: string;
  note: string;
  metrics: PlantMetric[];
}

/** Headline figures for the plant dashboard. Counts follow the live demo registers. */
export const PLANT_SNAPSHOT: PlantSnapshot[] = [
  {
    moduleId: "production",
    note: "Abbott pantoprazole is still on the coater, one day past plan.",
    metrics: [
      { label: "On the floor", value: "2" },
      { label: "With QA", value: "1" },
      { label: "Delayed", value: "1" },
    ],
  },
  {
    moduleId: "quality",
    note: "Paracetamol COA is issued. One sample is still in the lab.",
    metrics: [
      { label: "Under test", value: "1" },
      { label: "COA draft", value: "1" },
      { label: "Sampling", value: "1" },
    ],
  },
  {
    moduleId: "quality-assurance",
    note: "Coating deviation is open. Two CAPA are still running.",
    metrics: [
      { label: "Awaiting review", value: "2" },
      { label: "Open deviation", value: "1" },
      { label: "Open CAPA", value: "2" },
    ],
  },
  {
    moduleId: "document-control",
    note: "The OOS procedure is in review. Dispensing and batch release SOPs are effective.",
    metrics: [
      { label: "Effective", value: "2" },
      { label: "In review", value: "1" },
      { label: "Change request", value: "1" },
    ],
  },
  {
    moduleId: "artwork",
    note: "Abbott carton is with the customer. Sun’s label needs a darker green.",
    metrics: [
      { label: "In review", value: "3" },
      { label: "Changes", value: "1" },
      { label: "Effective", value: "1" },
    ],
  },
  {
    moduleId: "regulatory-affairs",
    note: "One registration is approved. Another is with the authority, and a query is being drafted.",
    metrics: [
      { label: "Approved", value: "1" },
      { label: "Under review", value: "1" },
      { label: "Open query", value: "1" },
    ],
  },
  {
    moduleId: "pharmacovigilance",
    note: "Amoxicillin rash case is in medical review. Follow-up is still out.",
    metrics: [
      { label: "In review", value: "1" },
      { label: "Follow-up", value: "1" },
      { label: "Signal", value: "1" },
    ],
  },
  {
    moduleId: "complaints",
    note: "One market complaint is under investigation. Recall assessment is open.",
    metrics: [
      { label: "Investigating", value: "1" },
      { label: "Recall check", value: "1" },
      { label: "Closed", value: "1" },
    ],
  },
  {
    moduleId: "supplier-quality",
    note: "Huhtamaki foil is conditional. The for-cause audit is planned for November.",
    metrics: [
      { label: "Approved", value: "2" },
      { label: "Conditional", value: "1" },
      { label: "Audit planned", value: "1" },
    ],
  },
  {
    moduleId: "procurement",
    note: "Aurobindo Paracetamol IP is partly in. 350 kg is still due on 18 Oct.",
    metrics: [
      { label: "Open POs", value: "2" },
      { label: "Part received", value: "1" },
      { label: "To approve", value: "1" },
    ],
  },
  {
    moduleId: "sales",
    note: "Cipla’s October order is confirmed. Two orders are past the promised date.",
    metrics: [
      { label: "This month", value: "₹48.5 L" },
      { label: "Open orders", value: "7" },
      { label: "Delayed", value: "2" },
    ],
  },
  {
    moduleId: "warehouse",
    note: "Released paracetamol is in finished goods. One shipment is on the road.",
    metrics: [
      { label: "Ready", value: "1" },
      { label: "In transit", value: "1" },
      { label: "Putaway", value: "1" },
    ],
  },
  {
    moduleId: "finance",
    note: "October sales are posted. Cash sits in HDFC operations and the export escrow.",
    metrics: [
      { label: "Cash and bank", value: "₹2.08 Cr" },
      { label: "October sales", value: "₹48.5 L" },
      { label: "To approve", value: "1" },
    ],
  },
  {
    moduleId: "costing",
    note: "One batch cost is in review, with a variance still open.",
    metrics: [
      { label: "In review", value: "1" },
      { label: "Variance", value: "1" },
      { label: "Standards", value: "2" },
    ],
  },
  {
    moduleId: "engineering",
    note: "A maintenance job is in progress and one instrument is due for calibration.",
    metrics: [
      { label: "In progress", value: "1" },
      { label: "Breakdown", value: "1" },
      { label: "Calibration due", value: "1" },
    ],
  },
  {
    moduleId: "hr",
    note: "Four people are in today. One leave request is waiting.",
    metrics: [
      { label: "On roll", value: "6" },
      { label: "In today", value: "4" },
      { label: "Leave waiting", value: "1" },
    ],
  },
  {
    moduleId: "partners",
    note: "Cipla, Sun, Dr. Reddy’s, Abbott, and Mankind. One customer file is in QA review.",
    metrics: [
      { label: "Customers", value: "5" },
      { label: "Vendors", value: "4" },
      { label: "In QA review", value: "1" },
    ],
  },
  {
    moduleId: "masters",
    note: "Five commercial products are active. One product is still under development.",
    metrics: [
      { label: "Products", value: "6" },
      { label: "Materials", value: "6" },
      { label: "In development", value: "1" },
    ],
  },
  {
    moduleId: "administration",
    note: "Users, company profile, and the controls for this plant.",
    metrics: [
      { label: "Site", value: "Bhiwadi" },
      { label: "Licence", value: "WHO-GMP" },
      { label: "Through", value: "Mar 2028" },
    ],
  },
];

export function plantSnapshot(moduleId: string) {
  return PLANT_SNAPSHOT.find((item) => item.moduleId === moduleId) ?? null;
}

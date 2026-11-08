import { postgres as db } from "./postgres.js";
export { db };

export const MODULE_DEFINITIONS = [
  { name: "Dashboard", category: "Workspace", impact: 5, difficulty: 3 },
  { name: "Communications", category: "Workspace", impact: 3, difficulty: 3 },
  { name: "Tasks", category: "Workspace", impact: 3, difficulty: 3 },
  { name: "Students", category: "Campus", impact: 5, difficulty: 4 },
  { name: "Admissions", category: "Campus", impact: 5, difficulty: 4 },
  { name: "ID card studio", category: "Campus", impact: 3, difficulty: 3 },
  { name: "Documents", category: "Campus", impact: 3, difficulty: 3 },
  {
    name: "Kudos & wellbeing",
    category: "Campus",
    impact: 2,
    difficulty: 2,
  },
  { name: "Profile approvals", category: "Campus", impact: 3, difficulty: 2 },
  { name: "Academics", category: "Learning", impact: 5, difficulty: 4 },
  { name: "Attendance", category: "Learning", impact: 5, difficulty: 3 },
  { name: "Timetable", category: "Learning", impact: 4, difficulty: 5 },
  { name: "Examinations", category: "Learning", impact: 5, difficulty: 4 },
  { name: "Exam roster", category: "Learning", impact: 3, difficulty: 3 },
  {
    name: "Teaching & learning",
    category: "Learning",
    impact: 4,
    difficulty: 5,
  },
  {
    name: "Academic progress",
    category: "Learning",
    impact: 4,
    difficulty: 3,
  },
  { name: "Hall tickets", category: "Learning", impact: 3, difficulty: 2 },
  {
    name: "Fees & collections",
    category: "Finance",
    impact: 5,
    difficulty: 5,
  },
  { name: "Accounting", category: "Finance", impact: 4, difficulty: 5 },
  { name: "Employees", category: "People", impact: 5, difficulty: 3 },
  { name: "HR & Payroll", category: "People", impact: 4, difficulty: 5 },
  { name: "Leave & requests", category: "People", impact: 3, difficulty: 3 },
  { name: "Transport", category: "Services", impact: 3, difficulty: 3 },
  { name: "Library", category: "Services", impact: 3, difficulty: 3 },
  { name: "Inventory", category: "Services", impact: 3, difficulty: 3 },
  {
    name: "Residential life",
    category: "Services",
    impact: 3,
    difficulty: 3,
  },
  { name: "Front office", category: "Services", impact: 3, difficulty: 3 },
  { name: "Gate desk", category: "Services", impact: 3, difficulty: 3 },
  { name: "Placements", category: "Community", impact: 3, difficulty: 3 },
  { name: "Alumni", category: "Community", impact: 2, difficulty: 2 },
  { name: "Campus group", category: "Insights", impact: 4, difficulty: 4 },
  { name: "Analytics", category: "Insights", impact: 4, difficulty: 4 },
  {
    name: "Campus assistant",
    category: "Insights",
    impact: 2,
    difficulty: 4,
  },
  { name: "Settings", category: "Administration", impact: 3, difficulty: 3 },
] as const;
export type ModuleCategory = (typeof MODULE_DEFINITIONS)[number]["category"];
export const MODULE_NAMES = MODULE_DEFINITIONS.map((module) => module.name);
export const MODULE_CATEGORIES = [
  ...new Set(MODULE_DEFINITIONS.map((module) => module.category)),
];
export const LEGACY_MODULE_NAMES = [
  "Dashboard",
  "CRM",
  "Student 360",
  "Employees",
  "Academics",
  "Timetable",
  "Exams",
  "Fees",
  "Accounting",
  "Attendance",
  "ID Cards",
  "CGPA Reports",
  "HR & Payroll",
  "Profile Requests",
  "Absent Students",
  "Face Kiosk",
  "LMS",
  "Leave",
  "Transport",
  "Library",
  "Inventory",
  "Hostel",
  "Front Office",
  "Certificates",
  "Campuses",
  "Communications",
  "Analytics",
  "Alumni Management",
  "Raw Leads",
  "Exam Roster",
  "Lesson Plan Approvals",
  "Tasks",
  "Kudos & Concerns",
  "Gate Scanner",
  "Placements",
] as const;
export const LEGACY_MODULE_RENAMES: Record<string, string> = {
  "Student 360": "Students",
  Exams: "Examinations",
  Fees: "Fees & collections",
  "ID Cards": "ID card studio",
  "CGPA Reports": "Academic progress",
  "Profile Requests": "Profile approvals",
  LMS: "Teaching & learning",
  Leave: "Leave & requests",
  Hostel: "Residential life",
  "Front Office": "Front office",
  Certificates: "Documents",
  Campuses: "Campus group",
  "Alumni Management": "Alumni",
  "Raw Leads": "Admissions",
  "Exam Roster": "Exam roster",
  "Kudos & Concerns": "Kudos & wellbeing",
  "Gate Scanner": "Gate desk",
};
export const STAGES = [
  "frontend",
  "backend",
  "integration",
  "testing",
] as const;
export type StageType = (typeof STAGES)[number];
export const DEFAULT_WEIGHTS = {
  frontend: 30,
  backend: 30,
  integration: 20,
  testing: 20,
};
export function now() { return new Date().toISOString(); }

export interface StageRow {
  id: number;
  module_id: number;
  stage_type: StageType;
  status: string;
  progress: number;
  assigned_developer_id: number | null;
  notes: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}
export interface ModuleRow {
  id: number;
  name: string;
  category: string;
  active: number;
  description: string;
  impact_score: number;
  difficulty_score: number;
  display_order: number;
  notes: string;
  created_at: string;
  updated_at: string;
  stages: StageRow[];
  progress: number;
  status: string;
}

export async function getWeights(): Promise<Record<StageType, number>> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key='stage_weights'")
    .get() as { value: string } | undefined;
  try {
    return row
      ? (JSON.parse(row.value) as Record<StageType, number>)
      : DEFAULT_WEIGHTS;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}
export function deriveStatus(stages: StageRow[]) {
  const by = Object.fromEntries(
    stages.map((stage) => [stage.stage_type, stage]),
  ) as Record<StageType, StageRow>;
  if (STAGES.every((stage) => by[stage]?.status === "Completed"))
    return "Completed";
  if (STAGES.some((stage) => by[stage]?.status === "Blocked")) return "Blocked";
  if (by.testing?.status === "In Progress") return "In Testing";
  if (
    by.integration?.status === "Completed" &&
    by.testing?.status === "Not Started"
  )
    return "Ready for Testing";
  if (by.integration?.status === "In Progress") return "In Integration";
  if (
    by.frontend?.status === "Completed" &&
    by.backend?.status === "Completed" &&
    by.integration?.status === "Not Started"
  )
    return "Ready for Integration";
  if (
    STAGES.every(
      (stage) =>
        by[stage]?.status === "Not Started" && by[stage]?.progress === 0,
    )
  )
    return "Not Started";
  return "In Development";
}
export function calculateProgress(stages: StageRow[], weights: Record<StageType, number> = DEFAULT_WEIGHTS) {
  const values = new Map(
    stages.map((stage) => [stage.stage_type, stage.progress]),
  );
  return Math.round(
    STAGES.reduce(
      (sum, stage) => sum + (values.get(stage) ?? 0) * weights[stage],
      0,
    ) / 100,
  );
}
export async function getModules(): Promise<ModuleRow[]> {
  const modules = await db
    .prepare("SELECT * FROM modules WHERE active=1 ORDER BY display_order")
    .all() as Omit<ModuleRow, "stages" | "progress" | "status">[];
  const allStages = await db
    .prepare("SELECT * FROM stages ORDER BY id")
    .all() as StageRow[];
  const byModule = new Map<number, StageRow[]>();
  allStages.forEach((stage) =>
    byModule.set(stage.module_id, [
      ...(byModule.get(stage.module_id) || []),
      stage,
    ]),
  );
  const weights = await getWeights();
  return modules.map((module) => {
    const stages = byModule.get(module.id) || [];
    return {
      ...module,
      stages,
      progress: calculateProgress(stages, weights),
      status: deriveStatus(stages),
    };
  });
}
export async function getModule(id: number): Promise<ModuleRow | undefined> {
  return (await getModules()).find((module) => module.id === id);
}
export async function logActivity(
  entityType: string,
  entityId: number,
  action: string,
  summary: string,
) {
  await db.prepare(
    "INSERT INTO activity (entity_type,entity_id,action,summary,timestamp) VALUES (?,?,?,?,?)",
  ).run(entityType, entityId, action, summary, now());
}

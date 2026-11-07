import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
const legacyHasColumn = (table: string, column: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
    (item) => item.name === column,
  );

const dbPath =
  process.env.DATABASE_PATH || path.resolve(".data/devpulse.sqlite");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

export function now() {
  return new Date().toISOString();
}

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
      impact_score INTEGER NOT NULL DEFAULT 3 CHECK(impact_score BETWEEN 1 AND 5),
      difficulty_score INTEGER NOT NULL DEFAULT 3 CHECK(difficulty_score BETWEEN 1 AND 5),
      category TEXT NOT NULL DEFAULT 'Other', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      display_order INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS developers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, initials TEXT NOT NULL, role_label TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      stage_type TEXT NOT NULL CHECK(stage_type IN ('frontend','backend','integration','testing')),
      status TEXT NOT NULL DEFAULT 'Not Started' CHECK(status IN ('Not Started','In Progress','Blocked','Completed')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      assigned_developer_id INTEGER REFERENCES developers(id) ON DELETE SET NULL,
      notes TEXT NOT NULL DEFAULT '', started_at TEXT, completed_at TEXT, updated_at TEXT NOT NULL,
      UNIQUE(module_id, stage_type), CHECK((status != 'Completed' OR progress = 100)), CHECK((status != 'Not Started' OR progress = 0))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
      stage_type TEXT CHECK(stage_type IS NULL OR stage_type IN ('frontend','backend','integration','testing')),
      assigned_developer_id INTEGER REFERENCES developers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'To Do' CHECK(status IN ('To Do','In Progress','Blocked','Done')),
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High')),
      due_date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
      action TEXT NOT NULL, summary TEXT NOT NULL, timestamp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  if (!legacyHasColumn("modules", "category"))
    db.exec("ALTER TABLE modules ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'");
  if (!legacyHasColumn("modules", "active"))
    db.exec("ALTER TABLE modules ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))");

  const insertStage = db.prepare(
    `INSERT OR IGNORE INTO stages (module_id,stage_type,updated_at) VALUES (?,?,?)`,
  );
  const timestamp = now();
  const seed = db.transaction(() => {
    const rename = db.prepare("UPDATE modules SET name=? WHERE id=?");
    for (const [from, to] of Object.entries(LEGACY_MODULE_RENAMES)) {
      const oldModule = db
        .prepare("SELECT id FROM modules WHERE name=?")
        .get(from) as { id: number } | undefined;
      const targetExists = db
        .prepare("SELECT id FROM modules WHERE name=?")
        .get(to);
      if (oldModule && !targetExists) rename.run(to, oldModule.id);
    }
    MODULE_DEFINITIONS.forEach((definition, index) => {
      const existing = db
        .prepare("SELECT id FROM modules WHERE name=?")
        .get(definition.name) as { id: number } | undefined;
      const id = existing?.id ?? Number(
        db
          .prepare(
            "INSERT INTO modules (name,category,impact_score,difficulty_score,display_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
          )
          .run(
            definition.name,
            definition.category,
            definition.impact,
            definition.difficulty,
            index + 1,
            timestamp,
            timestamp,
          ).lastInsertRowid,
      );
      db.prepare(
        "UPDATE modules SET category=?,active=1,display_order=? WHERE id=?",
      ).run(definition.category, index + 1, id);
      STAGES.forEach((stage) => insertStage.run(id, stage, timestamp));
    });
    const activeNames = MODULE_NAMES.map(() => "?").join(",");
    db.prepare(
      `UPDATE modules SET active=0 WHERE name NOT IN (${activeNames})`,
    ).run(...MODULE_NAMES);
    db.prepare(
      "INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)",
    ).run("project_name", "Campus ERP", timestamp);
    db.prepare(
      "INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)",
    ).run("stage_weights", JSON.stringify(DEFAULT_WEIGHTS), timestamp);
  });
  seed();
}

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

export function getWeights(): Record<StageType, number> {
  const row = db
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
export function calculateProgress(stages: StageRow[], weights = getWeights()) {
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
export function getModules(): ModuleRow[] {
  const modules = db
    .prepare("SELECT * FROM modules WHERE active=1 ORDER BY display_order")
    .all() as Omit<ModuleRow, "stages" | "progress" | "status">[];
  const allStages = db
    .prepare("SELECT * FROM stages ORDER BY id")
    .all() as StageRow[];
  const byModule = new Map<number, StageRow[]>();
  allStages.forEach((stage) =>
    byModule.set(stage.module_id, [
      ...(byModule.get(stage.module_id) || []),
      stage,
    ]),
  );
  const weights = getWeights();
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
export function getModule(id: number): ModuleRow | undefined {
  return getModules().find((module) => module.id === id);
}
export function logActivity(
  entityType: string,
  entityId: number,
  action: string,
  summary: string,
) {
  db.prepare(
    "INSERT INTO activity (entity_type,entity_id,action,summary,timestamp) VALUES (?,?,?,?,?)",
  ).run(entityType, entityId, action, summary, now());
}

initializeDatabase();

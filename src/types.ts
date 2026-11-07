export type StageType = "frontend" | "backend" | "integration" | "testing";
export type StageStatus =
  | "Not Started"
  | "In Progress"
  | "Blocked"
  | "Completed";
export type ModuleStatus =
  | "Not Started"
  | "In Development"
  | "Ready for Integration"
  | "In Integration"
  | "Ready for Testing"
  | "In Testing"
  | "Blocked"
  | "Completed";
export interface Stage {
  id: number;
  module_id: number;
  stage_type: StageType;
  status: StageStatus;
  progress: number;
  assigned_developer_id: number | null;
  notes: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}
export interface Module {
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
  stages: Stage[];
  progress: number;
  status: ModuleStatus;
}
export interface Developer {
  id: number;
  name: string;
  initials: string;
  role_label: string;
  active: number;
  created_at: string;
  updated_at: string;
  active_assignments?: number;
  completed_assignments?: number;
  open_tasks?: number;
  completed_tasks?: number;
}
export interface Task {
  id: number;
  title: string;
  description: string;
  module_id: number | null;
  module_name?: string | null;
  stage_type: StageType | null;
  assigned_developer_id: number | null;
  developer_name?: string | null;
  status: "To Do" | "In Progress" | "Blocked" | "Done";
  priority: "Low" | "Medium" | "High";
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
export interface Weights {
  frontend: number;
  backend: number;
  integration: number;
  testing: number;
}
export interface Overview {
  project_name: string;
  total_modules: number;
  progress: number;
  completed_modules: number;
  incomplete_modules: number;
  not_started_modules: number;
  in_progress_modules: number;
  blocked_modules: number;
  ready_for_integration: number;
  ready_for_testing: number;
  modules: Module[];
  developers: Developer[];
  tasks: { total: number; open: number; blocked: number; done: number };
  recent_activity: Activity[];
  status_counts: Record<string, number>;
  stage_stats: Record<
    StageType,
    {
      completed: number;
      in_progress: number;
      blocked: number;
      not_started: number;
      average_progress: number;
    }
  >;
}
export interface Activity {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  summary: string;
  timestamp: string;
}
export interface AIAnswer {
  type: string;
  title: string;
  summary: string;
  module_ids: number[];
  developer_ids: number[];
  metrics: { label: string; value: string }[];
  insights: string[];
  recommendations: string[];
  follow_up_questions: string[];
}

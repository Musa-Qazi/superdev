import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Activity as ActivityIcon,
  AlertCircle,
  ArrowDownWideNarrow,
  ArrowUpDown,
  BarChart3,
  Blocks,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Download,
  FileJson,
  Filter,
  Gauge,
  GripVertical,
  LayoutDashboard,
  LayoutGrid,
  List,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Pencil,
  Power,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { api, json } from "./api";
import { TrackerKpis } from "./TrackerKpis";
import type {
  AIAnswer,
  Activity,
  Developer,
  Module,
  ModuleStatus,
  Overview,
  Stage,
  StageType,
  Task,
  Weights,
} from "./types";

const StageBarChart = lazy(() => import("./StageBarChart"));

type Page =
  | "Overview"
  | "Development Tracker"
  | "Priority Studio"
  | "Team & Assignments"
  | "Work Board"
  | "Insights"
  | "AI Companion"
  | "Settings & Data";
const NAV: { name: Page; icon: typeof LayoutDashboard; group?: string }[] = [
  { name: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { name: "Development Tracker", icon: Blocks },
  { name: "Priority Studio", icon: Target },
  { name: "Team & Assignments", icon: Users, group: "Delivery" },
  { name: "Work Board", icon: ClipboardList },
  { name: "Insights", icon: BarChart3 },
  { name: "AI Companion", icon: Sparkles, group: "Tools" },
  { name: "Settings & Data", icon: Settings2 },
];
const STAGE_LABEL: Record<StageType, string> = {
  frontend: "Frontend",
  backend: "Backend",
  integration: "Integration",
  testing: "Testing",
};
const STAGE_SHORT: Record<StageType, string> = {
  frontend: "FE",
  backend: "BE",
  integration: "INT",
  testing: "QA",
};
const STAGE_ORDER: StageType[] = [
  "frontend",
  "backend",
  "integration",
  "testing",
];
const STATUS_FILTERS: ModuleStatus[] = [
  "Not Started",
  "In Development",
  "Ready for Integration",
  "In Integration",
  "Ready for Testing",
  "In Testing",
  "Blocked",
  "Completed",
];
const TASK_COLUMNS = ["To Do", "In Progress", "Blocked", "Done"] as const;
const STATUS_CLASS = (status: string) =>
  status.toLowerCase().replaceAll(" ", "-");

function getStage(module: Module, type: StageType) {
  return module.stages.find((stage) => stage.stage_type === type)!;
}
function Avatar({
  developer,
  size = "normal",
}: {
  developer?: Developer | null;
  size?: "small" | "normal";
}) {
  return developer ? (
    <span
      className={`avatar ${size}`}
      title={`${developer.name}${developer.role_label ? ` · ${developer.role_label}` : ""}`}
    >
      {developer.initials}
    </span>
  ) : (
    <span className={`avatar avatar-empty ${size}`} title="Unassigned">
      —
    </span>
  );
}
function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge ${className}`}>{children}</span>;
}
function Progress({
  value,
  small = false,
}: {
  value: number;
  small?: boolean;
}) {
  return (
    <div
      className={`progress ${small ? "small" : ""}`}
      role="progressbar"
      aria-label={`${value}% complete`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.max(0, value))}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
  detail,
  accent = "",
}: {
  label: string;
  value: string | number;
  icon: typeof Gauge;
  detail?: string;
  accent?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${accent}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      {detail && <div className="metric-detail">{detail}</div>}
    </div>
  );
}
function PageTitle({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {kicker && <div className="eyebrow">{kicker}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [modules, setModules] = useState<Module[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [settings, setSettings] = useState<{
    project_name: string;
    stage_weights: Weights;
    seed_estimates_note: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const selectedModule =
    modules.find((module) => module.id === selectedId) ?? null;

  const loadData = useCallback(async () => {
    const [m, d, t, o, s, a] = await Promise.all([
      api<{ data: Module[] }>("/api/modules"),
      api<{ data: Developer[] }>("/api/developers"),
      api<{ data: Task[] }>("/api/tasks"),
      api<{ data: Overview }>("/api/overview"),
      api<{ data: typeof settings }>("/api/settings"),
      api<{ data: Activity[] }>("/api/activity?limit=100"),
    ]);
    setModules(m.data);
    setDevelopers(d.data);
    setTasks(t.data);
    setOverview(o.data);
    if (s.data) setSettings(s.data);
    setActivity(a.data);
    return true;
  }, []);
  useEffect(() => {
    api<{ required: boolean; authenticated: boolean }>("/api/auth/status")
      .then(async (auth) => {
        setAuthRequired(auth.required);
        setAuthenticated(auth.authenticated);
        setAuthChecked(true);
        if (auth.authenticated) await loadData();
      })
      .catch((e) => {
        setError(e.message);
        setAuthChecked(true);
      });
  }, [loadData]);
  useEffect(() => {
    if (!authenticated) return;
    const onFocus = () => {
      if (document.visibilityState === "visible")
        loadData().catch((e) => setError(e.message));
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData().catch(() => {});
    }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [authenticated, loadData]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const refresh = async (message?: string) => {
    setBusy(true);
    setError("");
    try {
      await loadData();
      if (message) notify(message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh project data.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveModule = async (id: number, payload: Record<string, unknown>) => {
    const r = await api<{ data: Module }>(
      `/api/modules/${id}`,
      json("PATCH", payload),
    );
    setModules((old) =>
      old.map((module) => (module.id === id ? r.data : module)),
    );
    await loadData();
    return r.data;
  };
  const saveStage = async (
    moduleId: number,
    stage: StageType,
    payload: Record<string, unknown>,
  ) => {
    const r = await api<{ data: Module }>(
      `/api/modules/${moduleId}/stages/${stage}`,
      json("PATCH", payload),
    );
    setModules((old) =>
      old.map((module) => (module.id === moduleId ? r.data : module)),
    );
    await loadData();
    return r.data;
  };
  const saveTask = async (taskId: number, payload: Record<string, unknown>) => {
    const r = await api<{ data: Task }>(
      `/api/tasks/${taskId}`,
      json("PATCH", payload),
    );
    setTasks((old) => old.map((task) => (task.id === taskId ? r.data : task)));
    await loadData();
    return r.data;
  };
  const addTask = async (payload: Record<string, unknown>) => {
    const r = await api<{ data: Task }>("/api/tasks", json("POST", payload));
    setTasks((old) => [r.data, ...old]);
    await loadData();
    return r.data;
  };
  const deleteTask = async (taskId: number) => {
    await api(`/api/tasks/${taskId}`, { method: "DELETE" });
    setTasks((old) => old.filter((task) => task.id !== taskId));
    await loadData();
  };
  const login = async (e: FormEvent) => {
    e.preventDefault();
    setAuthPending(true);
    setAuthError("");
    try {
      await api("/api/auth/login", json("POST", { accessKey }));
      setAuthenticated(true);
      await loadData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setAuthPending(false);
    }
  };

  if (!authChecked)
    return (
      <div className="full-loader">
        <LoaderCircle className="spin" />
        <span>Loading Campus DevPulse…</span>
      </div>
    );
  if (authRequired && !authenticated)
    return (
      <main className="auth-screen">
        <form className="auth-card" onSubmit={login}>
          <div className="brand-mark large">
            <ActivityIcon size={25} />
          </div>
          <div className="eyebrow">Campus DevPulse</div>
          <h1>Team workspace</h1>
          <p>Enter the shared access key to open the development tracker.</p>
          <label>
            Access key
            <input
              type="password"
              autoFocus
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {authError && <div className="form-error">{authError}</div>}
          <button className="button primary full" disabled={authPending}>
            {authPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <LockKeyhole size={16} />
            )}{" "}
            Continue
          </button>
        </form>
      </main>
    );

  const shared = {
    modules,
    developers,
    tasks,
    overview,
    settings,
    activity,
    openModule: (id: number) => setSelectedId(id),
    saveModule,
    saveStage,
    saveTask,
    addTask,
    deleteTask,
    notify,
    refresh,
    setPage,
  };
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="scrim mobile-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <ActivityIcon size={19} />
          </div>
          <div className="brand-text">
            <strong>DevPulse</strong>
            <span>Campus ERP</span>
          </div>
        </div>
        <div className="workspace-switch">
          <div className="workspace-symbol">C</div>
          <div>
            <b>Campus ERP</b>
            <span>Development workspace</span>
          </div>
        </div>
        <nav className="nav-list">
          {NAV.map((item, index) => (
            <div key={item.name}>
              {item.group && <div className="nav-label">{item.group}</div>}
              <button
                className={`nav-item ${page === item.name ? "active" : ""}`}
                onClick={() => {
                  setPage(item.name);
                  setMobileNav(false);
                }}
              >
                <item.icon size={17} />
                <span>{item.name}</span>
                {item.name === "Development Tracker" && (
                  <small>{modules.length}</small>
                )}
                {item.name === "AI Companion" && (
                  <span className="nav-tag">AI</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-project">
            <div className="project-glyph">
              {(overview?.project_name || "C").slice(0, 1).toUpperCase()}
            </div>
            <div className="sidebar-project-copy">
              <b>{overview?.project_name || "Campus ERP"}</b>
              <span>{overview?.progress || 0}% overall completion</span>
            </div>
          </div>
          <div className="sidebar-user">
            <span className="user-dot">Q</span>
            <div>
              <b>Shared workspace</b>
              <span>Internal team</span>
            </div>
            {authRequired && (
              <button
                className="icon-button small-icon"
                title="Sign out"
                onClick={() =>
                  api("/api/auth/logout", { method: "POST" }).then(() =>
                    location.reload(),
                  )
                }
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <List size={19} />
          </button>
          <div className="breadcrumb">
            <span>Campus ERP</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            <span className="sync-label">
              <span className="live-dot" /> Shared project data
            </span>
            <button
              className="icon-button"
              onClick={() => refresh()}
              title="Refresh project data"
            >
              <ArrowUpDown size={16} />
            </button>
            <button className="top-avatar" title="Shared team workspace">
              CT
            </button>
          </div>
        </header>
        {error && (
          <div className="global-error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => refresh()}>Retry</button>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="content-wrap">
          {page === "Overview" && (
            <OverviewPage {...shared} setPage={setPage} />
          )}
          {page === "Development Tracker" && <TrackerPage {...shared} />}
          {page === "Priority Studio" && <PriorityPage {...shared} />}
          {page === "Team & Assignments" && <TeamPage {...shared} />}
          {page === "Work Board" && <BoardPage {...shared} />}
          {page === "Insights" && <InsightsPage {...shared} />}
          {page === "AI Companion" && <AIPage {...shared} />}
          {page === "Settings & Data" && <SettingsPage {...shared} />}
        </div>
      </main>
      {selectedModule && (
        <ModuleDrawer
          module={selectedModule}
          developers={developers}
          tasks={tasks}
          activity={activity}
          close={() => setSelectedId(null)}
          saveModule={saveModule}
          saveStage={saveStage}
          saveTask={saveTask}
          addTask={addTask}
          notify={notify}
        />
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
      {busy && (
        <div className="refresh-indicator">
          <LoaderCircle size={14} className="spin" /> Syncing
        </div>
      )}
    </div>
  );
}

function OverviewPage({
  overview,
  modules,
  developers,
  tasks,
  openModule,
  setPage,
}: any) {
  if (!overview) return <Loading />;
  const actions = modules
    .filter(
      (m: Module) =>
        m.status === "Blocked" ||
        m.status === "Ready for Integration" ||
        m.status === "Ready for Testing",
    )
    .slice(0, 7);
  const coreModules = ["Students", "Admissions", "Academics", "Attendance"]
    .map((name) => modules.find((module: Module) => module.name === name))
    .filter(Boolean) as Module[];
  const stages: StageType[] = ["frontend", "backend", "integration", "testing"];
  return (
    <>
      <PageTitle
        kicker="PROJECT OVERVIEW"
        title="Project overview"
        subtitle="A clear view of where Campus ERP development stands today."
        actions={
          <>
            <button
              className="button secondary"
              onClick={() => setPage("Development Tracker")}
            >
              <Blocks size={15} /> View tracker
            </button>
            <button
              className="button primary"
              onClick={() => setPage("Work Board")}
            >
              <Plus size={16} /> Work board
            </button>
          </>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Overall progress"
          value={`${overview.progress}%`}
          icon={Gauge}
          detail={`${overview.total_modules} modules · equal weighted`}
          accent="blue"
        />
        <Metric
          label="Completed modules"
          value={`${overview.completed_modules} / ${overview.total_modules}`}
          icon={CheckCircle2}
          detail={`${overview.incomplete_modules} still in progress`}
          accent="green"
        />
        <Metric
          label="Ready for integration"
          value={overview.ready_for_integration}
          icon={Zap}
          detail="Frontend and backend complete"
          accent="slate"
        />
        <Metric
          label="Blocked modules"
          value={overview.blocked_modules}
          icon={AlertCircle}
          detail="Need the team’s attention"
          accent={overview.blocked_modules ? "red" : ""}
        />
      </div>
      <section className="panel core-modules-panel">
        <div className="panel-heading">
          <div>
            <h2>Core ERP modules</h2>
            <p>Quick access to the four core areas you identified.</p>
          </div>
          <button
            className="text-button"
            onClick={() => setPage("Development Tracker")}
          >
            All modules <ChevronRight size={14} />
          </button>
        </div>
        <div className="core-module-grid">
          {coreModules.map((module) => (
            <button
              className="core-module-card"
              key={module.id}
              onClick={() => openModule(module.id)}
            >
              <div className="core-module-topline">
                <span>{module.category}</span>
                <Badge className={`status-${STATUS_CLASS(module.status)}`}>
                  {module.status}
                </Badge>
              </div>
              <strong>{module.name}</strong>
              <div className="core-module-progress">
                <span>Development progress</span>
                <b>{module.progress}%</b>
              </div>
              <Progress value={module.progress} />
            </button>
          ))}
        </div>
      </section>
      <div className="overview-main-grid">
        <section className="panel stage-panel">
          <div className="panel-heading">
            <div>
              <h2>Development stages</h2>
              <p>Completion across all {overview.total_modules} modules</p>
            </div>
            <button
              className="text-button"
              onClick={() => setPage("Development Tracker")}
            >
              Open tracker <ChevronRight size={14} />
            </button>
          </div>
          <div className="stage-overview">
            {stages.map((stage) => {
              const stat = overview.stage_stats[stage];
              return (
                <div className="stage-overview-row" key={stage}>
                  <div className="stage-overview-title">
                    <span className={`stage-letter ${stage}`}>
                      {STAGE_SHORT[stage]}
                    </span>
                    <b>{STAGE_LABEL[stage]}</b>
                    <strong>{stat.average_progress}%</strong>
                  </div>
                  <Progress value={stat.average_progress} />
                  <div className="stage-overview-meta">
                    <span>{stat.completed} complete</span>
                    <span>{stat.in_progress} active</span>
                    <span>{stat.blocked} blocked</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel status-panel">
          <div className="panel-heading">
            <div>
              <h2>Module status</h2>
              <p>Current distribution by delivery state</p>
            </div>
              <span className="subtle-total">
                {overview.total_modules} modules
              </span>
          </div>
          <div className="status-list">
            {STATUS_FILTERS.map((status) => {
              const count = overview.status_counts[status] || 0;
              return (
                <div className="status-row" key={status}>
                  <Badge className={`status-${STATUS_CLASS(status)}`}>
                    {status}
                  </Badge>
                  <div className="status-track">
                    <span
                      className={`status-fill status-${STATUS_CLASS(status)}`}
                      style={{
                        width: `${(count / overview.total_modules) * 100}%`,
                      }}
                    />
                  </div>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="overview-lower-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p>Modules with an immediate next step</p>
            </div>
            <button
              className="text-button"
              onClick={() => setPage("Development Tracker")}
            >
              All modules <ChevronRight size={14} />
            </button>
          </div>
          {actions.length ? (
            <div className="action-list">
              {actions.map((m: Module) => (
                <button
                  className="action-row"
                  key={m.id}
                  onClick={() => openModule(m.id)}
                >
                  <span className={`action-icon ${STATUS_CLASS(m.status)}`}>
                    {m.status === "Blocked" ? (
                      <AlertCircle size={16} />
                    ) : m.status === "Ready for Integration" ? (
                      <Zap size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                  </span>
                  <span className="action-copy">
                    <b>{m.name}</b>
                    <small>
                      {m.status === "Blocked"
                        ? "Resolve the current blocker"
                        : m.status === "Ready for Integration"
                          ? "Frontend and backend are complete"
                          : "Integration is complete"}
                    </small>
                  </span>
                  <span className="action-progress">{m.progress}%</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={CheckCircle2}
              title="No urgent actions"
              text="No blocked modules or pending handoffs right now."
            />
          )}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest project updates</p>
            </div>
            <ActivityIcon size={17} className="quiet-icon" />
          </div>
          {overview.recent_activity.length ? (
            <div className="activity-list">
              {overview.recent_activity.slice(0, 6).map((item: Activity) => (
                <div className="activity-row" key={item.id}>
                  <span className="activity-dot">
                    <ActivityIcon size={12} />
                  </span>
                  <div>
                    <p>{item.summary}</p>
                    <time>{formatTime(item.timestamp)}</time>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={ActivityIcon}
              title="No activity yet"
              text="Stage updates and tasks will show here."
            />
          )}
        </section>
      </div>
      <div className="overview-footer">
        <span>
          <Users size={15} /> {developers.length} developer
          {developers.length === 1 ? "" : "s"} in the workspace
        </span>
        <span>
          <ClipboardList size={15} />{" "}
          {tasks.filter((t: Task) => t.status !== "Done").length} open task
          {tasks.filter((t: Task) => t.status !== "Done").length === 1
            ? ""
            : "s"}
        </span>
        <button
          className="text-button"
          onClick={() => setPage("Team & Assignments")}
        >
          View team <ChevronRight size={14} />
        </button>
      </div>
    </>
  );
}

function TrackerPage({
  modules,
  developers,
  openModule,
  saveModule,
  saveStage,
  notify,
  refresh,
}: any) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [stageFilter, setStageFilter] = useState("");
  const [devFilter, setDevFilter] = useState("");
  const [impact, setImpact] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("Original order");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStage, setBulkStage] = useState<StageType>("frontend");
  const [bulkDev, setBulkDev] = useState("");
  const [busyBulk, setBusyBulk] = useState(false);
  useEffect(() => {
    const handleTypeToSearch = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;

      const target = event.target;
      const isSearchInput = target === searchInputRef.current;
      const isEditingText =
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']");

      if (
        event.key === "Escape" &&
        search &&
        (isSearchInput || !isEditingText)
      ) {
        event.preventDefault();
        setSearch("");
        if (isSearchInput) searchInputRef.current?.blur();
        return;
      }

      if (isEditingText || event.repeat) return;

      if (event.key === "Backspace" && search) {
        event.preventDefault();
        setSearch((current) => current.slice(0, -1));
        searchInputRef.current?.focus();
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        setSearch((current) => current + event.key);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleTypeToSearch);
    return () => window.removeEventListener("keydown", handleTypeToSearch);
  }, [search]);
  const filtered = useMemo(() => {
    let rows = [...modules] as Module[];
    const query = search.toLowerCase().trim();
    if (query)
      rows = rows.filter((module) => {
        const searchableText = [
          module.name,
          module.category,
          module.description,
          module.notes,
          module.status,
          ...module.stages.flatMap((stage) => [
            STAGE_LABEL[stage.stage_type],
            stage.status,
            stage.notes,
            developers.find(
              (developer: Developer) => developer.id === stage.assigned_developer_id,
            )?.name ?? "",
          ]),
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
    if (category) rows = rows.filter((m) => m.category === category);
    if (status !== "All statuses")
      rows = rows.filter((m) => m.status === status);
    if (stageFilter) {
      const [stageType, stageStatus] = stageFilter.split("|") as [
        StageType,
        string,
      ];
      rows = rows.filter((m) => getStage(m, stageType).status === stageStatus);
    }
    if (devFilter)
      rows = rows.filter((m) =>
        m.stages.some((s) => String(s.assigned_developer_id) === devFilter),
      );
    if (impact) rows = rows.filter((m) => m.impact_score === Number(impact));
    if (difficulty)
      rows = rows.filter((m) => m.difficulty_score === Number(difficulty));
    if (sort === "Alphabetical")
      rows.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "Highest impact")
      rows.sort((a, b) => b.impact_score - a.impact_score);
    if (sort === "Lowest impact")
      rows.sort((a, b) => a.impact_score - b.impact_score);
    if (sort === "Highest difficulty")
      rows.sort((a, b) => b.difficulty_score - a.difficulty_score);
    if (sort === "Lowest difficulty")
      rows.sort((a, b) => a.difficulty_score - b.difficulty_score);
    if (sort === "Highest completion")
      rows.sort((a, b) => b.progress - a.progress);
    if (sort === "Lowest completion")
      rows.sort((a, b) => a.progress - b.progress);
    if (sort === "Recently updated")
      rows.sort(
        (a, b) =>
          Math.max(
            ...b.stages.map((stage) => Date.parse(stage.updated_at)),
            Date.parse(b.updated_at),
          ) -
          Math.max(
            ...a.stages.map((stage) => Date.parse(stage.updated_at)),
            Date.parse(a.updated_at),
          ),
      );
    return rows;
  }, [
    modules,
    developers,
    search,
    category,
    status,
    stageFilter,
    devFilter,
    impact,
    difficulty,
    sort,
  ]);
  const clear = () => {
    setSearch("");
    setCategory("");
    setStatus("All statuses");
    setStageFilter("");
    setDevFilter("");
    setImpact("");
    setDifficulty("");
    setSort("Original order");
  };
  const bulkAssign = async () => {
    if (!selected.length || !bulkDev) return;
    setBusyBulk(true);
    try {
      await Promise.all(
        selected.map((id) =>
          saveStage(id, bulkStage, { assigned_developer_id: Number(bulkDev) }),
        ),
      );
      notify(`Assigned ${selected.length} module stages.`);
      setSelected([]);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update assignments.");
    } finally {
      setBusyBulk(false);
    }
  };
  const bulkScore = async (
    field: "impact_score" | "difficulty_score",
    value: number,
  ) => {
    setBusyBulk(true);
    try {
      await api(
        "/api/modules/bulk-update",
        json("PATCH", { module_ids: selected, field, value }),
      );
      setSelected([]);
      await refresh("Priority estimates updated.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update modules.");
    } finally {
      setBusyBulk(false);
    }
  };
  return (
    <>
      <PageTitle
        kicker="DEVELOPMENT TRACKER"
        title="Module tracker"
        subtitle={`Follow frontend, backend, integration and testing work across all ${modules.length} ERP modules.`}
        actions={
          <button className="button secondary" onClick={() => window.print()}>
            <Download size={15} /> Export view
          </button>
        }
      />
      <TrackerKpis modules={filtered} total={modules.length} />
      <div className="filter-panel">
        <div className="search-field">
          <Search size={16} />
          <input
            ref={searchInputRef}
            placeholder="Type anywhere to search modules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All areas</option>
          {Array.from(
            new Set<string>(
              (modules as Module[]).map((module) => module.category),
            ),
          ).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All statuses</option>
          {STATUS_FILTERS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">Any stage</option>
          {STAGE_ORDER.map((stage) => (
            <optgroup key={stage} label={STAGE_LABEL[stage]}>
              {["Not Started", "In Progress", "Blocked", "Completed"].map(
                (state) => (
                  <option key={state} value={`${stage}|${state}`}>
                    {state}
                  </option>
                ),
              )}
            </optgroup>
          ))}
        </select>
        <select
          value={devFilter}
          onChange={(e) => setDevFilter(e.target.value)}
        >
          <option value="">Any developer</option>
          {developers.map((d: Developer) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={impact} onChange={(e) => setImpact(e.target.value)}>
          <option value="">Any impact</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              Impact {n}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">Any difficulty</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              Difficulty {n}
            </option>
          ))}
        </select>
        <button className="filter-reset" onClick={clear}>
          <Filter size={14} /> Reset
        </button>
      </div>
      <div className="tracker-toolbar">
        <div className="sort-control">
          <ArrowDownWideNarrow size={15} />
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {[
              "Original order",
              "Alphabetical",
              "Highest impact",
              "Lowest impact",
              "Highest difficulty",
              "Lowest difficulty",
              "Highest completion",
              "Lowest completion",
              "Recently updated",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="view-switch">
          <button
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List size={16} />
          </button>
          <button
            className={view === "grid" ? "selected" : ""}
            onClick={() => setView("grid")}
            aria-label="Card view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="bulk-bar">
          <b>{selected.length} selected</b>
          <select
            value={bulkStage}
            onChange={(e) => setBulkStage(e.target.value as StageType)}
          >
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <select value={bulkDev} onChange={(e) => setBulkDev(e.target.value)}>
            <option value="">Assign developer…</option>
            {developers.map((d: Developer) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            className="button secondary small-button"
            disabled={!bulkDev || busyBulk}
            onClick={bulkAssign}
          >
            Assign stage
          </button>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value)
                bulkScore("impact_score", Number(e.target.value));
              e.currentTarget.value = "";
            }}
          >
            <option value="">Set impact…</option>
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value)
                bulkScore("difficulty_score", Number(e.target.value));
              e.currentTarget.value = "";
            }}
          >
            <option value="">Set difficulty…</option>
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            onClick={() => setSelected([])}
            aria-label="Clear selection"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {filtered.length === 0 ? (
        <Empty
          icon={Search}
          title="No modules found"
          text="Try changing your search or filters."
          action={
            <button className="button secondary" onClick={clear}>
              Reset filters
            </button>
          }
        />
      ) : view === "list" ? (
        <div className="table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select all visible modules"
                    type="checkbox"
                    checked={
                      selected.length === filtered.length && filtered.length > 0
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? filtered.map((m) => m.id) : [],
                      )
                    }
                  />
                </th>
                <th>Module</th>
                <th>Overall</th>
                {STAGE_ORDER.map((s) => (
                  <th key={s}>{STAGE_LABEL[s]}</th>
                ))}
                <th>Status</th>
                <th>Team</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const ids = [
                  ...new Set(
                    m.stages
                      .map((s) => s.assigned_developer_id)
                      .filter(Boolean),
                  ),
                ];
                return (
                  <tr key={m.id} onClick={() => openModule(m.id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`Select ${m.name}`}
                        type="checkbox"
                        checked={selected.includes(m.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, m.id]
                              : selected.filter((id) => id !== m.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="table-module-name">
                        <span className="module-order">
                          {String(m.display_order).padStart(2, "0")}
                        </span>
                        <div>
                          <b>{m.name}</b>
                          <small>
                            {m.category}
                            {m.description ? ` · ${m.description}` : " area"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="overall-cell">
                        <b>{m.progress}%</b>
                        <Progress value={m.progress} small />
                      </div>
                    </td>
                    {STAGE_ORDER.map((s) => {
                      const stage = getStage(m, s);
                      return (
                        <td key={s}>
                          <StageMini stage={stage} />
                        </td>
                      );
                    })}
                    <td>
                      <Badge className={`status-${STATUS_CLASS(m.status)}`}>
                        {m.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="avatar-stack">
                        {ids.length ? (
                          ids.slice(0, 3).map((id) => {
                            const d = developers.find(
                              (dev: Developer) => dev.id === id,
                            );
                            return (
                              <Avatar key={id} developer={d} size="small" />
                            );
                          })
                        ) : (
                          <span className="unassigned-text">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="priority-pair">
                        <span title="Impact">I{m.impact_score}</span>
                        <span title="Difficulty">D{m.difficulty_score}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="module-card-grid">
          {filtered.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              developers={developers}
              open={() => openModule(m.id)}
            />
          ))}
        </div>
      )}
      <div className="tracker-footnote">
        <CircleHelp size={14} />
        <span>
          Impact and difficulty are editable initial estimates. Completion is
          calculated from the four saved stage values and configured weights.
        </span>
      </div>
    </>
  );
}
function StageMini({ stage }: { stage: Stage }) {
  const label = stage.status === "Completed" ? "Complete"
    : stage.status === "Blocked" ? `Blocked · ${stage.progress}%`
    : stage.status === "In Progress" ? `In progress · ${stage.progress}%`
    : "Not started";
  return (
    <span
      className={`stage-state stage-state-${STATUS_CLASS(stage.status)}`}
      aria-label={`${STAGE_LABEL[stage.stage_type]}: ${stage.status}, ${stage.progress}%`}
      title={`${STAGE_LABEL[stage.stage_type]}: ${stage.status} · ${stage.progress}%`}
    >
      {stage.status === "Completed" && <Check size={13} aria-hidden="true" />}
      {stage.status === "Blocked" && <AlertCircle size={13} aria-hidden="true" />}
      {label}
    </span>
  );
}
function ModuleCard({
  module,
  developers,
  open,
}: {
  module: Module;
  developers: Developer[];
  open: () => void;
}) {
  const assigned = [
    ...new Set(
      module.stages.map((s) => s.assigned_developer_id).filter(Boolean),
    ),
  ];
  return (
    <button className="module-card" onClick={open}>
      <div className="module-card-header">
        <div className="module-card-title">
          <span className="module-order">
            {String(module.display_order).padStart(2, "0")}
          </span>
          <div>
            <small className="module-category">{module.category}</small>
            <h3>{module.name}</h3>
          </div>
        </div>
        <Badge className={`status-${STATUS_CLASS(module.status)}`}>
          {module.status}
        </Badge>
      </div>
      <div className="module-card-progress">
        <div>
          <span>Overall completion</span>
          <b>{module.progress}%</b>
        </div>
        <Progress value={module.progress} />
      </div>
      <div className="card-stage-list">
        {STAGE_ORDER.map((s) => (
          <div key={s}>
            <span>{STAGE_LABEL[s]}</span>
            <StageMini stage={getStage(module, s)} />
          </div>
        ))}
      </div>
      <div className="module-card-footer">
        <div className="avatar-stack">
          {assigned.length ? (
            assigned.slice(0, 4).map((id) => {
              const d = developers.find((x) => x.id === id);
              return <Avatar key={id} developer={d} size="small" />;
            })
          ) : (
            <span className="unassigned-text">Unassigned</span>
          )}
        </div>
        <span className="priority-pair">
          <span>I{module.impact_score}</span>
          <span>D{module.difficulty_score}</span>
        </span>
      </div>
    </button>
  );
}

function PriorityPage({ modules, openModule, saveModule, notify }: any) {
  const [mode, setMode] = useState<"quadrants" | "ranking">("quadrants");
  const [dragging, setDragging] = useState(false);
  const quadrants = [
    {
      id: "quick",
      title: "Quick wins",
      sub: "High impact · Lower difficulty",
      impact: 4,
      difficulty: 2,
    },
    {
      id: "major",
      title: "Major projects",
      sub: "High impact · Higher difficulty",
      impact: 4,
      difficulty: 4,
    },
    {
      id: "fill",
      title: "Fill-ins",
      sub: "Lower impact · Lower difficulty",
      impact: 2,
      difficulty: 2,
    },
    {
      id: "later",
      title: "Plan later",
      sub: "Lower impact · Higher difficulty",
      impact: 2,
      difficulty: 4,
    },
  ];
  const endDrag = async (event: DragEndEvent) => {
    setDragging(false);
    const id = Number(String(event.active.id).replace("module-", ""));
    const q = quadrants.find((item) => item.id === event.over?.id);
    if (!q) return;
    try {
      await saveModule(id, {
        impact_score: q.impact,
        difficulty_score: q.difficulty,
      });
      notify("Priority estimate updated.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update priority.");
    }
  };
  const ranked = [...modules].sort(
    (a: Module, b: Module) =>
      Number(a.status === "Completed") - Number(b.status === "Completed") ||
      b.impact_score * 2 -
        b.difficulty_score -
        (a.impact_score * 2 - a.difficulty_score) ||
      b.impact_score - a.impact_score,
  );
  return (
    <>
      <PageTitle
        kicker="PLANNING"
        title="Priority studio"
        subtitle="Compare impact and implementation difficulty to decide what should move next."
        actions={
          <div className="segmented">
            <button
              className={mode === "quadrants" ? "selected" : ""}
              onClick={() => setMode("quadrants")}
            >
              <Target size={15} /> Matrix
            </button>
            <button
              className={mode === "ranking" ? "selected" : ""}
              onClick={() => setMode("ranking")}
            >
              <List size={15} /> Ranking
            </button>
          </div>
        }
      />
      <div className="estimate-note">
        <CircleHelp size={15} />
        <span>
          Impact and difficulty scores are initial planning estimates. Update
          them to match the team’s view; recommendations use these editable
          values.
        </span>
      </div>
      {mode === "quadrants" ? (
        <DndContext
          onDragStart={() => setDragging(true)}
          onDragCancel={() => setDragging(false)}
          onDragEnd={endDrag}
        >
          <div className="priority-matrix">
            {quadrants.map((q) => (
              <PriorityQuadrant
                key={q.id}
                quadrant={q}
                modules={modules.filter(
                  (m: Module) =>
                    m.impact_score >= 4 === q.impact >= 4 &&
                    m.difficulty_score >= 4 === q.difficulty >= 4,
                )}
                openModule={openModule}
                dragging={dragging}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <section className="panel ranking-panel">
          <div className="panel-heading">
            <div>
              <h2>Suggested priority order</h2>
              <p>
                Impact weighted more heavily than difficulty. Adjust estimates
                in a module detail view.
              </p>
            </div>
          </div>
          <div className="ranking-list">
            {ranked.map((m: Module, i: number) => (
              <button
                key={m.id}
                className="ranking-row"
                onClick={() => openModule(m.id)}
              >
                <span className="rank-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="rank-main">
                  <b>{m.name}</b>
                  <div className="rank-progress">
                    <Progress value={m.progress} small />
                    <span>{m.progress}% done</span>
                  </div>
                </div>
                <div className="rank-score">
                  <span>Impact</span>
                  <strong>{m.impact_score}/5</strong>
                </div>
                <div className="rank-score">
                  <span>Difficulty</span>
                  <strong>{m.difficulty_score}/5</strong>
                </div>
                <Badge className={`status-${STATUS_CLASS(m.status)}`}>
                  {m.status}
                </Badge>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="priority-legend">
        <span>
          <i className="legend-mark high" /> High impact (4–5)
        </span>
        <span>
          <i className="legend-mark low" /> Lower impact (1–3)
        </span>
        <span>
          <GripVertical size={14} /> Drag module cards between quadrants
        </span>
      </div>
    </>
  );
}
function PriorityQuadrant({ quadrant, modules, openModule, dragging }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id });
  return (
    <section
      ref={setNodeRef}
      className={`quadrant ${quadrant.id} ${isOver ? "drag-over" : ""}`}
    >
      <div className="quadrant-heading">
        <div>
          <h2>{quadrant.title}</h2>
          <p>{quadrant.sub}</p>
        </div>
        <Badge>{modules.length}</Badge>
      </div>
      <div className="quadrant-cards">
        {modules.map((m: Module) => (
          <DraggablePriorityCard
            key={m.id}
            module={m}
            openModule={openModule}
          />
        ))}
      </div>
      {modules.length === 0 && (
        <div className="quadrant-empty">
          {dragging ? "Drop module here" : "No modules in this group"}
        </div>
      )}
    </section>
  );
}
function DraggablePriorityCard({
  module,
  openModule,
}: {
  module: Module;
  openModule: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `module-${module.id}` });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
      }}
      className={`priority-module ${isDragging ? "is-dragging" : ""}`}
    >
      <button
        className="drag-handle"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${module.name}`}
      >
        <GripVertical size={15} />
      </button>
      <button
        className="priority-card-main"
        onClick={() => openModule(module.id)}
      >
        <span>
          <b>{module.name}</b>
          <small>
            {module.progress}% · {module.status}
          </small>
        </span>
        <span className="priority-pair">
          <span>I{module.impact_score}</span>
          <span>D{module.difficulty_score}</span>
        </span>
      </button>
    </div>
  );
}

function TeamPage({
  modules,
  developers,
  tasks,
  openModule,
  notify,
  refresh,
}: any) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Developer | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing]);
  const list = developers.filter((d: Developer) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      await api("/api/developers", json("POST", { name, role_label: role }));
      setName("");
      setRole("");
      notify("Developer profile added.");
      await refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add developer.");
    } finally {
      setPending(false);
    }
  };
  const setActive = async (d: Developer) => {
    try {
      await api(
        `/api/developers/${d.id}`,
        json("PATCH", { active: !d.active }),
      );
      await refresh(
        d.active ? "Developer deactivated." : "Developer reactivated.",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update profile.");
    }
  };
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    try {
      await api(
        `/api/developers/${editing.id}`,
        json("PATCH", { name: editName, role_label: editRole }),
      );
      setEditing(null);
      await refresh("Developer profile updated.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <PageTitle
        kicker="TEAM WORKSPACE"
        title="Team & assignments"
        subtitle="See who owns each stage and how open work is distributed."
        actions={
          <span className="team-count">
            <Users size={15} />
            {developers.filter((d: Developer) => d.active).length} active
            developer
            {developers.filter((d: Developer) => d.active).length === 1
              ? ""
              : "s"}
          </span>
        }
      />
      <div className="team-top-grid">
        <section className="panel add-developer-panel">
          <div className="panel-heading">
            <div>
              <h2>Add a developer</h2>
              <p>
                Profiles are internal assignment labels; they do not create
                logins.
              </p>
            </div>
            <Plus size={17} />
          </div>
          <form className="developer-form" onSubmit={add}>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                required
                maxLength={80}
              />
            </label>
            <label>
              Role label
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Full Stack Developer"
                maxLength={80}
              />
            </label>
            <button
              className="button primary"
              disabled={pending || !name.trim()}
            >
              {pending ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Plus size={15} />
              )}{" "}
              Add profile
            </button>
          </form>
        </section>
        <section className="panel team-summary-panel">
          <div className="panel-heading">
            <div>
              <h2>Team workload</h2>
              <p>Open assignments across current modules</p>
            </div>
          </div>
          <div className="team-summary-stats">
            <div>
              <b>
                {developers.reduce(
                  (n: number, d: Developer) => n + (d.active_assignments || 0),
                  0,
                )}
              </b>
              <span>Active stages</span>
            </div>
            <div>
              <b>{tasks.filter((t: Task) => t.status !== "Done").length}</b>
              <span>Open tasks</span>
            </div>
            <div>
              <b>
                {developers.reduce(
                  (n: number, d: Developer) =>
                    n + (d.completed_assignments || 0),
                  0,
                )}
              </b>
              <span>Stages complete</span>
            </div>
          </div>
        </section>
      </div>
      <div className="team-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="Find a developer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span>{developers.length} profiles</span>
      </div>
      {list.length ? (
        <div className="developer-grid">
          {list.map((d: Developer) => (
            <DeveloperCard
              key={d.id}
              developer={d}
              modules={modules}
              tasks={tasks}
              openModule={openModule}
              toggleActive={() => setActive(d)}
              editProfile={() => {
                setEditing(d);
                setEditName(d.name);
                setEditRole(d.role_label);
              }}
            />
          ))}
        </div>
      ) : (
        <Empty
          icon={Users}
          title={
            developers.length ? "No developers match" : "No developers added"
          }
          text={
            developers.length
              ? "Try another name."
              : "Add internal team profiles above, then assign them to module stages and tasks."
          }
        />
      )}
      {editing && (
        <div
          className="modal-scrim"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <form
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="developer-dialog-title"
            onSubmit={saveProfile}
          >
            <div className="modal-heading">
              <div>
                <h2 id="developer-dialog-title">Edit developer profile</h2>
                <p>Assignments use this name and role label.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={80}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label>
              Role label
              <input
                maxLength={80}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={pending}>
                <Check size={15} /> Save profile
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
function DeveloperCard({
  developer,
  modules,
  tasks,
  openModule,
  toggleActive,
  editProfile,
}: any) {
  const owned: { module: Module; stage: Stage }[] = (
    modules as Module[]
  ).flatMap((m: Module) =>
    m.stages
      .filter((s) => s.assigned_developer_id === developer.id)
      .map((s) => ({ module: m, stage: s })),
  );
  const open = owned.filter((x) => x.stage.status !== "Completed");
  const work = tasks.filter(
    (t: Task) =>
      t.assigned_developer_id === developer.id && t.status !== "Done",
  );
  return (
    <section
      className={`panel developer-card ${!developer.active ? "inactive" : ""}`}
    >
      <div className="developer-card-top">
        <Avatar developer={developer} />
        <div className="developer-name">
          <b>{developer.name}</b>
          <span>{developer.role_label || "Team member"}</span>
        </div>
        <button
          className="icon-button"
          onClick={editProfile}
          title="Edit developer profile"
          aria-label={`Edit ${developer.name}`}
        >
          <Pencil size={15} />
        </button>
        <button
          className="icon-button"
          onClick={toggleActive}
          title={developer.active ? "Deactivate profile" : "Reactivate profile"}
          aria-label={
            developer.active ? "Deactivate profile" : "Reactivate profile"
          }
        >
              <Power size={15} />
        </button>
      </div>
      <div className="developer-stat-grid">
        <div>
          <b>{open.length}</b>
          <span>Active stages</span>
        </div>
        <div>
          <b>{work.length}</b>
          <span>Open tasks</span>
        </div>
        <div>
          <b>{owned.filter((x) => x.stage.status === "Completed").length}</b>
          <span>Completed</span>
        </div>
      </div>
      <div className="developer-work">
        <div className="mini-section-title">Current assignments</div>
        {open.length ? (
          open.slice(0, 4).map((item: any) => (
            <button
              key={`${item.module.id}-${item.stage.stage_type}`}
              onClick={() => openModule(item.module.id)}
              className="assignment-line"
            >
              <span className={`stage-letter ${item.stage.stage_type}`}>
                {STAGE_SHORT[item.stage.stage_type as StageType]}
              </span>
              <span>{item.module.name}</span>
              <small>{item.stage.progress}%</small>
            </button>
          ))
        ) : (
          <p className="quiet-empty">No active stage assignments.</p>
        )}
        {open.length > 4 && (
          <span className="more-count">
            +{open.length - 4} more assignments
          </span>
        )}
      </div>
      <div className="developer-card-foot">
        <span className={`profile-state ${developer.active ? "active" : ""}`}>
          <i />
          {developer.active ? "Active profile" : "Inactive profile"}
        </span>
        <span>
          {work.length} open task{work.length === 1 ? "" : "s"}
        </span>
      </div>
    </section>
  );
}

function BoardPage({
  modules,
  developers,
  tasks,
  addTask,
  saveTask,
  deleteTask,
  notify,
  openModule,
  setPage,
}: any) {
  const [filterModule, setFilterModule] = useState("");
  const [filterDev, setFilterDev] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!showForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowForm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm]);
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    module_id: "",
    stage_type: "",
    assigned_developer_id: "",
    status: "To Do",
    priority: "Medium",
    due_date: "",
  });
  const filtered = tasks.filter(
    (t: Task) =>
      (!filterModule || String(t.module_id) === filterModule) &&
      (!filterDev || String(t.assigned_developer_id) === filterDev),
  );
  const openNew = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      module_id: "",
      stage_type: "",
      assigned_developer_id: "",
      status: "To Do",
      priority: "Medium",
      due_date: "",
    });
    setShowForm(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      ...task,
      module_id: task.module_id ? String(task.module_id) : "",
      stage_type: task.stage_type || "",
      assigned_developer_id: task.assigned_developer_id
        ? String(task.assigned_developer_id)
        : "",
      due_date: task.due_date || "",
    });
    setShowForm(true);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      module_id: form.module_id ? Number(form.module_id) : null,
      stage_type: form.stage_type || null,
      assigned_developer_id: form.assigned_developer_id
        ? Number(form.assigned_developer_id)
        : null,
      due_date: form.due_date || null,
    };
    try {
      if (editing) await saveTask(editing.id, payload);
      else await addTask(payload);
      setShowForm(false);
      notify(editing ? "Task updated." : "Task added.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save task.");
    }
  };
  const drop = async (event: DragEndEvent) => {
    setDragging(false);
    if (!event.over) return;
    const id = Number(String(event.active.id).replace("task-", ""));
    try {
      await saveTask(id, { status: String(event.over.id) });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not move task.");
    }
  };
  return (
    <>
      <PageTitle
        kicker="DELIVERY"
        title="Work board"
        subtitle="Track the individual tasks behind each module, from to do through completion."
        actions={
          <button className="button primary" onClick={openNew}>
            <Plus size={16} /> New task
          </button>
        }
      />
      <div className="board-toolbar">
        <div className="filter-chip">
          <Filter size={15} />
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
          >
            <option value="">All modules</option>
            {modules.map((m: Module) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-chip">
          <Users size={15} />
          <select
            value={filterDev}
            onChange={(e) => setFilterDev(e.target.value)}
          >
            <option value="">All developers</option>
            {developers.map((d: Developer) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <span className="board-task-count">{filtered.length} tasks</span>
      </div>
      {developers.length === 0 && (
        <div className="inline-notice">
          <CircleHelp size={15} /> Add team profiles before assigning task
          owners.{" "}
          <button
            className="text-button"
            onClick={() => setPage("Team & Assignments")}
          >
            Team page
          </button>
        </div>
      )}
      <DndContext
        onDragStart={() => setDragging(true)}
        onDragCancel={() => setDragging(false)}
        onDragEnd={drop}
      >
        <div className="board-columns">
          {TASK_COLUMNS.map((status) => {
            const column = filtered.filter(
              (task: Task) => task.status === status,
            );
            return (
              <BoardColumn
                key={status}
                status={status}
                tasks={column}
                dragging={dragging}
                openEdit={openEdit}
                openModule={openModule}
                developers={developers}
              />
            );
          })}
        </div>
      </DndContext>
      {showForm && (
        <div
          className="modal-scrim"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <form
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
            onSubmit={save}
          >
            <div className="modal-heading">
              <div>
                <h2 id="task-dialog-title">
                  {editing ? "Edit task" : "Create a task"}
                </h2>
                <p>Keep the work item focused and easy to finish.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
            <label>
              Task title
              <input
                autoFocus
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Connect attendance API"
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional context or acceptance notes"
              />
            </label>
            <div className="form-two">
              <label>
                Module
                <select
                  value={form.module_id}
                  onChange={(e) =>
                    setForm({ ...form, module_id: e.target.value })
                  }
                >
                  <option value="">No module</option>
                  {modules.map((m: Module) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stage
                <select
                  value={form.stage_type}
                  onChange={(e) =>
                    setForm({ ...form, stage_type: e.target.value })
                  }
                >
                  <option value="">No stage</option>
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-two">
              <label>
                Assignee
                <select
                  value={form.assigned_developer_id}
                  onChange={(e) =>
                    setForm({ ...form, assigned_developer_id: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {developers.map((d: Developer) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  {["Low", "Medium", "High"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-two">
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {TASK_COLUMNS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              {editing && (
                <button
                  type="button"
                  className="button secondary delete-task-button"
                  onClick={async () => {
                    if (!window.confirm("Delete this task?")) return;
                    try {
                      await deleteTask(editing.id);
                      setShowForm(false);
                      notify("Task deleted.");
                    } catch (err) {
                      notify(
                        err instanceof Error
                          ? err.message
                          : "Could not delete task.",
                      );
                    }
                  }}
                >
                  <Trash2 size={14} /> Delete task
                </button>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button className="button primary">
                <Check size={15} />
                {editing ? "Save changes" : "Create task"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
function BoardColumn({
  status,
  tasks,
  dragging,
  openEdit,
  openModule,
  developers,
}: any) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "column-over" : ""}`}
    >
      <div className="board-column-heading">
        <div className={`column-dot ${STATUS_CLASS(status)}`} />
        <b>{status}</b>
        <span>{tasks.length}</span>
        <MoreHorizontal size={16} />
      </div>
      <div className="task-stack">
        {tasks.map((task: Task) => (
          <DraggableTask
            key={task.id}
            task={task}
            openEdit={openEdit}
            openModule={openModule}
            developers={developers}
          />
        ))}
        {tasks.length === 0 && (
          <div className="column-empty">
            {dragging
              ? "Drop task here"
              : status === "To Do"
                ? "Plan the next piece of work"
                : "No tasks here yet"}
          </div>
        )}
      </div>
    </section>
  );
}
function DraggableTask({ task, openEdit, openModule, developers }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `task-${task.id}` });
  const dev = developers.find(
    (d: Developer) => d.id === task.assigned_developer_id,
  );
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
      }}
      className={`task-card ${isDragging ? "is-dragging" : ""}`}
    >
      <div className="task-card-top">
        <button
          className="drag-handle tiny"
          {...listeners}
          {...attributes}
          aria-label="Move task"
        >
          <GripVertical size={14} />
        </button>
        <button className="task-title-button" onClick={() => openEdit(task)}>
          {task.title}
        </button>
        <button
          className="icon-button mini-icon"
          onClick={() => openEdit(task)}
          aria-label="Edit task"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      <div className="task-card-tags">
        <Badge className={`priority-${task.priority.toLowerCase()}`}>
          {task.priority}
        </Badge>
        {task.stage_type && (
          <Badge>{STAGE_SHORT[task.stage_type as StageType]}</Badge>
        )}
      </div>
      <div className="task-card-footer">
        <button
          className="task-module-link"
          onClick={() => task.module_id && openModule(task.module_id)}
          disabled={!task.module_id}
        >
          {task.module_name || "No module"}
        </button>
        <span className="task-due">
          {task.due_date ? formatDate(task.due_date) : ""}
        </span>
        <Avatar developer={dev} size="small" />
      </div>
    </article>
  );
}

function InsightsPage({
  overview,
  modules,
  developers,
  tasks,
  openModule,
  setPage,
}: any) {
  if (!overview) return <Loading />;
  const stageData = STAGE_ORDER.map((stage) => ({
    name: STAGE_LABEL[stage],
    Completed: overview.stage_stats[stage].completed,
    Active: overview.stage_stats[stage].in_progress,
    Blocked: overview.stage_stats[stage].blocked,
    "Not started": overview.stage_stats[stage].not_started,
  }));
  const high = modules
    .filter((m: Module) => m.impact_score >= 4 && m.status !== "Completed")
    .sort(
      (a: Module, b: Module) =>
        b.impact_score - a.impact_score ||
        b.difficulty_score - a.difficulty_score,
    );
  const owners = [...developers].sort(
    (a: Developer, b: Developer) =>
      (b.active_assignments || 0) +
      (b.open_tasks || 0) -
      (a.active_assignments || 0) -
      (a.open_tasks || 0),
  );
  const maxLoad = Math.max(
    1,
    ...developers.map(
      (d: Developer) => (d.active_assignments || 0) + (d.open_tasks || 0),
    ),
  );
  return (
    <>
      <PageTitle
        kicker="PROJECT ANALYSIS"
        title="Insights"
        subtitle="Current bottlenecks and planning signals calculated from saved tracker data."
        actions={
          <button
            className="button secondary"
            onClick={() => setPage("AI Companion")}
          >
            <Sparkles size={15} /> Ask AI Companion
          </button>
        }
      />
      <div className="metric-grid insights-metrics">
        <Metric
          label="Project progress"
          value={`${overview.progress}%`}
          icon={Gauge}
          detail={`${overview.completed_modules} of ${overview.total_modules} modules complete`}
          accent="blue"
        />
        <Metric
          label="Modules not started"
          value={overview.not_started_modules}
          icon={Clock3}
          detail="All four stages still at zero"
        />
        <Metric
          label="Ready for testing"
          value={overview.ready_for_testing}
          icon={CheckCircle2}
          detail="Integration complete"
          accent="green"
        />
        <Metric
          label="Open tasks"
          value={overview.tasks.open || 0}
          icon={ClipboardList}
          detail={`${overview.tasks.blocked || 0} blocked tasks`}
          accent="slate"
        />
      </div>
      <div className="insights-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Stage completion</h2>
              <p>Module counts by current stage state</p>
            </div>
          </div>
          <div className="chart-box">
            <Suspense
              fallback={<div className="chart-loading">Loading chart&</div>}
            >
              <StageBarChart data={stageData} />
            </Suspense>
          </div>
          <div className="chart-legend">
            <span>
              <i className="green" />
              Completed
            </span>
            <span>
              <i className="blue" />
              Active
            </span>
            <span>
              <i className="red" />
              Blocked
            </span>
            <span>
              <i className="gray" />
              Not started
            </span>
          </div>
        </section>
        <section className="panel bottleneck-panel">
          <div className="panel-heading">
            <div>
              <h2>Development bottlenecks</h2>
              <p>Stage state counts across the project</p>
            </div>
            <Badge className="neutral">Live</Badge>
          </div>
          {STAGE_ORDER.map((s) => {
            const stat = overview.stage_stats[s];
            const bottleneck =
              stat.blocked + stat.in_progress + stat.not_started;
            return (
              <div className="bottleneck-row" key={s}>
                <span className={`stage-letter ${s}`}>{STAGE_SHORT[s]}</span>
                <div className="bottleneck-copy">
                  <b>{STAGE_LABEL[s]}</b>
                  <small>
                    {stat.completed} completed · {stat.in_progress} active
                  </small>
                </div>
                <div className="bottleneck-bar">
                  <Progress value={stat.average_progress} small />
                  <span>{stat.average_progress}% avg.</span>
                </div>
                <span className={stat.blocked ? "count-alert" : ""}>
                  {stat.blocked} blocked
                </span>
                <span className="bottleneck-score">{bottleneck}</span>
              </div>
            );
          })}
          <div className="bottleneck-note">
            <AlertCircle size={15} />
            <span>
              Blocked stages require explicit unblock work. A ready handoff is
              counted separately from active integration.
            </span>
          </div>
        </section>
      </div>
      <div className="insights-bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>High impact still pending</h2>
              <p>Priority estimates with incomplete development work</p>
            </div>
            <button
              className="text-button"
              onClick={() => setPage("Priority Studio")}
            >
              Priority studio <ChevronRight size={14} />
            </button>
          </div>
          {high.length ? (
            <div className="priority-pending-list">
              {high.slice(0, 7).map((m: Module) => (
                <button
                  className="pending-module"
                  key={m.id}
                  onClick={() => openModule(m.id)}
                >
                  <span className="impact-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{m.name}</b>
                  <Badge className={`status-${STATUS_CLASS(m.status)}`}>
                    {m.status}
                  </Badge>
                  <div className="pending-progress">
                    <Progress value={m.progress} small />
                    <small>{m.progress}%</small>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={CheckCircle2}
              title="No high-impact modules pending"
              text="All high-impact estimates are marked complete."
            />
          )}
        </section>
        <section className="panel workload-panel">
          <div className="panel-heading">
            <div>
              <h2>Developer workload</h2>
              <p>Active stage assignments and open tasks</p>
            </div>
            <button
              className="text-button"
              onClick={() => setPage("Team & Assignments")}
            >
              Team <ChevronRight size={14} />
            </button>
          </div>
          {owners.length ? (
            owners.slice(0, 6).map((dev: Developer) => {
              const count =
                (dev.active_assignments || 0) + (dev.open_tasks || 0);
              return (
                <div className="workload-row" key={dev.id}>
                  <Avatar developer={dev} />
                  <div>
                    <b>{dev.name}</b>
                    <small>
                      {dev.active_assignments || 0} stages ·{" "}
                      {dev.open_tasks || 0} tasks
                    </small>
                  </div>
                  <Progress value={(count / maxLoad) * 100} small />
                  <strong>{count}</strong>
                </div>
              );
            })
          ) : (
            <Empty
              icon={Users}
              title="No workload data yet"
              text="Add developers and assign work to see workload balance."
            />
          )}
        </section>
      </div>
    </>
  );
}

function AIPage({ modules, developers, openModule }: any) {
  const [messages, setMessages] = useState<
    {
      role: "user" | "assistant";
      text: string;
      answer?: AIAnswer;
      error?: boolean;
    }[]
  >([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const suggestions = [
    "Which modules are ready for integration?",
    "Which modules are ready for testing?",
    "Which high-impact modules remain incomplete?",
    "Show blocked modules",
    "Summarize current project progress",
  ];
  const send = async (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((old) => [...old, { role: "user", text: q }]);
    setQuestion("");
    setError("");
    setPending(true);
    try {
      const r = await api<{ data: AIAnswer }>(
        "/api/ai/ask",
        json("POST", { question: q, history }),
      );
      setMessages((old) => [
        ...old,
        { role: "assistant", text: r.data.summary, answer: r.data },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI request failed.";
      setError(message);
      setMessages((old) => [
        ...old,
        { role: "assistant", text: message, error: true },
      ]);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <PageTitle
        kicker="GEMINI AI COMPANION"
        title="Ask about project progress"
        subtitle="Answers use a fresh snapshot of your saved modules, assignments and tasks."
      />
      <div className="ai-layout">
        <section className="panel ai-chat-panel">
          <div className="ai-header">
            <div className="ai-mark">
              <Sparkles size={18} />
            </div>
            <div>
              <b>DevPulse Assistant</b>
              <span>Campus ERP project context</span>
            </div>
            <Badge className="neutral">Gemini</Badge>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="ai-mark large-ai">
                  <Sparkles size={22} />
                </div>
                <h2>What would you like to know?</h2>
                <p>
                  Ask about module status, handoffs, workload or development
                  bottlenecks.
                </p>
                <div className="suggestion-grid">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)}>
                      {s}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <div className={`chat-message ${message.role}`} key={i}>
                  <div className={`chat-avatar ${message.role}`}>
                    {message.role === "assistant" ? (
                      <Sparkles size={14} />
                    ) : (
                      <span>CT</span>
                    )}
                  </div>
                  <div className="chat-bubble">
                    <div className="chat-role">
                      {message.role === "assistant"
                        ? "DevPulse Assistant"
                        : "You"}
                    </div>
                    <p>{message.text}</p>
                    {message.answer && (
                      <AIResult
                        answer={message.answer}
                        modules={modules}
                        developers={developers}
                        openModule={openModule}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
            {pending && (
              <div className="chat-message assistant">
                <div className="chat-avatar assistant">
                  <Sparkles size={14} />
                </div>
                <div className="chat-bubble">
                  <div className="chat-role">DevPulse Assistant</div>
                  <div className="typing">
                    <i />
                    <i />
                    <i /> Checking the latest project data…
                  </div>
                </div>
              </div>
            )}
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send(question);
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1200}
              placeholder="Ask a question about the project…"
              disabled={pending}
            />
            <button
              className="button primary"
              disabled={pending || !question.trim()}
            >
              <Send size={15} /> Send
            </button>
          </form>
          {error && (
            <div className="ai-error">
              <AlertCircle size={15} />
              {error}
              <button
                className="text-button"
                onClick={() =>
                  send(
                    question ||
                      messages.filter((m) => m.role === "user").at(-1)?.text ||
                      "",
                  )
                }
              >
                Retry
              </button>
            </div>
          )}
          <div className="ai-disclaimer">
            <LockKeyhole size={13} /> Project context is sent to Gemini only
            when you submit a question. No chat history is stored on the server.
          </div>
        </section>
        <aside className="ai-side">
          <section className="panel ai-side-panel">
            <div className="panel-heading">
              <div>
                <h2>What I can help with</h2>
                <p>Answers are based on current project records.</p>
              </div>
            </div>
            <ul className="ai-capabilities">
              <li>
                <CheckCircle2 size={15} /> Exact stage readiness and completion
              </li>
              <li>
                <Users size={15} /> Developer assignments and workload
              </li>
              <li>
                <AlertCircle size={15} /> Blocked modules and bottlenecks
              </li>
              <li>
                <Target size={15} /> Priority suggestions from editable
                estimates
              </li>
            </ul>
          </section>
          <section className="panel ai-side-panel">
            <div className="panel-heading">
              <div>
                <h2>Current snapshot</h2>
                <p>Loaded from the live tracker</p>
              </div>
            </div>
            <div className="snapshot-stats">
              <div>
                <span>Overall completion</span>
                <b>
                  {modules.length
                    ? Math.round(
                        modules.reduce(
                          (n: number, m: Module) => n + m.progress,
                          0,
                        ) / modules.length,
                      )
                    : 0}
                  %
                </b>
              </div>
              <div>
                <span>Modules ready for integration</span>
                <b>
                  {
                    modules.filter(
                      (m: Module) => m.status === "Ready for Integration",
                    ).length
                  }
                </b>
              </div>
              <div>
                <span>Developers</span>
                <b>{developers.length}</b>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
function AIResult({ answer, modules, developers, openModule }: any) {
  const list = answer.module_ids
    .map((id: number) => modules.find((m: Module) => m.id === id))
    .filter(Boolean);
  const people = answer.developer_ids
    .map((id: number) => developers.find((d: Developer) => d.id === id))
    .filter(Boolean);
  return (
    <div className="ai-result">
      {answer.metrics.length > 0 && (
        <div className="ai-metric-row">
          {answer.metrics.map((m: any) => (
            <div key={m.label}>
              <span>{m.label}</span>
              <b>{m.value}</b>
            </div>
          ))}
        </div>
      )}
      {list.length > 0 && (
        <div className="ai-module-list">
          <b className="result-list-title">{answer.title}</b>
          {list.map((m: Module) => (
            <button key={m.id} onClick={() => openModule(m.id)}>
              <span>
                <b>{m.name}</b>
                <small>
                  {m.status} · {m.progress}%
                </small>
              </span>
              <Badge className={`status-${STATUS_CLASS(m.status)}`}>
                {m.progress}%
              </Badge>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
      {people.length > 0 && (
        <div className="ai-developer-list">
          {people.map((d: Developer) => (
            <div key={d.id}>
              <Avatar developer={d} />
              <b>{d.name}</b>
              <small>
                {d.active_assignments || 0} active stages · {d.open_tasks || 0}{" "}
                open tasks
              </small>
            </div>
          ))}
        </div>
      )}
      {answer.insights.map((x: string, i: number) => (
        <p className="ai-insight" key={i}>
          {x}
        </p>
      ))}
      {answer.recommendations.map((x: string, i: number) => (
        <p className="ai-recommendation" key={i}>
          <Zap size={14} />
          {x}
        </p>
      ))}
    </div>
  );
}

function SettingsPage({ settings, developers, notify, refresh, setPage }: any) {
  const [project, setProject] = useState("");
  const [weights, setWeights] = useState<Weights>({
    frontend: 30,
    backend: 30,
    integration: 20,
    testing: 20,
  });
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    if (settings) {
      setProject(settings.project_name);
      setWeights(settings.stage_weights);
    }
  }, [settings]);
  const save = async () => {
    setPending(true);
    try {
      await api(
        "/api/settings",
        json("PATCH", { project_name: project, stage_weights: weights }),
      );
      await refresh("Settings saved.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setPending(false);
    }
  };
  const exportJson = () => window.location.assign("/api/export/json");
  const exportCsv = () => window.location.assign("/api/export/csv");
  const importData = async () => {
    if (!file) return;
    const sure = window.confirm(
      "Import this backup and replace the current project data, including progress, assignments, tasks and history?",
    );
    if (!sure) return;
    setImporting(true);
    try {
      const data = JSON.parse(await file.text());
      await api("/api/import/json", json("POST", data));
      setFile(null);
      await refresh("Backup restored successfully.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not import this backup.");
    } finally {
      setImporting(false);
    }
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageTitle
        kicker="WORKSPACE CONFIGURATION"
        title="Settings & data"
        subtitle="Project reporting, developer profiles and data portability."
        actions={
          <button
            className="button primary"
            disabled={pending || total !== 100}
            onClick={save}
          >
            {pending ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}{" "}
            Save settings
          </button>
        }
      />
      <div className="settings-grid">
        <div className="settings-main">
          <section className="panel settings-section">
            <div className="panel-heading">
              <div>
                <h2>Project settings</h2>
                <p>Used on the dashboard and progress reports.</p>
              </div>
              <Settings2 size={17} />
            </div>
            <label className="settings-project-label">
              Project name
              <input
                maxLength={100}
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </label>
            <div className="settings-section-title">
              <div>
                <b>Stage weights</b>
                <small>
                  Controls overall module completion and project average.
                </small>
              </div>
              <Badge
                className={
                  total === 100 ? "status-completed" : "status-blocked"
                }
              >
                {total}% total
              </Badge>
            </div>
            <div className="weights-grid">
              {STAGE_ORDER.map((s) => (
                <label key={s}>
                  {STAGE_LABEL[s]}
                  <div className="number-unit">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weights[s]}
                      onChange={(e) =>
                        setWeights({ ...weights, [s]: Number(e.target.value) })
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
              ))}
            </div>
            {total !== 100 && (
              <div className="form-error">
                Weights must total exactly 100% before saving.
              </div>
            )}
            <div className="weight-example">
              <Gauge size={15} />
              <span>
                For example, a 50% frontend stage contributes{" "}
                {Math.round(weights.frontend / 2)}% to that module’s weighted
                progress.
              </span>
            </div>
          </section>
          <section className="panel settings-section">
            <div className="panel-heading">
              <div>
                <h2>Backup and restore</h2>
                <p>Keep a restorable copy of all shared project records.</p>
              </div>
              <FileJson size={17} />
            </div>
            <div className="backup-actions">
              <div>
                <b>JSON backup</b>
                <small>
                  Modules, stages, developers, tasks, settings and activity
                  history.
                </small>
              </div>
              <button className="button secondary" onClick={exportJson}>
                <Download size={15} /> Export JSON
              </button>
            </div>
            <div className="backup-actions">
              <div>
                <b>Module progress CSV</b>
                <small>
                  Excel compatible, with stage progress and assignees.
                </small>
              </div>
              <button className="button secondary" onClick={exportCsv}>
                <Download size={15} /> Export CSV
              </button>
            </div>
            <div className="import-row">
              <label className="button secondary file-button">
                <Plus size={15} /> Choose backup
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <span>{file?.name || "No backup selected"}</span>
              <button
                className="button primary"
                disabled={!file || importing}
                onClick={importData}
              >
                {importing ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Download size={15} />
                )}{" "}
                Import backup
              </button>
            </div>
            <div className="import-warning">
              <AlertCircle size={15} /> Import replaces all current records.
              Download a JSON backup first if you need to preserve the current
              state.
            </div>
          </section>
        </div>
        <aside className="settings-side">
          <section className="panel settings-section">
            <div className="panel-heading">
              <div>
                <h2>Planning estimates</h2>
                <p>Initial module scores are guidance, not confirmed facts.</p>
              </div>
              <CircleHelp size={17} />
            </div>
            <div className="estimate-key">
              <div>
                <span className="score-dot high" />
                <b>High impact</b>
                <small>
                  Student 360, Fees, Attendance, Academics, Exams, Employees,
                  Campuses
                </small>
              </div>
              <div>
                <span className="score-dot hard" />
                <b>Higher difficulty</b>
                <small>
                  Fees, Accounting, HR & Payroll, Timetable, LMS, Face Kiosk
                </small>
              </div>
              <p>
                Each module’s impact and difficulty can be edited in the tracker
                or Priority Studio.
              </p>
            </div>
          </section>
          <section className="panel settings-section">
            <div className="panel-heading">
              <div>
                <h2>Team profiles</h2>
                <p>Developer profile management</p>
              </div>
              <Users size={17} />
            </div>
            <div className="developer-settings-summary">
              <div className="avatar-stack">
                {developers.slice(0, 5).map((d: Developer) => (
                  <Avatar key={d.id} developer={d} size="small" />
                ))}
              </div>
              <span>
                {developers.length} profile{developers.length === 1 ? "" : "s"}
              </span>
            </div>
            <a
              className="button secondary full settings-link"
              href="#team"
              onClick={(e) => {
                e.preventDefault();
                setPage("Team & Assignments");
              }}
            >
              Manage developers <ChevronRight size={15} />
            </a>
          </section>
          <section className="panel security-note">
            <LockKeyhole size={17} />
            <div>
              <b>Shared access</b>
              <p>
                {"APP_ACCESS_KEY"} is optional. Without it, anyone with the
                deployed URL can make changes. Configure it on the server for a
                private workspace.
              </p>
            </div>
          </section>
        </aside>
      </div>
      <div className="settings-footnote">
        <CircleHelp size={14} />
        {settings?.seed_estimates_note ||
          "Impact and difficulty scores are editable planning estimates."}{" "}
        The local SQLite database path is configured with DATABASE_PATH.
      </div>
    </>
  );
}

function ModuleDrawer({
  module,
  developers,
  tasks,
  activity,
  close,
  saveModule,
  saveStage,
  saveTask,
  addTask,
  notify,
}: any) {
  const [meta, setMeta] = useState({
    description: module.description,
    impact_score: module.impact_score,
    difficulty_score: module.difficulty_score,
    notes: module.notes,
  });
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        status: string;
        progress: number;
        assigned_developer_id: string;
        notes: string;
      }
    >
  >({});
  const [metaBusy, setMetaBusy] = useState(false);
  const [stageBusy, setStageBusy] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);
  useEffect(() => {
    setMeta({
      description: module.description,
      impact_score: module.impact_score,
      difficulty_score: module.difficulty_score,
      notes: module.notes,
    });
    setDrafts({});
  }, [
    module.id,
    module.updated_at,
    module.stages.map((s: Stage) => s.updated_at).join("|"),
  ]);
  const getDraft = (stage: Stage) =>
    drafts[stage.stage_type] || {
      status: stage.status,
      progress: stage.progress,
      assigned_developer_id: stage.assigned_developer_id
        ? String(stage.assigned_developer_id)
        : "",
      notes: stage.notes,
    };
  const updateDraft = (stage: Stage, key: string, value: any) => {
    const current = getDraft(stage);
    const next = { ...current, [key]: value };
    if (key === "status") {
      if (value === "Completed") next.progress = 100;
      if (value === "Not Started") next.progress = 0;
      if (value === "In Progress" && next.progress === 0) next.progress = 1;
    }
    if (key === "progress") {
      if (value >= 100) {
        next.progress = 100;
        next.status = "Completed";
      } else if (value === 0 && next.status === "Completed")
        next.status = "In Progress";
      else if (value > 0 && next.status === "Not Started")
        next.status = "In Progress";
    }
    setDrafts({ ...drafts, [stage.stage_type]: next });
  };
  const saveMeta = async () => {
    setMetaBusy(true);
    try {
      await saveModule(module.id, {
        ...meta,
        expected_updated_at: module.updated_at,
      });
      notify("Module information saved.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save module.");
    } finally {
      setMetaBusy(false);
    }
  };
  const saveOneStage = async (stage: Stage) => {
    const draft = getDraft(stage);
    setStageBusy(stage.stage_type);
    try {
      await saveStage(module.id, stage.stage_type, {
        ...draft,
        assigned_developer_id: draft.assigned_developer_id
          ? Number(draft.assigned_developer_id)
          : null,
        expected_updated_at: stage.updated_at,
      });
      setDrafts((old) => {
        const copy = { ...old };
        delete copy[stage.stage_type];
        return copy;
      });
      notify(`${STAGE_LABEL[stage.stage_type]} stage saved.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save stage.");
    } finally {
      setStageBusy("");
    }
  };
  const quickComplete = async (stage: Stage) => {
    try {
      await saveStage(module.id, stage.stage_type, {
        status: "Completed",
        expected_updated_at: stage.updated_at,
      });
      notify(`${STAGE_LABEL[stage.stage_type]} marked complete.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not complete stage.");
    }
  };
  const createTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setTaskBusy(true);
    try {
      await addTask({ title: taskTitle, module_id: module.id });
      setTaskTitle("");
      notify("Task added to module.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setTaskBusy(false);
    }
  };
  const modTasks = tasks.filter((t: Task) => t.module_id === module.id);
  const act = useMemo(() => [], []);
  return (
    <>
      <button
        className="drawer-scrim"
        onClick={close}
        aria-label="Close module detail"
      />
      <aside
        className="module-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-dialog-title"
      >
        <div className="drawer-top">
          <div className="drawer-kicker">
            <span>
              {module.category.toUpperCase()} · MODULE {String(module.display_order).padStart(2, "0")}
            </span>
            <button
              className="icon-button"
              onClick={close}
              aria-label="Close details"
            >
              <X size={18} />
            </button>
          </div>
          <div className="drawer-title-row">
            <div>
              <h2 id="module-dialog-title">{module.name}</h2>
              <p>{module.description || "Campus ERP development module"}</p>
            </div>
            <Badge className={`status-${STATUS_CLASS(module.status)}`}>
              {module.status}
            </Badge>
          </div>
          <div className="drawer-progress">
            <div>
              <span>Overall completion</span>
              <b>{module.progress}%</b>
            </div>
            <Progress value={module.progress} />
            <div className="drawer-score-row">
              <span>
                Impact <b>{module.impact_score}/5</b>
              </span>
              <span>
                Difficulty <b>{module.difficulty_score}/5</b>
              </span>
              <span>Last updated {formatDate(module.updated_at)}</span>
            </div>
          </div>
        </div>
        <div className="drawer-content">
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <h3>Development stages</h3>
              <span>Saved to project</span>
            </div>
            <div className="drawer-stage-list">
              {STAGE_ORDER.map((type) => {
                const stage = getStage(module, type);
                const draft = getDraft(stage);
                const changed = Boolean(drafts[type]);
                return (
                  <article className="drawer-stage" key={type}>
                    <div className="drawer-stage-header">
                      <span className={`stage-letter ${type}`}>
                        {STAGE_SHORT[type]}
                      </span>
                      <div>
                        <b>{STAGE_LABEL[type]}</b>
                        <small>
                          {stage.status === "Completed"
                            ? "Completed"
                            : stage.assigned_developer_id
                              ? developers.find(
                                  (d: Developer) =>
                                    d.id === stage.assigned_developer_id,
                                )?.name || "Assigned"
                              : "Unassigned"}
                        </small>
                      </div>
                      <Badge className={`status-${STATUS_CLASS(draft.status)}`}>
                        {draft.status}
                      </Badge>
                    </div>
                    <div className="stage-edit-grid">
                      <label>
                        Status
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            updateDraft(stage, "status", e.target.value)
                          }
                        >
                          {[
                            "Not Started",
                            "In Progress",
                            "Blocked",
                            "Completed",
                          ].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Assigned developer
                        <select
                          value={draft.assigned_developer_id}
                          onChange={(e) =>
                            updateDraft(
                              stage,
                              "assigned_developer_id",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Unassigned</option>
                          {developers.map((d: Developer) => (
                            <option
                              value={d.id}
                              key={d.id}
                              disabled={
                                !d.active &&
                                d.id !== stage.assigned_developer_id
                              }
                            >
                              {d.name}
                              {!d.active ? " (inactive)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="stage-progress-edit">
                      <label>
                        Progress <b>{draft.progress}%</b>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={draft.progress}
                        onChange={(e) =>
                          updateDraft(stage, "progress", Number(e.target.value))
                        }
                      />
                      <Progress value={draft.progress} small />
                    </div>
                    <textarea
                      rows={2}
                      value={draft.notes}
                      placeholder="Stage notes or blocker details"
                      onChange={(e) =>
                        updateDraft(stage, "notes", e.target.value)
                      }
                    />
                    <div className="stage-actions">
                      <button
                        className="button text-button"
                        onClick={() => quickComplete(stage)}
                        disabled={
                          stageBusy === type || stage.status === "Completed"
                        }
                      >
                        <Check size={14} /> Mark complete
                      </button>
                      <button
                        className="button primary small-button"
                        disabled={stageBusy === type || !changed}
                        onClick={() => saveOneStage(stage)}
                      >
                        {stageBusy === type ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <Check size={14} />
                        )}{" "}
                        Save stage
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <h3>Module information</h3>
              <span>Impact and difficulty are planning estimates</span>
            </div>
            <div className="drawer-form-grid">
              <label>
                Impact
                <select
                  value={meta.impact_score}
                  onChange={(e) =>
                    setMeta({ ...meta, impact_score: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {n < 3 ? "Lower" : "High"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Difficulty
                <select
                  value={meta.difficulty_score}
                  onChange={(e) =>
                    setMeta({
                      ...meta,
                      difficulty_score: Number(e.target.value),
                    })
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {n < 3 ? "Lower" : "High"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea
                rows={2}
                value={meta.description}
                onChange={(e) =>
                  setMeta({ ...meta, description: e.target.value })
                }
                placeholder="Add a short module description"
              />
            </label>
            <label>
              Module notes
              <textarea
                rows={3}
                value={meta.notes}
                onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
                placeholder="Planning notes, dependencies or context"
              />
            </label>
            <div className="drawer-save-row">
              <button
                className="button primary small-button"
                disabled={metaBusy}
                onClick={saveMeta}
              >
                {metaBusy ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Check size={14} />
                )}{" "}
                Save module details
              </button>
            </div>
          </section>
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <h3>Tasks</h3>
              <Badge>{modTasks.length}</Badge>
            </div>
            <form className="inline-task-form" onSubmit={createTask}>
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Add a task for this module"
                maxLength={160}
              />
              <button
                className="icon-button add-task-icon"
                disabled={!taskTitle.trim() || taskBusy}
                aria-label="Add task"
              >
                {taskBusy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Plus size={17} />
                )}
              </button>
            </form>
            {modTasks.length ? (
              <div className="drawer-task-list">
                {modTasks.map((task: Task) => (
                  <div className="drawer-task" key={task.id}>
                    <button
                      className={`task-check ${task.status === "Done" ? "done" : ""}`}
                      onClick={() =>
                        saveTask(task.id, {
                          status: task.status === "Done" ? "To Do" : "Done",
                        }).catch((e: any) => notify(e.message))
                      }
                      aria-label={
                        task.status === "Done" ? "Reopen task" : "Complete task"
                      }
                    >
                      {task.status === "Done" && <Check size={12} />}
                    </button>
                    <div>
                      <b className={task.status === "Done" ? "task-done" : ""}>
                        {task.title}
                      </b>
                      <small>
                        {task.status} · {task.priority}
                      </small>
                    </div>
                    <select
                      value={task.assigned_developer_id || ""}
                      onChange={(e) =>
                        saveTask(task.id, {
                          assigned_developer_id: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }).catch((err: any) => notify(err.message))
                      }
                    >
                      <option value="">Unassigned</option>
                      {developers.map((d: Developer) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="drawer-empty">No tasks for this module yet.</div>
            )}
          </section>
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <h3>Recent activity</h3>
              <ActivityIcon size={15} />
            </div>
            <ModuleActivity
              activity={activity.filter(
                (item: Activity) =>
                  item.entity_type === "module" && item.entity_id === module.id,
              )}
            />
          </section>
        </div>
        <div className="drawer-footer">
          <button className="button secondary" onClick={close}>
            Close details
          </button>
          <div>
            <ChevronLeft size={14} /> Use tracker to open another module
          </div>
        </div>
      </aside>
    </>
  );
}
function ModuleActivity({ activity }: { activity: Activity[] }) {
  if (!activity.length)
    return (
      <div className="drawer-empty">
        No module changes have been recorded yet.
      </div>
    );
  return (
    <div className="module-events">
      {activity.slice(0, 12).map((item) => (
        <div key={item.id}>
          <span className="activity-dot">
            <ActivityIcon size={11} />
          </span>
          <p>
            {item.summary}
            <time>{formatTime(item.timestamp)}</time>
          </p>
        </div>
      ))}
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Search;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={18} />
      </span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Loading() {
  return (
    <div className="panel loading-panel">
      <LoaderCircle className="spin" size={19} /> Loading project data…
    </div>
  );
}
function formatTime(value: string) {
  const date = new Date(value);
  return isNaN(date.getTime())
    ? "Recently"
    : new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.max(0, Math.round((Date.now() - date.getTime()) / 60000)),
        "minute",
      );
}
function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
        date,
      );
}

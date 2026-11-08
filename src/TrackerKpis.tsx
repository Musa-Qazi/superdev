import { useMemo } from "react";
import type { Module, StageType } from "./types";
import "./tracker-kpis.css";

const stages: { key: StageType; label: string }[] = [
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "integration", label: "Integration" },
  { key: "testing", label: "Testing" },
];

export function TrackerKpis({ modules, total }: { modules: Module[]; total: number }) {
  const stats = useMemo(() => {
    const count = modules.length;
    const average = count ? Math.round(modules.reduce((sum, module) => sum + module.progress, 0) / count) : 0;
    return {
      count,
      average,
      completed: modules.filter((module) => module.status === "Completed").length,
      blocked: modules.filter((module) => module.status === "Blocked").length,
      integration: modules.filter((module) => module.status === "Ready for Integration").length,
      testing: modules.filter((module) => module.status === "Ready for Testing").length,
      stages: stages.map(({ key, label }) => {
        const records = modules.map((module) => module.stages.find((stage) => stage.stage_type === key));
        return {
          key, label,
          completed: records.filter((stage) => stage?.status === "Completed").length,
          blocked: records.filter((stage) => stage?.status === "Blocked").length,
          average: count ? Math.round(records.reduce((sum, stage) => sum + (stage?.progress ?? 0), 0) / count) : 0,
        };
      }),
    };
  }, [modules]);

  return (
    <section className="tracker-kpis" aria-label="Module tracker summary for the current filters">
      <div className="tracker-kpis-scroll">
        <div className="tracker-kpi tracker-kpi-overall">
          <div className="tracker-kpi-label">Modules <span>{stats.count} / {total} shown</span></div>
          <div className="tracker-kpi-value">{stats.average}% <small>avg progress</small></div>
          <div className="tracker-kpi-meta">{stats.completed} fully complete</div>
          <div className="tracker-kpi-bar"><i style={{ width: `${stats.average}%` }} /></div>
        </div>
        {stats.stages.map((stage) => (
          <div className={`tracker-kpi tracker-kpi-${stage.key}`} key={stage.key}>
            <div className="tracker-kpi-label">{stage.label} <span>{stage.average}% avg</span></div>
            <div className="tracker-kpi-value">{stage.completed}<small> / {stats.count} complete</small></div>
            <div className="tracker-kpi-meta">{stage.blocked ? `${stage.blocked} blocked` : "No blockers"}</div>
            <div className="tracker-kpi-bar" role="progressbar" aria-label={`${stage.label} average progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage.average}><i style={{ width: `${stage.average}%` }} /></div>
          </div>
        ))}
        <div className="tracker-kpi tracker-kpi-attention">
          <div className="tracker-kpi-label">Delivery signals</div>
          <div className="tracker-kpi-signals"><span><b>{stats.blocked}</b> blocked</span><span><b>{stats.integration}</b> to integrate</span><span><b>{stats.testing}</b> to test</span></div>
        </div>
      </div>
    </section>
  );
}

import { PlanetGrid } from "./PlanetGrid";

export function GalaxySection({
  galaxy,
  onReorder,
  onAddProject,
  orchestrator,
  galaxyPulse,
  showAddCard,
}) {
  return (
    <section className="max-w-6xl mx-auto mb-16">
      <header className="flex items-end justify-between mb-5 px-1">
        <div className="space-y-1">
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.35em]"
            style={{ color: "var(--text-faint)" }}
          >
            Galaxy
          </span>
          <div className="text-[11px] font-mono text-white/60">{galaxy.path}</div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.3em] text-white/30">
          {galaxy.projects.length} Planets
        </div>
      </header>

      <PlanetGrid
        galaxyId={galaxy.path}
        projects={galaxy.projects}
        onReorder={(nextProjects) => onReorder(nextProjects, galaxy.path)}
        onAddProject={onAddProject}
        orchestrator={orchestrator}
        galaxyPulse={galaxyPulse}
        showAddCard={showAddCard}
      />
    </section>
  );
}

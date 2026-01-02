import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlanetGrid } from "./PlanetGrid";

export function GalaxySection({
  galaxy,
  onReorder,
  onAddProject,
  orchestrator,
  galaxyPulse,
  galaxyBootSignal,
  headerPulseSignal,
  collapseState = "expanded",
  isLastGalaxy = false,
  showAddCard,
}) {
  const containerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [maxHeight, setMaxHeight] = useState("0px");
  const isCollapsing = collapseState === "collapsing";

  useLayoutEffect(() => {
    if (!containerRef.current || isCollapsing) return;
    const nextHeight = containerRef.current.scrollHeight;
    const expandedMaxHeight = Math.max(nextHeight, 2000);
    setMaxHeight(`${expandedMaxHeight}px`);
  }, [galaxy.projects.length, isCollapsing, showAddCard]);

  useLayoutEffect(() => {
    if (!containerRef.current || !isCollapsing) return;
    const nextHeight = containerRef.current.scrollHeight;
    setMaxHeight(`${nextHeight}px`);
    requestAnimationFrame(() => {
      setMaxHeight("0px");
    });
  }, [isCollapsing]);

  useEffect(() => {
    if (headerPulseSignal === undefined) return;
    setIsPulsing(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setIsPulsing(false);
    }, 700);
  }, [headerPulseSignal]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="max-w-6xl mx-auto overflow-hidden"
      style={{
        maxHeight: isCollapsing ? "0px" : maxHeight,
        opacity: isCollapsing ? 0 : 1,
        marginBottom: isCollapsing ? "0px" : "4rem",
        paddingBottom: !isCollapsing && isLastGalaxy ? "150px" : "0px",
        transition: "max-height 650ms cubic-bezier(0.4, 0, 0.2, 1), opacity 650ms cubic-bezier(0.4, 0, 0.2, 1), margin-bottom 650ms cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "max-height, opacity",
      }}
      data-galaxy-state={collapseState}
    >
      <header className={`flex items-end justify-between mb-5 px-1 ${isPulsing ? "galaxy-header-pulse" : ""}`}>
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
        galaxyBootSignal={galaxyBootSignal}
        collapsePhase={collapseState}
        showAddCard={showAddCard}
      />
    </section>
  );
}

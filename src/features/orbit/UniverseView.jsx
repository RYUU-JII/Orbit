import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useOrbitContext } from "../../domain/orbit/OrbitContext";
import { StarBackground } from "../../ui/StarBackground";
import { GalaxySection } from "./components/GalaxySection";
import { EmptyState } from "./components/EmptyState";
import { useUniverseOrchestrator } from "./hooks/useUniverseOrchestrator";

export function UniverseView() {
  const COLLAPSE_DURATION_MS = 650;
  const {
    projects,
    paths,
    excluded,
    reorderProjects,
    addPaths,
    togglePath,
    deletePath,
    restoreExcluded,
  } = useOrbitContext();

  const orchestrator = useUniverseOrchestrator();
  const galaxyCacheRef = useRef(new Map());
  const collapseTimersRef = useRef(new Map());
  const prevEnabledRef = useRef(new Map());
  const prevCountsRef = useRef(new Map());
  const hasSeededCountsRef = useRef(false);
  const [collapsingGalaxies, setCollapsingGalaxies] = useState({});
  const [galaxyBootSignals, setGalaxyBootSignals] = useState({});
  const [galaxyHeaderSignals, setGalaxyHeaderSignals] = useState({});

  const groupedByPath = useMemo(() => {
    const grouped = new Map();
    projects.forEach((project) => {
      const sourcePath = project.source_path || project.sourcePath;
      if (!sourcePath) return;
      if (!grouped.has(sourcePath)) grouped.set(sourcePath, []);
      grouped.get(sourcePath).push(project);
    });
    return grouped;
  }, [projects]);

  useEffect(() => {
    groupedByPath.forEach((value, path) => {
      galaxyCacheRef.current.set(path, value);
    });
  }, [groupedByPath]);

  useEffect(() => {
    const nextEnabled = new Map(paths.map((path) => [path.path, path.enabled]));
    nextEnabled.forEach((enabled, path) => {
      const prevEnabled = prevEnabledRef.current.get(path);
      if (enabled && !prevEnabled) {
        setGalaxyBootSignals((prev) => ({
          ...prev,
          [path]: (prev[path] || 0) + 1,
        }));
      }
    });
    prevEnabledRef.current = nextEnabled;
  }, [paths]);

  useEffect(() => {
    const nextCounts = new Map();
    paths.forEach((path) => {
      if (!path.enabled) return;
      const count = groupedByPath.get(path.path)?.length || 0;
      nextCounts.set(path.path, count);
    });

    if (!hasSeededCountsRef.current) {
      prevCountsRef.current = nextCounts;
      hasSeededCountsRef.current = true;
      return;
    }

    nextCounts.forEach((count, path) => {
      const prev = prevCountsRef.current.get(path) || 0;
      if (count > prev) {
        setGalaxyHeaderSignals((prevSignals) => ({
          ...prevSignals,
          [path]: (prevSignals[path] || 0) + 1,
        }));
      }
    });

    prevCountsRef.current = nextCounts;
  }, [groupedByPath, paths]);

  useEffect(() => {
    return () => {
      collapseTimersRef.current.forEach((timer) => clearTimeout(timer));
      collapseTimersRef.current.clear();
    };
  }, []);

  const galaxies = useMemo(() => {
    return paths
      .map((path) => {
        const collapseEntry = collapsingGalaxies[path.path];
        if (!path.enabled && !collapseEntry) return null;
        const projectsForGalaxy = path.enabled
          ? groupedByPath.get(path.path) || []
          : collapseEntry?.projects || [];
        return {
          path: path.path,
          enabled: path.enabled,
          isCollapsing: Boolean(collapseEntry),
          projects: projectsForGalaxy,
        };
      })
      .filter(Boolean);
  }, [collapsingGalaxies, groupedByPath, paths]);

  const handleAddFolders = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: true,
        title: "Orbit 궤도 추가: 프로젝트 폴더 선택",
      });

      if (!selected) return;
      const newPathsArray = Array.isArray(selected) ? selected : [selected];
      orchestrator.captureSnapshot();
      addPaths(newPathsArray);
      orchestrator.markLayoutShift();

      console.debug("[orbit] New paths added to orbit:", newPathsArray);
    } catch (error) {
      console.error("[orbit] Failed to add folders:", error);
    }
  }, [addPaths, orchestrator]);

  const handleManualIgnition = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
        title: "Orbit manual ignition: select project folder",
      });

      if (!selected) return;
      const newPathsArray = Array.isArray(selected) ? selected : [selected];
      orchestrator.captureSnapshot();
      addPaths(newPathsArray);
      orchestrator.markLayoutShift();

      console.debug("[orbit] Manual project ignition:", newPathsArray);
    } catch (error) {
      console.error("[orbit] Failed to add project:", error);
    }
  }, [addPaths, orchestrator]);

  const handleTogglePath = useCallback(
    (index, pathValue) => {
      const target = paths[index];
      if (!target) return;
      orchestrator.captureSnapshot();
      orchestrator.notifyGalaxyToggle(pathValue);

      if (target.enabled) {
        const cachedProjects = galaxyCacheRef.current.get(pathValue) || [];
        setCollapsingGalaxies((prev) => ({
          ...prev,
          [pathValue]: { projects: cachedProjects },
        }));
        const existingTimer = collapseTimersRef.current.get(pathValue);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          setCollapsingGalaxies((prev) => {
            const next = { ...prev };
            delete next[pathValue];
            return next;
          });
          collapseTimersRef.current.delete(pathValue);
        }, COLLAPSE_DURATION_MS);
        collapseTimersRef.current.set(pathValue, timer);
      } else if (collapsingGalaxies[pathValue]) {
        setCollapsingGalaxies((prev) => {
          const next = { ...prev };
          delete next[pathValue];
          return next;
        });
        const existingTimer = collapseTimersRef.current.get(pathValue);
        if (existingTimer) {
          clearTimeout(existingTimer);
          collapseTimersRef.current.delete(pathValue);
        }
      }

      togglePath(index);
    },
    [collapsingGalaxies, orchestrator, paths, togglePath]
  );

  const handleDeletePath = useCallback(
    (pathValue) => {
      orchestrator.captureSnapshot();
      deletePath(pathValue);
      orchestrator.markLayoutShift();
    },
    [deletePath, orchestrator]
  );

  const handleRestoreExcluded = useCallback(() => {
    orchestrator.captureSnapshot();
    restoreExcluded();
    orchestrator.markLayoutShift();
  }, [orchestrator, restoreExcluded]);

  const showGlobalEmpty = galaxies.length === 0;
  const activeGalaxies = galaxies.filter((galaxy) => galaxy.enabled);
  const lastGalaxyPath = activeGalaxies[activeGalaxies.length - 1]?.path;

  return (
    <div
      ref={orchestrator.universeRef}
      className="stars-container min-h-screen p-10 font-sans selection:bg-indigo-500/30"
    >
      <StarBackground />

      <div className="relative z-10">
        <header className="max-w-6xl mx-auto mb-12">
          <div className="flex justify-between items-end mb-10">
            <div style={{ color: "var(--text-main)" }}>
              <h1 className="text-5xl font-extralight tracking-[0.2em] uppercase">Orbit</h1>
              <p className="mt-3 font-light" style={{ color: "var(--text-muted)" }}>
                관제 센터: 활성화된 궤도의 프로젝트를 감시합니다.
              </p>
            </div>

            <button
              onClick={handleAddFolders}
              className="relative group px-8 py-3 text-[11px] font-medium tracking-[0.2em] uppercase transition-all duration-500 active:scale-95 overflow-hidden backdrop-blur-md"
              style={{
                color: "var(--text-main)",
                borderRadius: "0",
                background:
                  "linear-gradient(to right, transparent, var(--surface-glass) 25%, var(--surface-glass) 75%, transparent)",
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(255,255,255,0.05), transparent)",
                }}
              />

              <div
                className="absolute inset-y-0 -left-4 -right-4 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 opacity-70"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.03) 65%, rgba(255,255,255,0) 100%)",
                }}
              />
              <span className="relative z-10 flex items-baseline gap-2">
                <span>+ Expand Radar Fields</span>
              </span>
            </button>
          </div>
          <div
            className="flex flex-wrap gap-3 py-6 border-y"
            style={{ borderColor: "var(--surface-border)" }}
          >
            {paths.length > 0 ? (
              <>
                <span
                  className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.35em] border"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-faint)" }}
                >
                  Active Radar Zones
                </span>
                {paths.map((path, index) => (
                  <div
                    key={path.path}
                    className="group flex items-center gap-4 px-4 py-1.5 border transition-all duration-500 backdrop-blur-md"
                    style={{
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: path.enabled
                        ? "rgba(79, 70, 229, 0.04)"
                        : "var(--surface-glass)",
                      borderColor: path.enabled ? "rgba(99, 102, 241, 0.35)" : "var(--surface-border)",
                      color: path.enabled ? "var(--text-main)" : "var(--text-faint)",
                    }}
                  >
                    <div
                      onClick={() => handleTogglePath(index, path.path)}
                      className="w-7 h-3.5 rounded-full relative transition-all duration-500 cursor-pointer opacity-70 group-hover:opacity-90"
                      style={{
                        backgroundColor: path.enabled
                          ? "rgba(99, 102, 241, 0.7)"
                          : "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div
                        className={`absolute top-1/2 left-0.5 w-2 h-2 rounded-full bg-white/90 transition-all duration-500 -translate-y-1/2 ${
                          path.enabled ? "translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-mono tracking-tight opacity-60 group-hover:opacity-85">
                      {path.path}
                    </span>
                    <button
                      onClick={() => handleDeletePath(path.path)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full transition-all text-red-300 hover:text-red-400"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p
                className="text-xs italic font-light tracking-widest"
                style={{ color: "var(--text-faint)" }}
              >
                등록된 궤도가 없습니다.
              </p>
            )}
          </div>
        </header>

        {showGlobalEmpty ? (
          <EmptyState onAddProject={handleManualIgnition} />
        ) : (
          <div className="space-y-16">
            {galaxies.map((galaxy) => (
              <GalaxySection
                key={galaxy.path}
                galaxy={galaxy}
                onReorder={reorderProjects}
                onAddProject={handleManualIgnition}
                orchestrator={orchestrator}
                galaxyPulse={orchestrator.galaxySignals[galaxy.path]}
                galaxyBootSignal={galaxyBootSignals[galaxy.path]}
                headerPulseSignal={galaxyHeaderSignals[galaxy.path]}
                collapseState={galaxy.isCollapsing ? "collapsing" : "expanded"}
                isLastGalaxy={galaxy.path === lastGalaxyPath && galaxy.enabled}
                showAddCard={galaxy.path === lastGalaxyPath && galaxy.enabled}
              />
            ))}
          </div>
        )}

        {excluded.length > 0 && (
          <footer
            className="max-w-6xl mx-auto mt-10 text-[10px] text-right uppercase tracking-[0.2em]"
            style={{ color: "var(--text-faint)" }}
          >
            Hidden Objects: {excluded.length} ?
            <button
              onClick={handleRestoreExcluded}
              className="ml-2 hover:text-[var(--color-primary)] transition-colors"
            >
              Restore All
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

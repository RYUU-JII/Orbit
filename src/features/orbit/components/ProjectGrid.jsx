import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { ProjectCard, ProjectCardPreview } from "./ProjectCard";

const HOLD_TO_DRAG_MS = 220;
const DROP_ANIMATION_MS = 260;
const SETTLE_ANIMATION_MS = 480;
const OVERLAY_SCALE = 1.05;

export function ProjectGrid({ projects, onReorder, onAddProject }) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [isCoreHovered, setIsCoreHovered] = useState(false);
  const gridRef = useRef(null);
  const [displayProjects, setDisplayProjects] = useState(() => projects);
  const [vanishOverlays, setVanishOverlays] = useState([]);
  const vanishOverlayTimersRef = useRef(new Map());
  const vanishingPathsRef = useRef(new Set());
  const gridItemRefs = useRef(new Map());
  const previousItemRectsRef = useRef(new Map());
  const [appearStageByPath, setAppearStageByPath] = useState({});
  const appearTimersRef = useRef(new Map());
  const layoutSnapshotRef = useRef(new Map());
  const gridRectRef = useRef(null);
  const skipFlipUntilRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: HOLD_TO_DRAG_MS, tolerance: 6 },
    })
  );

  const projectIds = useMemo(() => displayProjects.map((project) => project.path), [displayProjects]);
  const activeProject = useMemo(
    () => projects.find((project) => project.path === activeId) || null,
    [activeId, projects]
  );

  const dropAnimation = useMemo(() => {
    const totalDuration = DROP_ANIMATION_MS + SETTLE_ANIMATION_MS;
    const landingOffset = DROP_ANIMATION_MS / totalDuration;

    return {
      duration: totalDuration,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      keyframes({ active, transform }) {
        const activeId = String(active.id);
        const snapshotRect = layoutSnapshotRef.current.get(activeId) || active.rect;
        const width = snapshotRect?.width ?? 0;
        const height = snapshotRect?.height ?? 0;
        const scaleDelta = OVERLAY_SCALE - 1;
        const xOffset = (width * scaleDelta) / 2;
        const yOffset = (height * scaleDelta) / 2;

        const correctedFinal = {
          ...transform.final,
          x: transform.final.x - xOffset,
          y: transform.final.y - yOffset,
          scaleX: 1,
          scaleY: 1,
        };

        return [
          { transform: CSS.Transform.toString(transform.initial), offset: 0 },
          { transform: CSS.Transform.toString(correctedFinal), offset: landingOffset },
          { transform: CSS.Transform.toString(correctedFinal), offset: 1 },
        ];
      },
      sideEffects({ active, dragOverlay }) {
        if (active?.node) active.node.style.visibility = "hidden";
        if (dragOverlay?.node) dragOverlay.node.classList.add("orbit-overlay-settling");
        return () => {
          if (active?.node) active.node.style.visibility = "";
          if (dragOverlay?.node) {
            dragOverlay.node.style.opacity = "0";
            dragOverlay.node.style.transition = "none";
          }
        };
      },
    };
  }, []);

  const collisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    return closestCenter(args);
  }, []);

  const captureLayoutSnapshot = useCallback(() => {
    if (!gridRef.current) {
      layoutSnapshotRef.current = new Map();
      gridRectRef.current = null;
      return;
    }
    const nextSnapshot = new Map();
    gridRectRef.current = gridRef.current.getBoundingClientRect();
    gridRef.current.querySelectorAll("[data-project-id]").forEach((node) => {
      const rect = node.getBoundingClientRect();
      const projectId = node.dataset.projectId;
      if (projectId) nextSnapshot.set(projectId, rect);
    });
    layoutSnapshotRef.current = nextSnapshot;
  }, []);

  const updateDropIndicator = useCallback((over) => {
    if (!over || !gridRectRef.current) {
      setDropIndicator(null);
      return;
    }
    const overId = String(over.id);
    const initialRect = layoutSnapshotRef.current.get(overId);
    if (!initialRect) {
      setDropIndicator(null);
      return;
    }
    setDropIndicator({
      width: initialRect.width,
      height: initialRect.height,
      x: initialRect.left - gridRectRef.current.left,
      y: initialRect.top - gridRectRef.current.top,
    });
  }, []);

  const handleDragStart = useCallback((event) => {
    captureLayoutSnapshot();
    setActiveId(event.active?.id ?? null);
    setOverId(event.over?.id ?? null);
    updateDropIndicator(event.over);
  }, [captureLayoutSnapshot, updateDropIndicator]);

  const handleDragOver = useCallback((event) => {
    setOverId(event.over?.id ?? null);
    updateDropIndicator(event.over);
  }, [updateDropIndicator]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropIndicator(null);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.path === active.id);
      const newIndex = projects.findIndex((p) => p.path === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(projects, oldIndex, newIndex));
      }
    }
    setActiveId(null);
    setOverId(null);
    setDropIndicator(null);
    skipFlipUntilRef.current = performance.now() + DROP_ANIMATION_MS + SETTLE_ANIMATION_MS;
  }, [onReorder, projects]);

  const createVanishOverlay = useCallback((project) => {
    const path = project?.path;
    const node = path ? gridItemRefs.current.get(path) : null;
    const container = gridRef.current;
    if (!path || !node || !container) return;

    const nodeRect = node.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const overlay = {
      key: `${path}-${Date.now()}`,
      path,
      project,
      left: nodeRect.left - containerRect.left,
      top: nodeRect.top - containerRect.top,
      width: nodeRect.width,
      height: nodeRect.height,
    };

    setVanishOverlays((prev) => prev.concat(overlay));

    const timeoutId = setTimeout(() => {
      setVanishOverlays((prev) => prev.filter((item) => item.key !== overlay.key));
      vanishOverlayTimersRef.current.delete(overlay.key);
    }, 700);
    vanishOverlayTimersRef.current.set(overlay.key, timeoutId);
  }, []);

  const scheduleAppear = useCallback((path) => {
    const existing = appearTimersRef.current.get(path);
    if (existing) {
      clearTimeout(existing.start);
      clearTimeout(existing.cleanup);
    }

    setAppearStageByPath((prev) => ({ ...prev, [path]: "pending" }));

    const start = setTimeout(() => {
      setAppearStageByPath((prev) => ({ ...prev, [path]: "animate" }));
    }, 50);

    const cleanup = setTimeout(() => {
      setAppearStageByPath((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      appearTimersRef.current.delete(path);
    }, 1400);

    appearTimersRef.current.set(path, { start, cleanup });
  }, []);

  const handleVanishStart = useCallback((project) => {
    if (!project?.path) return;
    if (vanishingPathsRef.current.has(project.path)) return;

    vanishingPathsRef.current.add(project.path);
    createVanishOverlay(project);
    setDisplayProjects((prev) => prev.filter((p) => p.path !== project.path));

    const cleanupKey = `vanish:${project.path}`;
    const cleanupId = setTimeout(() => {
      vanishingPathsRef.current.delete(project.path);
      vanishOverlayTimersRef.current.delete(cleanupKey);
    }, 700);
    vanishOverlayTimersRef.current.set(cleanupKey, cleanupId);
  }, [createVanishOverlay]);

  useLayoutEffect(() => {
    setDisplayProjects((prev) => {
      const incomingMap = new Map(projects.map((project) => [project.path, project]));

      prev.forEach((project) => {
        if (!incomingMap.has(project.path) && !vanishingPathsRef.current.has(project.path)) {
          createVanishOverlay(project);
        }
      });

      const next = projects.filter((project) => !vanishingPathsRef.current.has(project.path));
      const prevPaths = new Set(prev.map((project) => project.path));
      next.forEach((project) => {
        if (!prevPaths.has(project.path)) {
          scheduleAppear(project.path);
        }
      });
      return next;
    });
  }, [createVanishOverlay, projects, scheduleAppear]);

  useEffect(() => {
    return () => {
      vanishOverlayTimersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      vanishOverlayTimersRef.current.clear();
      appearTimersRef.current.forEach(({ start, cleanup }) => {
        clearTimeout(start);
        clearTimeout(cleanup);
      });
      appearTimersRef.current.clear();
    };
  }, []);

  useLayoutEffect(() => {
    const nextRects = new Map();
    gridItemRefs.current.forEach((node, path) => {
      if (node) nextRects.set(path, node.getBoundingClientRect());
    });

    if (performance.now() < skipFlipUntilRef.current) {
      previousItemRectsRef.current = nextRects;
      return;
    }

    const previousRects = previousItemRectsRef.current;
    nextRects.forEach((nextRect, path) => {
      const prevRect = previousRects.get(path);
      if (!prevRect) return;

      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (dx === 0 && dy === 0) return;

      const node = gridItemRefs.current.get(path);
      if (!node) return;

      node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      node.style.transition = "transform 0s";

      requestAnimationFrame(() => {
        node.style.transition = "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)";
        node.style.transform = "translate3d(0, 0, 0)";
      });
    });

    previousItemRectsRef.current = nextRects;
  }, [displayProjects]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div ref={gridRef} className="relative w-full">
        {/* 프로젝트가 0개일 때의 렌더링 로직 수정 */}
        {displayProjects.length === 0 && vanishOverlays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-1000">
            
            <div className="flex flex-col items-center">
              {/* 아이콘 영역 (호버 감지 범위) */}
              <div className="relative w-32 h-32 mb-12 flex items-center justify-center">
                {/* Glow Layer */}
                <div className={`absolute inset-[-40px] rounded-full transition-all duration-1000 ease-out
                  bg-[radial-gradient(circle,_rgba(247,231,206,0.15)_0%,_rgba(174,198,207,0.1)_40%,_transparent_70%)] 
                  blur-3xl pointer-events-none ${isCoreHovered ? "opacity-100 scale-125" : "opacity-0"}`} 
                />
                
                {/* Orbit Line */}
                <div className={`relative w-full h-full border rounded-full flex items-center justify-center transition-colors duration-700 animate-[spin_20s_linear_infinite] ${isCoreHovered ? "border-white/10" : "border-white/5"}`}>
                  {/* Planet */}
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 
                    rounded-full transition-all duration-700 ${isCoreHovered ? "bg-[#F7E7CE] shadow-[0_0_15px_#F7E7CE,0_0_30px_#AEC6CF]" : "bg-white/20"}`} 
                  />
                </div>

                {/* Central Core */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    onClick={onAddProject}
                    onPointerEnter={() => setIsCoreHovered(true)}
                    onPointerLeave={() => setIsCoreHovered(false)}
                    className={`w-20 h-20 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-700 cursor-pointer ${isCoreHovered ? "border-[#F7E7CE]/30 scale-110 bg-white/[0.05]" : "border-white/5 bg-white/[0.02]"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" 
                      className={`transition-colors duration-700 ${isCoreHovered ? "text-[#F7E7CE]" : "text-white/10"}`}>
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 텍스트 영역: 코어 호버에 연동 */}
              <div className="space-y-5 pointer-events-none">
                <h2 className={`text-2xl font-extralight text-white/40
                  transition-all duration-1000 ease-out tracking-[0.4em] uppercase whitespace-nowrap
                  ${isCoreHovered ? "text-white/80 text-[#F7E7CE] drop-shadow-[0_0_12px_rgba(247,231,206,0.5)]": ""}`}>
                  LIGHT UP THE STARS
                </h2>
                <p className={`text-white/30 
                  transition-all duration-1000 delay-100 max-w-sm leading-relaxed font-light text-sm italic mx-auto
                  ${isCoreHovered? "text-white/70 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" : ""}`}>
                  당신의 우주에 첫 번째 별을 띄울 시간입니다. <br />
                  <span className={`opacity-80 ${isCoreHovered ? "opacity-100" : ""}`}>코어를 클릭하여 탐사를 시작하세요.</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <SortableContext items={projectIds} strategy={rectSortingStrategy}>
            <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(() => {
                let appearIndex = 0;
                return displayProjects.map((project) => {
                  const stage = appearStageByPath[project.path];
                  const shouldAnimate = stage === "animate";
                  const innerClassName = shouldAnimate ? "animate-card-appear" : undefined;
                  const innerStyle = stage
                    ? {
                        opacity: 0,
                        ...(shouldAnimate ? { animationDelay: `${appearIndex++ * 0.08}s` } : {}),
                      }
                    : undefined;

                  return (
                    <div
                      key={project.path}
                      ref={(node) => {
                        if (node) gridItemRefs.current.set(project.path, node);
                        else gridItemRefs.current.delete(project.path);
                      }}
                      style={{ width: "100%" }}
                    >
                      <div className={innerClassName} style={innerStyle}>
                        <ProjectCard
                          project={project}
                          isSorting={Boolean(activeId)}
                          isDropTarget={Boolean(activeId) && overId === project.path && overId !== activeId}
                          onVanishStart={handleVanishStart}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
                          
              {/* Permanent Add Project Slot */}
              <div className="animate-card-appear" style={{ opacity: 0 }}>
                <div
                  onClick={onAddProject}
                  className="group relative h-full min-h-[220px] rounded-[var(--radius-lg)] border-2 border-dashed border-white/5 hover:border-indigo-500/40 bg-white/[0.02] hover:bg-indigo-500/[0.04] transition-all cursor-pointer flex flex-col items-center justify-center"
                >
                  <div className="w-12 h-12 mb-4 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-white/20 group-hover:text-indigo-400">
                      <circle cx="12" cy="12" r="8" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="2" x2="12" y2="5" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="5" y2="12" />
                      <line x1="19" y1="12" x2="22" y2="12" />
                    </svg>
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-white/20 group-hover:text-indigo-400">Manual Ignition</span>
                </div>
              </div>
            </main>
          </SortableContext>
        )}

        {vanishOverlays.map((overlay) => (
          <div
            key={overlay.key}
            className="pointer-events-none absolute"
            style={{
              left: overlay.left,
              top: overlay.top,
              width: overlay.width,
              height: overlay.height,
              zIndex: 40,
            }}
          >
            <div className="animate-card-vanish" style={{ width: "100%", height: "100%" }}>
              <ProjectCardPreview project={overlay.project} />
            </div>
          </div>
        ))}

        {/* Drop Indicator (Always rendered but visible via dropIndicator state) */}
        {dropIndicator && (
          <div
            className="pointer-events-none absolute rounded-3xl border border-dashed border-indigo-400/60 bg-indigo-500/5 shadow-[0_0_30px_rgba(99,102,241,0.2)]"
            style={{
              width: dropIndicator.width,
              height: dropIndicator.height,
              left: 0,
              top: 0,
              transform: `translate3d(${dropIndicator.x}px, ${dropIndicator.y}px, 0)`,
              transition: "transform 120ms ease, width 120ms ease, height 120ms ease",
            }}
          />
        )}
      </div>

      <DragOverlay
        dropAnimation={dropAnimation}
        adjustScale={true}
        className="orbit-overlay"
        style={{
          "--orbit-overlay-scale": String(OVERLAY_SCALE),
          "--orbit-drop-duration": `${DROP_ANIMATION_MS}ms`,
          "--orbit-settle-duration": `${SETTLE_ANIMATION_MS}ms`,
        }}
      >
        {activeProject ? <ProjectCardPreview project={activeProject} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

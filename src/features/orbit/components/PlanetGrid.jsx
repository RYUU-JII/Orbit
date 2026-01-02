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
import { AddProjectCard } from "./AddProjectCard";

const HOLD_TO_DRAG_MS = 220;
const DROP_ANIMATION_MS = 260;
const SETTLE_ANIMATION_MS = 480;
const OVERLAY_SCALE = 1.05;
const SLOT_EXPAND_DELAY_MS = 150;
const GALAXY_BOOT_STAGGER_MS = 90;

export function PlanetGrid({
  galaxyId,
  projects,
  onReorder,
  onAddProject,
  orchestrator,
  galaxyPulse,
  galaxyBootSignal,
  collapsePhase = "expanded",
  showAddCard = false,
}) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState(null);
  const gridRef = useRef(null);
  const [displayProjects, setDisplayProjects] = useState(() => projects);
  const [vanishOverlays, setVanishOverlays] = useState([]);
  const vanishOverlayTimersRef = useRef(new Map());
  const vanishingPathsRef = useRef(new Set());
  const gridItemRefs = useRef(new Map());
  const [appearStageByPath, setAppearStageByPath] = useState({});
  const appearTimersRef = useRef(new Map());
  const layoutSnapshotRef = useRef(new Map());
  const gridRectRef = useRef(null);
  const [isGalaxySyncing, setIsGalaxySyncing] = useState(false);
  const galaxySyncTimerRef = useRef(null);
  const [isGalaxyBooting, setIsGalaxyBooting] = useState(false);
  const galaxyBootTimerRef = useRef(null);
  const isCollapsing = collapsePhase === "collapsing";
  const lastOverRectRef = useRef(null);
  const skipOrchestratorUntilRef = useRef(0);
  const settleTimerRef = useRef(null);
  const captureSnapshot = orchestrator?.captureSnapshot;
  const markLayoutShift = orchestrator?.markLayoutShift;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: HOLD_TO_DRAG_MS, tolerance: 6 },
    })
  );

  const projectIds = useMemo(
    () => displayProjects.map((project) => project.path),
    [displayProjects]
  );
  const activeProject = useMemo(
    () => displayProjects.find((project) => project.path === activeId) || null,
    [activeId, displayProjects]
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
        const targetRect = lastOverRectRef.current;
        const initialLeft = snapshotRect?.left ?? 0;
        const initialTop = snapshotRect?.top ?? 0;

        const toCenteredTransform = (x, y) => {
          if (!width || !height) {
            return CSS.Transform.toString({ x, y, scaleX: 1, scaleY: 1 });
          }
          return `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(1)`;
        };

        const startX = (transform.initial?.x ?? 0) + width / 2;
        const startY = (transform.initial?.y ?? 0) + height / 2;
        const finalX = targetRect
          ? targetRect.left + targetRect.width / 2 - initialLeft
          : (transform.final?.x ?? 0) + width / 2;
        const finalY = targetRect
          ? targetRect.top + targetRect.height / 2 - initialTop
          : (transform.final?.y ?? 0) + height / 2;

        return [
          { transform: toCenteredTransform(startX, startY), offset: 0 },
          { transform: toCenteredTransform(finalX, finalY), offset: landingOffset },
          { transform: toCenteredTransform(finalX, finalY), offset: 1 },
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
      lastOverRectRef.current = null;
      return;
    }
    const overId = String(over.id);
    const initialRect = layoutSnapshotRef.current.get(overId);
    if (!initialRect) {
      setDropIndicator(null);
      lastOverRectRef.current = null;
      return;
    }
    lastOverRectRef.current = initialRect;
    setDropIndicator({
      width: initialRect.width,
      height: initialRect.height,
      x: initialRect.left - gridRectRef.current.left,
      y: initialRect.top - gridRectRef.current.top,
    });
  }, []);

  const handleDragStart = useCallback(
    (event) => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      captureLayoutSnapshot();
      setActiveId(event.active?.id ?? null);
      setOverId(event.over?.id ?? null);
      setIsDragging(true);
      updateDropIndicator(event.over);
    },
    [captureLayoutSnapshot, updateDropIndicator]
  );

  const handleDragOver = useCallback(
    (event) => {
      setOverId(event.over?.id ?? null);
      updateDropIndicator(event.over);
    },
    [updateDropIndicator]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropIndicator(null);
    lastOverRectRef.current = null;
    setIsDragging(false);
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = displayProjects.findIndex((p) => p.path === active.id);
        const newIndex = displayProjects.findIndex((p) => p.path === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(arrayMove(displayProjects, oldIndex, newIndex));
        }
      }
      setOverId(null);
      setDropIndicator(null);
      setIsDragging(false);
      skipOrchestratorUntilRef.current = performance.now() + DROP_ANIMATION_MS + SETTLE_ANIMATION_MS;
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      const settleDuration = DROP_ANIMATION_MS + SETTLE_ANIMATION_MS;
      settleTimerRef.current = setTimeout(() => {
        setActiveId(null);
        lastOverRectRef.current = null;
        settleTimerRef.current = null;
      }, settleDuration);
    },
    [displayProjects, onReorder]
  );

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
    }, SLOT_EXPAND_DELAY_MS);

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

  const handleVanishStart = useCallback(
    (project) => {
      if (!project?.path) return;
      if (vanishingPathsRef.current.has(project.path)) return;

      vanishingPathsRef.current.add(project.path);
      if (captureSnapshot) {
        captureSnapshot();
      }
      createVanishOverlay(project);
      setDisplayProjects((prev) => prev.filter((p) => p.path !== project.path));

      const cleanupKey = `vanish:${project.path}`;
      const cleanupId = setTimeout(() => {
        vanishingPathsRef.current.delete(project.path);
        vanishOverlayTimersRef.current.delete(cleanupKey);
      }, 700);
      vanishOverlayTimersRef.current.set(cleanupKey, cleanupId);
    },
    [captureSnapshot, createVanishOverlay]
  );

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
    if (!markLayoutShift) return;
    if (performance.now() < skipOrchestratorUntilRef.current) return;
    markLayoutShift();
  }, [displayProjects, markLayoutShift]);

  useEffect(() => {
    if (galaxyPulse === undefined) return;
    setIsGalaxySyncing(true);
    if (galaxySyncTimerRef.current) {
      clearTimeout(galaxySyncTimerRef.current);
    }
    galaxySyncTimerRef.current = setTimeout(() => {
      setIsGalaxySyncing(false);
    }, 420);
    return () => {
      if (galaxySyncTimerRef.current) {
        clearTimeout(galaxySyncTimerRef.current);
      }
    };
  }, [galaxyPulse]);

  useEffect(() => {
    if (galaxyBootSignal === undefined) return;
    setIsGalaxyBooting(true);
    if (galaxyBootTimerRef.current) {
      clearTimeout(galaxyBootTimerRef.current);
    }
    galaxyBootTimerRef.current = setTimeout(() => {
      setIsGalaxyBooting(false);
    }, 1400);
    return () => {
      if (galaxyBootTimerRef.current) {
        clearTimeout(galaxyBootTimerRef.current);
      }
    };
  }, [galaxyBootSignal]);

  useEffect(() => {
    return () => {
      vanishOverlayTimersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      vanishOverlayTimersRef.current.clear();
      appearTimersRef.current.forEach(({ start, cleanup }) => {
        clearTimeout(start);
        clearTimeout(cleanup);
      });
      appearTimersRef.current.clear();
      if (galaxySyncTimerRef.current) {
        clearTimeout(galaxySyncTimerRef.current);
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
      if (galaxyBootTimerRef.current) {
        clearTimeout(galaxyBootTimerRef.current);
      }
    };
  }, []);

  const showEmptyPlaceholder =
    displayProjects.length === 0 && vanishOverlays.length === 0 && !showAddCard;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={gridRef}
        className={`relative w-full ${isGalaxySyncing ? "orbit-galaxy-sync" : ""} ${
          isCollapsing ? "orbit-galaxy-collapse" : ""
        }`}
        data-galaxy-id={galaxyId}
      >
        {showEmptyPlaceholder ? (
          <div className="rounded-[var(--radius-lg)] border border-white/5 bg-white/[0.02] px-6 py-12 text-center text-xs uppercase tracking-[0.25em] text-white/30">
            No planets detected in this galaxy.
          </div>
        ) : (
          <SortableContext items={projectIds} strategy={rectSortingStrategy}>
            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(() => {
                let appearIndex = 0;
                return displayProjects.map((project) => {
                  const stage = appearStageByPath[project.path];
                  const shouldAnimate = stage === "animate";
                  const innerClassName = shouldAnimate ? "animate-card-appear" : undefined;
                  const slotClassName = stage ? "animate-slot-expand" : undefined;
                  const staggerDelayMs =
                    shouldAnimate && isGalaxyBooting ? appearIndex++ * GALAXY_BOOT_STAGGER_MS : 0;
                  const innerStyle = stage
                    ? {
                        opacity: 0,
                        ...(shouldAnimate ? { animationDelay: `${staggerDelayMs}ms` } : {}),
                      }
                    : undefined;
                  const isActive = activeId === project.path;
                  const shouldSkipOrchestrator = isCollapsing || isActive;

                  return (
                    <div
                      key={project.path}
                      ref={(node) => {
                        if (node) gridItemRefs.current.set(project.path, node);
                        else gridItemRefs.current.delete(project.path);
                      }}
                      data-orbit-planet={project.path}
                      data-orbit-skip={shouldSkipOrchestrator ? "true" : undefined}
                      data-galaxy-id={galaxyId}
                      style={{ width: "100%" }}
                    >
                      <div className={slotClassName} style={{ width: "100%" }}>
                        <div className={innerClassName} style={innerStyle}>
                          <ProjectCard
                            project={project}
                          isSorting={isDragging}
                          isDropTarget={isDragging && overId === project.path && overId !== activeId}
                            isVanishing={isCollapsing}
                            onVanishStart={handleVanishStart}
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}

              {showAddCard && (
                <div className="animate-card-appear" style={{ opacity: 0 }}>
                  <AddProjectCard onAddProject={onAddProject} />
                </div>
              )}
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
        adjustScale={false}
        className="orbit-overlay"
        style={{
          "--orbit-overlay-scale": String(OVERLAY_SCALE),
          "--orbit-drop-duration": `${DROP_ANIMATION_MS}ms`,
          "--orbit-settle-duration": `${SETTLE_ANIMATION_MS}ms`,
          transformOrigin: "center center",
        }}
      >
        {activeProject ? <ProjectCardPreview project={activeProject} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

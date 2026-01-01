import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { ProjectCard, ProjectCardPreview } from "./ProjectCard";

const HOLD_TO_DRAG_MS = 300;
const OVERLAY_SCALE = 1.05;

export function ProjectGrid({ projects, onReorder }) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const gridRef = useRef(null);
  const layoutSnapshotRef = useRef(new Map());
  const gridRectRef = useRef(null);
  const dragSessionRef = useRef({ startedAt: 0, activeId: null });

  // [Fix] TouchSensor를 제거하고 PointerSensor만 사용하여 센서 충돌 방지
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: HOLD_TO_DRAG_MS, tolerance: 6 },
    })
  );

  const projectIds = useMemo(() => projects.map((project) => project.path), [projects]);
  const activeProject = useMemo(
    () => projects.find((project) => project.path === activeId) || null,
    [activeId, projects]
  );

  const dropAnimation = useMemo(
    () => ({
      duration: 260,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      keyframes({ active, transform }) {
        const activeId = String(active.id);
        const snapshotRect =
          layoutSnapshotRef.current.get(activeId) || active.rect;
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
          { transform: CSS.Transform.toString(transform.initial) },
          { transform: CSS.Transform.toString(correctedFinal) },
        ];
      },
      sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: "0" } },
      }),
    }),
    []
  );

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

  const getCenter = useCallback((rect) => {
    if (!rect) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
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
    dragSessionRef.current = {
      startedAt: performance.now(),
      activeId: event.active?.id ?? null,
    };
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
  }, [onReorder, projects]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div ref={gridRef} className="relative">
        <SortableContext items={projectIds} strategy={rectSortingStrategy}>
          <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.path}
                project={project}
                isSorting={Boolean(activeId)}
                isDropTarget={Boolean(activeId) && overId === project.path && overId !== activeId}
              />
            ))}
          </main>
        </SortableContext>
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
      <DragOverlay dropAnimation={dropAnimation} adjustScale={true}>
        {activeProject ? <ProjectCardPreview project={activeProject} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

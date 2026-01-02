import { useCallback, useLayoutEffect, useRef, useState } from "react";

const FLIP_DURATION_MS = 520;
const FLIP_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const toScrollSpaceRect = (container, node, containerRect, scrollLeft, scrollTop) => {
  const rect = node.getBoundingClientRect();
  return {
    left: rect.left - containerRect.left + scrollLeft,
    top: rect.top - containerRect.top + scrollTop,
    width: rect.width,
    height: rect.height,
  };
};

const collectRects = (container) => {
  const snapshot = new Map();
  if (!container) return snapshot;
  const containerRect = container.getBoundingClientRect();
  const scrollLeft = container.scrollLeft || 0;
  const scrollTop = container.scrollTop || 0;
  container.querySelectorAll("[data-orbit-planet]").forEach((node) => {
    if (node.dataset.orbitSkip === "true") return;
    const id = node.dataset.orbitPlanet;
    if (!id) return;
    snapshot.set(id, toScrollSpaceRect(container, node, containerRect, scrollLeft, scrollTop));
  });
  return snapshot;
};

export function useUniverseOrchestrator() {
  const universeRef = useRef(null);
  const snapshotRef = useRef(null);
  const previousRectsRef = useRef(new Map());
  const [layoutTick, setLayoutTick] = useState(0);
  const [galaxySignals, setGalaxySignals] = useState({});

  const captureSnapshot = useCallback(() => {
    snapshotRef.current = collectRects(universeRef.current);
  }, []);

  const markLayoutShift = useCallback(() => {
    setLayoutTick((tick) => tick + 1);
  }, []);

  const notifyGalaxyToggle = useCallback((galaxyId) => {
    setGalaxySignals((prev) => ({
      ...prev,
      [galaxyId]: (prev[galaxyId] || 0) + 1,
    }));
    setLayoutTick((tick) => tick + 1);
  }, []);

  useLayoutEffect(() => {
    const container = universeRef.current;
    if (!container) return;

    const nextEntries = new Map();
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const scrollTop = container.scrollTop || 0;
    container.querySelectorAll("[data-orbit-planet]").forEach((node) => {
      if (node.dataset.orbitSkip === "true") return;
      const id = node.dataset.orbitPlanet;
      if (!id) return;
      nextEntries.set(id, {
        rect: toScrollSpaceRect(container, node, containerRect, scrollLeft, scrollTop),
        node,
      });
    });

    const sourceRects =
      snapshotRef.current && snapshotRef.current.size > 0
        ? snapshotRef.current
        : previousRectsRef.current;

    snapshotRef.current = null;

    if (sourceRects && sourceRects.size > 0) {
      nextEntries.forEach(({ rect, node }, id) => {
        const prevRect = sourceRects.get(id);
        if (!prevRect) return;

        const dx = prevRect.left - rect.left;
        const dy = prevRect.top - rect.top;
        if (dx === 0 && dy === 0) return;

        node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        node.style.transition = "transform 0s";
        node.style.willChange = "transform";

        requestAnimationFrame(() => {
          node.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`;
          node.style.transform = "translate3d(0, 0, 0)";
        });
      });
    }

    const nextRectsOnly = new Map();
    nextEntries.forEach(({ rect }, id) => {
      nextRectsOnly.set(id, rect);
    });
    previousRectsRef.current = nextRectsOnly;
  }, [layoutTick]);

  return {
    universeRef,
    captureSnapshot,
    markLayoutShift,
    notifyGalaxyToggle,
    galaxySignals,
  };
}

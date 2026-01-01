import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { loadOrbitSettings, saveOrbitSettings } from "./orbitStore";

export function useOrbitData() {
  const [projects, setProjects] = useState([]);
  const [paths, setPaths] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [projectOrder, setProjectOrder] = useState([]);
  const [preferredIdes, setPreferredIdes] = useState({});
  const scanSequence = useRef(0);
  const projectOrderRef = useRef([]);

  useEffect(() => {
    projectOrderRef.current = projectOrder;
  }, [projectOrder]);

  const scanProjects = useCallback(async (currentPaths, currentExcluded, currentOrder) => {
    const sequence = ++scanSequence.current;
    const activePaths = currentPaths.filter((p) => p.enabled).map((p) => p.path);

    if (activePaths.length === 0) {
      setProjects([]);
      return;
    }

    const results = await Promise.allSettled(
      activePaths.map((basePath) => invoke("get_projects", { basePath }))
    );

    let allProjects = [];
    results.forEach((result, index) => {
      const basePath = activePaths[index];
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        allProjects = allProjects.concat(result.value);
        return;
      }
      if (result.status === "rejected") {
        console.error(`${basePath} scan failed:`, result.reason);
      }
    });

    const uniqueProjectsMap = new Map();
    const excludedSet = new Set(currentExcluded);
    allProjects.forEach((project) => {
      if (!excludedSet.has(project.path)) {
        uniqueProjectsMap.set(project.path, project);
      }
    });

    const filteredProjects = Array.from(uniqueProjectsMap.values());
    const orderIndex = new Map(currentOrder.map((path, index) => [path, index]));

    const sortedProjects = [...filteredProjects].sort((a, b) => {
      const indexA = orderIndex.get(a.path);
      const indexB = orderIndex.get(b.path);

      if (indexA === undefined && indexB === undefined) return 0;
      if (indexA === undefined) return 1;
      if (indexB === undefined) return -1;
      return indexA - indexB;
    });

    if (sequence !== scanSequence.current) {
      return;
    }

    setProjects(sortedProjects);

    const missingInOrder = sortedProjects
      .map((project) => project.path)
      .filter((path) => !orderIndex.has(path));

    if (missingInOrder.length > 0) {
      const nextOrder = currentOrder.concat(missingInOrder);
      projectOrderRef.current = nextOrder;
      setProjectOrder(nextOrder);
      void saveOrbitSettings({ projectOrder: nextOrder });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      const saved = await loadOrbitSettings();
      if (!isMounted) return;

      setPaths(saved.paths);
      setExcluded(saved.excluded);
      setProjectOrder(saved.projectOrder);
      projectOrderRef.current = saved.projectOrder;
      setPreferredIdes(saved.preferredIdes);

      if (saved.paths.length > 0) {
        scanProjects(saved.paths, saved.excluded, saved.projectOrder);
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [scanProjects]);

  const persistPaths = useCallback(
    async (nextPaths, nextExcluded) => {
      setPaths(nextPaths);
      setExcluded(nextExcluded);
      await saveOrbitSettings({ paths: nextPaths, excluded: nextExcluded });
      void scanProjects(nextPaths, nextExcluded, projectOrderRef.current);
    },
    [scanProjects]
  );

  const reorderProjects = useCallback(async (nextProjects) => {
    const nextOrder = nextProjects.map((project) => project.path);
    setProjects(nextProjects);
    setProjectOrder(nextOrder);
    projectOrderRef.current = nextOrder;
    await saveOrbitSettings({ projectOrder: nextOrder });
  }, []);

  const setProjectIde = useCallback((projectPath, ideId) => {
    setPreferredIdes((prev) => {
      const updated = { ...prev, [projectPath]: ideId };
      void saveOrbitSettings({ preferredIdes: updated });
      return updated;
    });
  }, []);

  const addPaths = useCallback(
    (newPathsArray) => {
      const updatedPaths = [...paths];
      newPathsArray.forEach((pathValue) => {
        if (!updatedPaths.find((entry) => entry.path === pathValue)) {
          updatedPaths.push({ path: pathValue, enabled: true });
        }
      });
      void persistPaths(updatedPaths, excluded);
    },
    [excluded, paths, persistPaths]
  );

  const togglePath = useCallback(
    (index) => {
      const updated = [...paths];
      if (!updated[index]) {
        return;
      }
      updated[index] = { ...updated[index], enabled: !updated[index].enabled };
      void persistPaths(updated, excluded);
    },
    [excluded, paths, persistPaths]
  );

  const deletePath = useCallback(
    (pathStr) => {
      const updated = paths.filter((p) => p.path !== pathStr);
      void persistPaths(updated, excluded);
    },
    [excluded, paths, persistPaths]
  );

  const excludeProject = useCallback(
    (projectPath) => {
      const updatedExcluded = [...new Set([...excluded, projectPath])];
      void persistPaths(paths, updatedExcluded);
    },
    [excluded, paths, persistPaths]
  );

  const restoreExcluded = useCallback(() => {
    void persistPaths(paths, []);
  }, [paths, persistPaths]);

  return { 
    projects, 
    paths, 
    excluded, 
    preferredIdes,
    setProjectIde,
    reorderProjects,
    addPaths, 
    togglePath, 
    deletePath, 
    excludeProject,
    restoreExcluded
  };
}

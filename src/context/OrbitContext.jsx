import { createContext, useContext, useMemo } from "react";
import { useOrbitData } from "../hooks/useOrbitData";

const OrbitContext = createContext(null);

export function OrbitProvider({ children }) {
  const {
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
    restoreExcluded,
  } = useOrbitData();

  const value = useMemo(
    () => ({
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
      restoreExcluded,
    }),
    [
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
      restoreExcluded,
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

export function useOrbitContext() {
  const context = useContext(OrbitContext);
  if (!context) {
    throw new Error("useOrbitContext must be used within OrbitProvider");
  }
  return context;
}

import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useOrbitContext } from "../../domain/orbit/OrbitContext";
import { StarBackground } from "../../ui/StarBackground";
import { ProjectGrid } from "./components/ProjectGrid";

export function OrbitDashboard() {
  const { 
    projects, 
    paths, 
    excluded,
    reorderProjects,
    addPaths, 
    togglePath, 
    deletePath, 
    restoreExcluded
  } = useOrbitContext();
  
  // 경로 추가 핸들러
  const handleAddFolders = useCallback(async () => {
    try {
      const selected = await open({ 
        multiple: true, 
        directory: true, 
        title: "Orbit 궤도 추가: 프로젝트 폴더 선택" 
      });

      if (!selected) return;
      const newPathsArray = Array.isArray(selected) ? selected : [selected];
      addPaths(newPathsArray);
      
      console.debug("[orbit] New paths added to orbit:", newPathsArray);
    } catch (error) {
      console.error("[orbit] Failed to add folders:", error);
    }
  }, [addPaths]);

  const handleManualIgnition = useCallback(async () => {
    try {
      const selected = await open({ 
        multiple: false, 
        directory: true, 
        title: "Orbit manual ignition: select project folder" 
      });

      if (!selected) return;
      const newPathsArray = Array.isArray(selected) ? selected : [selected];
      addPaths(newPathsArray);
      
      console.debug("[orbit] Manual project ignition:", newPathsArray);
    } catch (error) {
      console.error("[orbit] Failed to add project:", error);
    }
  }, [addPaths]);

  return (
    <div className="stars-container min-h-screen p-10 font-sans selection:bg-indigo-500/30">
      <StarBackground />
      
      <div className="relative z-10">
        <header className="max-w-6xl mx-auto mb-12">
          <div className="flex justify-between items-end mb-10">
            <div style={{ color: "var(--text-main)" }}>
              <h1 className="text-5xl font-extralight tracking-[0.2em] uppercase">Orbit</h1>
              <p className="mt-3 font-light" style={{ color: "var(--text-muted)" }}>관제 센터: 활성화된 궤도의 프로젝트를 감시합니다.</p>
            </div>
            
            <button 
              onClick={handleAddFolders}
              className="relative group px-8 py-3 text-[11px] font-medium tracking-[0.2em] uppercase transition-all duration-500 active:scale-95 overflow-hidden backdrop-blur-md"
              style={{ 
                color: "var(--text-main)",
                borderRadius: "0",
                background: "linear-gradient(to right, transparent, var(--surface-glass) 25%, var(--surface-glass) 75%, transparent)"
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                   style={{ background: "radial-gradient(circle at center, rgba(255,255,255,0.05), transparent)" }} />
              
              <div
                className="absolute inset-y-0 -left-4 -right-4 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 opacity-70"
                style={{
                  background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.03) 65%, rgba(255,255,255,0) 100%)"
                }}
              />
              <span className="relative z-10 flex items-baseline gap-2">
                <span>+ Expand Radar Fields</span>
              </span>
            </button>
          </div>
          {/* ??? 경로 관리 섹션 */}
          <div className="flex flex-wrap gap-3 py-6 border-y" style={{ borderColor: "var(--surface-border)" }}>
            {paths.length > 0 ? (
              <>
                <span
                  className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.35em] border"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-faint)" }}
                >
                  Active Radar Zones
                </span>
                {paths.map((p, i) => (
                  <div 
                    key={p.path} 
                    className="group flex items-center gap-4 px-4 py-1.5 border transition-all duration-500 backdrop-blur-md"
                    style={{
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: p.enabled ? "rgba(79, 70, 229, 0.04)" : "var(--surface-glass)",
                      borderColor: p.enabled ? "rgba(99, 102, 241, 0.35)" : "var(--surface-border)",
                      color: p.enabled ? "var(--text-main)" : "var(--text-faint)",
                    }}
                  >
                    <div 
                      onClick={() => togglePath(i)}
                      className="w-7 h-3.5 rounded-full relative transition-all duration-500 cursor-pointer opacity-70 group-hover:opacity-90"
                      style={{ backgroundColor: p.enabled ? "rgba(99, 102, 241, 0.7)" : "rgba(255, 255, 255, 0.08)" }}
                    >
                      <div className={`absolute top-1/2 left-0.5 w-2 h-2 rounded-full bg-white/90 transition-all duration-500 -translate-y-1/2 ${
                        p.enabled ? 'translate-x-3' : 'translate-x-0'
                      }`} />
                    </div>
                    <span className="text-[10px] font-mono tracking-tight opacity-60 group-hover:opacity-85">{p.path}</span>
                    <button onClick={() => deletePath(p.path)} className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full transition-all text-red-300 hover:text-red-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-xs italic font-light tracking-widest" style={{ color: "var(--text-faint)" }}>등록된 궤도가 없습니다.</p>
            )}
          </div>
        </header>

        {/* ?? 프로젝트 그리드 (DnD Context 적용) */}
        <ProjectGrid 
          projects={projects} 
          onReorder={reorderProjects} 
          onAddProject={handleManualIgnition} // Manual ignition picker for specific projects
        />
        
        {/* 제외된 항목 복구 푸터 */}
        {excluded.length > 0 && (
          <footer className="max-w-6xl mx-auto mt-10 text-[10px] text-right uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>
            Hidden Objects: {excluded.length} ? 
            <button 
              onClick={restoreExcluded} 
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

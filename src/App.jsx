import { useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { useOrbitContext } from "./context/OrbitContext";
import { ProjectCard } from "./components/ProjectCard";
import { StarBackground } from "./components/StarBackground";

// DnD Kit 관련 임포트
import { 
  DndContext, 
  closestCenter, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from "@dnd-kit/core";
import { 
  SortableContext, 
  rectSortingStrategy, 
  arrayMove 
} from "@dnd-kit/sortable";

function App() {
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

  // 1. DnD 센서 설정: 8px 이상 움직여야 드래그로 간주 (단순 클릭과 구분)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, 
    })
  );

  const projectIds = useMemo(() => projects.map((p) => p.path), [projects]);

  // 2. 드래그 종료 시 순서 변경 처리
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.path === active.id);
      const newIndex = projects.findIndex((p) => p.path === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      
      // 이동된 결과 배열을 생성하여 reorderProjects에 전달
      const newOrderArray = arrayMove(projects, oldIndex, newIndex);
      reorderProjects(newOrderArray);
    }
  }, [projects, reorderProjects]);

  // 궤도 경로 추가 핸들러
  const handleAddFolders = useCallback(async () => {
    const selected = await open({ multiple: true, directory: true, title: "Orbit 궤도 추가" });
    if (!selected) return;
    const newPathsArray = Array.isArray(selected) ? selected : [selected];
    addPaths(newPathsArray);
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
                <span>+ Add Orbit Paths</span>
              </span>
            </button>
          </div>

          {/* 🛰️ 경로 관리 섹션 */}
          <div className="flex flex-wrap gap-3 py-6 border-y" style={{ borderColor: "var(--surface-border)" }}>
            {paths.length > 0 ? (
              paths.map((p, i) => (
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
              ))
            ) : (
              <p className="text-xs italic font-light tracking-widest" style={{ color: "var(--text-faint)" }}>등록된 궤도가 없습니다.</p>
            )}
          </div>
        </header>

        {/* 🚀 프로젝트 그리드 (DnD Context 적용) */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projectIds} strategy={rectSortingStrategy}>
            <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.length > 0 ? (
                projects.map((p) => (
                  <ProjectCard 
                    key={p.path} 
                    project={p} 
                  />
                ))
              ) : (
                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[40px]" style={{ borderColor: "var(--surface-border)" }}>
                  <p className="font-light italic" style={{ color: "var(--text-faint)" }}>
                    {paths.some(p => p.enabled) ? "활성화된 궤도에 프로젝트가 없습니다." : "모든 궤도가 비활성화 상태입니다."}
                  </p>
                </div>
              )}
            </main>
          </SortableContext>
        </DndContext>
        
        {/* 제외된 항목 복구 푸터 */}
        {excluded.length > 0 && (
          <footer className="max-w-6xl mx-auto mt-10 text-[10px] text-right uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>
            Hidden Objects: {excluded.length} — 
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

export default App;

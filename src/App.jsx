import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { LazyStore } from "@tauri-apps/plugin-store";
import "./App.css";

const store = new LazyStore("settings.json");

// --- 프로젝트 카드 컴포넌트 ---
function ProjectCard({ project, onExclude }) {
  const handleOpen = () => {
    invoke("open_in_vscode", { path: project.path })
      .catch((err) => alert("VS Code를 실행할 수 없습니다: " + err));
  };

  return (
    <div 
      onClick={handleOpen}
      className="group relative bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all duration-500 cursor-pointer shadow-2xl"
    >
      {/* 개별 제외 버튼 (호버 시에만 선명하게 등장) */}
      <button 
        onClick={(e) => {
          e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
          onExclude(project.path);
        }}
        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/0 hover:bg-red-500/20 text-white/0 group-hover:text-red-400 transition-all duration-300"
        title="목록에서 제외"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
          <div className="w-4 h-4 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(129,140,248,0.8)]"></div>
        </div>
      </div>
      
      <h3 className="text-xl font-light text-white/90 mb-1 tracking-tight group-hover:text-indigo-300 transition-colors">
        {project.name}
      </h3>
      <p className="text-[10px] text-white/20 font-mono truncate group-hover:text-white/40 transition-colors">
        {project.path}
      </p>
      
      <div className="mt-6 flex items-center text-[10px] text-indigo-400/0 group-hover:text-indigo-400/100 transition-all duration-500 uppercase tracking-widest font-bold">
        <span>Launch Orbit →</span>
      </div>
    </div>
  );
}

// --- 메인 앱 컴포넌트 ---
function App() {
  const [projects, setProjects] = useState([]);
  const [paths, setPaths] = useState([]); // [{ path: string, enabled: boolean }]
  const [excluded, setExcluded] = useState([]); // [string, string, ...] (개별 제외 경로)

  // 초기 로드
  useEffect(() => {
    const loadSettings = async () => {
      const savedPaths = await store.get("orbitPaths") || [];
      const savedExcluded = await store.get("excludedPaths") || [];
      setPaths(savedPaths);
      setExcluded(savedExcluded);
      if (savedPaths.length > 0) scanProjects(savedPaths, savedExcluded);
    };
    loadSettings();
  }, []);

  // 공통 저장 및 스캔 함수
  const updateAndRefresh = async (newPaths, newExcluded) => {
    await store.set("orbitPaths", newPaths);
    await store.set("excludedPaths", newExcluded);
    await store.save();
    scanProjects(newPaths, newExcluded);
  };

  const scanProjects = async (currentPaths, currentExcluded) => {
    let allProjects = [];
    const activePaths = currentPaths.filter(p => p.enabled).map(p => p.path);

    for (const basePath of activePaths) {
      try {
        const res = await invoke("get_projects", { basePath });
        allProjects = [...allProjects, ...res];
      } catch (err) {
        console.error(`${basePath} 스캔 실패:`, err);
      }
    }

    // 중복 제거 및 '제외 리스트' 필터링
    const filtered = allProjects
      .filter((v, i, a) => a.findIndex(t => t.path === v.path) === i)
      .filter(p => !currentExcluded.includes(p.path));

    setProjects(filtered);
  };

  // 경로 추가
  const handleAddFolders = async () => {
    const selected = await open({ multiple: true, directory: true, title: "Orbit 궤도 추가" });
    if (!selected) return;

    const newPathsArray = Array.isArray(selected) ? selected : [selected];
    const updatedPaths = [...paths];

    newPathsArray.forEach(p => {
      if (!updatedPaths.find(x => x.path === p)) {
        updatedPaths.push({ path: p, enabled: true });
      }
    });

    setPaths(updatedPaths);
    updateAndRefresh(updatedPaths, excluded);
  };

  // 경로 토글 (체크 해제/설정)
  const togglePath = (index) => {
    const updated = [...paths];
    updated[index].enabled = !updated[index].enabled;
    setPaths(updated);
    updateAndRefresh(updated, excluded);
  };

  // 경로 삭제
  const deletePath = (pathStr) => {
    const updated = paths.filter(p => p.path !== pathStr);
    setPaths(updated);
    updateAndRefresh(updated, excluded);
  };

  // 개별 프로젝트 제외
  const excludeProject = (projectPath) => {
    const updatedExcluded = [...new Set([...excluded, projectPath])];
    setExcluded(updatedExcluded);
    updateAndRefresh(paths, updatedExcluded);
  };

  return (
    <div className="stars-container min-h-screen p-10 font-sans selection:bg-indigo-500/30">
      <div className="stars-layer stars-layer-1" aria-hidden="true">
        <div className="stars-track">
          <div className="stars-drift">
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
          </div>
        </div>
      </div>
      <div className="stars-layer stars-layer-2" aria-hidden="true">
        <div className="stars-track">
          <div className="stars-drift">
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
          </div>
        </div>
      </div>
      <div className="stars-layer stars-layer-3" aria-hidden="true">
        <div className="stars-track">
          <div className="stars-drift">
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
          </div>
        </div>
      </div>
      <div className="stars-layer stars-layer-4" aria-hidden="true">
        <div className="stars-track">
          <div className="stars-drift">
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
            <div className="stars-tile" />
          </div>
        </div>
      </div>
      <div className="relative z-10">
        <header className="max-w-6xl mx-auto mb-12">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h1 className="text-5xl font-extralight tracking-[0.2em] text-white/90 uppercase">Orbit</h1>
              <p className="text-slate-500 mt-3 font-light">관제 센터: 활성화된 궤도의 프로젝트를 감시합니다.</p>
            </div>
            <button 
              onClick={handleAddFolders}
              className="relative group px-8 py-3 bg-indigo-600 rounded-2xl text-white text-sm font-bold tracking-wider transition-all duration-300 hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-95 overflow-hidden"
            >
              {/* 버튼 내부 반짝이는 광선 효과 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative">+ Add Orbit Paths</span>
            </button>
          </div>

        {/* 🛰️ 경로 관리 섹션 (업그레이드된 디자인) */}
          <div className="flex flex-wrap gap-3 py-6 border-y border-white/5">
            {paths.length > 0 ? (
              paths.map((p, i) => (
                <div 
                  key={p.path} 
                  // 전체 칩: enabled 상태에 따라 테두리와 배경색이 유기적으로 변함
                  className={`group flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-500 ${
                    p.enabled 
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                      : 'bg-white/2 border-white/5 text-white/20'
                  }`}
                >
                  {/* 1. 커스텀 스위치 (기존 input type="checkbox" 삭제 후 대체) */}
                  <div 
                    onClick={() => togglePath(i)}
                    className={`w-9 h-5 rounded-full relative transition-all duration-500 cursor-pointer p-1 ${
                      p.enabled ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-500 transform ${
                      p.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>

                  {/* 2. 경로 텍스트 */}
                  <span className="text-[11px] font-mono tracking-tight opacity-80">{p.path}</span>

                  {/* 3. 삭제 버튼 (세련된 원형 아이콘) */}
                  <button 
                    onClick={() => deletePath(p.path)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-lg"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-white/10 italic font-light tracking-widest">등록된 궤도가 없습니다.</p>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length > 0 ? (
            projects.map((p) => (
              <ProjectCard key={p.path} project={p} onExclude={excludeProject} />
            ))
          ) : (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
              <p className="text-white/20 font-light italic">
                {paths.some(p => p.enabled) ? "활성화된 궤도에 프로젝트가 없습니다." : "모든 궤도가 비활성화 상태입니다."}
              </p>
            </div>
          )}
        </main>
        
        {/* 하단에 제외된 항목 개수 표시 (복구 기능의 힌트) */}
        {excluded.length > 0 && (
          <footer className="max-w-6xl mx-auto mt-10 text-[10px] text-white/10 text-right uppercase tracking-[0.2em]">
            Hidden Objects: {excluded.length} — <button onClick={() => {setExcluded([]); updateAndRefresh(paths, []);}} className="hover:text-indigo-400">Restore All</button>
          </footer>
        )}
      </div>
    </div>
  );
}

export default App;

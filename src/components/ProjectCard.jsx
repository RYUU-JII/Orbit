import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOrbitContext } from "../context/OrbitContext";

// --- 1. 프로젝트 성격별 심볼릭 아이콘 ---
const Icons = {
  Extension: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  Desktop: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
  ),
  Web: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
  ),
  Mobile: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
  ),
  Game: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/></svg>
  ),
  Server: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
  ),
  Library: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/><path d="M4 20h16"/></svg>
  )
};

// --- 2. 프로젝트 타입별 테마 설정 (dotBg 추가 및 hoverColor 명시) ---
const TYPE_META = {
  extension: { label: "Extension", icon: Icons.Extension, color: "text-purple-400", hoverColor: "hover:text-purple-400", dotBg: "bg-purple-400", bg: "from-purple-500/10 to-blue-500/5", border: "group-hover:border-purple-500/30" },
  desktop: { label: "Desktop App", icon: Icons.Desktop, color: "text-emerald-400", hoverColor: "hover:text-emerald-400", dotBg: "bg-emerald-400", bg: "from-emerald-500/10 to-teal-500/5", border: "group-hover:border-emerald-500/30" },
  web: { label: "Web App", icon: Icons.Web, color: "text-blue-400", hoverColor: "hover:text-blue-400", dotBg: "bg-blue-400", bg: "from-blue-500/10 to-cyan-500/5", border: "group-hover:border-blue-500/30" },
  mobile: { label: "Mobile App", icon: Icons.Mobile, color: "text-orange-400", hoverColor: "hover:text-orange-400", dotBg: "bg-orange-400", bg: "from-orange-500/10 to-red-500/5", border: "group-hover:border-orange-500/30" },
  game: { label: "Game", icon: Icons.Game, color: "text-pink-400", hoverColor: "hover:text-pink-400", dotBg: "bg-pink-400", bg: "from-pink-500/10 to-rose-500/5", border: "group-hover:border-pink-500/30" },
  server: { label: "Backend", icon: Icons.Server, color: "text-slate-400", hoverColor: "hover:text-slate-400", dotBg: "bg-slate-400", bg: "from-slate-500/10 to-gray-500/5", border: "group-hover:border-slate-500/30" },
  library: { label: "Library", icon: Icons.Library, color: "text-amber-400", hoverColor: "hover:text-amber-400", dotBg: "bg-amber-400", bg: "from-amber-500/10 to-orange-500/5", border: "group-hover:border-amber-500/30" },
  unknown: { label: "Project", icon: Icons.Web, color: "text-gray-400", hoverColor: "hover:text-white", dotBg: "bg-gray-400", bg: "from-gray-500/5 to-gray-500/5", border: "group-hover:border-gray-500/30" },
};

// --- 3. 기술 스택 메타데이터 ---
const ICON_META = {
  ide: {
    vscode: { label: "VS Code", slug: "visualstudiocode", devicon: "vscode" },
    cursor: { label: "Cursor", slug: "cursor", devicon: "vscode" },
    intellijidea: { label: "IntelliJ IDEA", devicon: "intellij" },
    webstorm: { label: "WebStorm", devicon: "webstorm" },
    pycharm: { label: "PyCharm", devicon: "pycharm" },
    visualstudio: { label: "Visual Studio", devicon: "visualstudio" },
    eclipse: { label: "Eclipse", devicon: "eclipse" },
    jupyter: { label: "Jupyter", devicon: "jupyter" },
  },
  tech: {
    node: { label: "Node.js", slug: "nodedotjs", devicon: "nodejs" },
    javascript: { label: "JavaScript" },
    typescript: { label: "TypeScript" },
    react: { label: "React" },
    nextjs: { label: "Next.js", slug: "nextdotjs", devicon: "nextjs" },
    vue: { label: "Vue.js", slug: "vuedotjs", devicon: "vuejs" },
    vite: { label: "Vite", devicon: "vitejs" },
    tauri: { label: "Tauri" },
    rust: { label: "Rust" },
    python: { label: "Python" },
    go: { label: "Go" },
    dotnet: { label: ".NET", slug: "dotnet", devicon: "dotnetcore" },
    csharp: { label: "C#", slug: "csharp", devicon: "csharp" },
    unity: { label: "Unity", devicon: "unity" },
  },
};

// --- 4. 헬퍼 함수 ---
const formatTechName = (name) => String(name).toLowerCase().trim().replace(/\+/g, "plus").replace(/\./g, "dot").replace(/ /g, "");

const resolveDeviconSlug = (iconSlug, devicon) => {
  if (devicon) return devicon;
  if (!iconSlug) return "";
  if (iconSlug.endsWith("dotjs")) return iconSlug.replace("dotjs", "js");
  const mapping = { visualstudiocode: "vscode", vite: "vitejs" };
  return mapping[iconSlug] || iconSlug;
};

const resolveJetBrainsIde = (techIds = []) => {
  const techSet = new Set(techIds.map(t => String(t).toLowerCase()));
  if (["dotnet", "csharp", "unity"].some(t => techSet.has(t))) return "rider";
  if (["cpp", "c", "rust"].some(t => techSet.has(t))) return "clion";
  if (techSet.has("python") || techSet.has("jupyter")) return "pycharm";
  if (techSet.has("go")) return "goland";
  return "webstorm";
};

// --- 5. 아이콘 컴포넌트 ---
const SimpleIcon = ({ label, slug, devicon, size = "h-5 w-5" }) => {
  const iconSlug = slug || formatTechName(label);
  const deviconSlug = resolveDeviconSlug(iconSlug, devicon);
  const deviconSrc = `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${deviconSlug}/${deviconSlug}-original.svg`;
  const simpleSrc = `https://cdn.simpleicons.org/${iconSlug}`;

  return (
    <div className="relative group/icon">
      <img
        src={deviconSrc}
        alt={label}
        className={`${size} object-contain transition-transform group-hover/icon:scale-110`}
        onError={(e) => {
          if (!e.currentTarget.dataset.triedSimple) {
            e.currentTarget.dataset.triedSimple = "true";
            e.currentTarget.src = simpleSrc;
          }
        }}
      />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover/icon:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap">
        {label}
      </div>
    </div>
  );
};

// --- 6. 메인 컴포넌트 (Orbit Project Card) ---
export function ProjectCard({ project }) {
  const [showMenu, setShowMenu] = useState(false);
  const { excludeProject, preferredIdes, setProjectIde } = useOrbitContext();

  // 사용할 IDE 결정
  const autoDetectedIde = project.ides?.includes("jetbrains") 
    ? resolveJetBrainsIde(project.techs) 
    : (project.ides?.[0] || "vscode");
  
  const preferredIde = preferredIdes[project.path];
  const activeIdeId = preferredIde || autoDetectedIde;
  const typeMeta = TYPE_META[project.project_type] || TYPE_META.unknown;
  const TypeIcon = typeMeta.icon;

  const handleOpenProject = (e) => {
    e.stopPropagation();
    invoke("open_project", { path: project.path, ideId: activeIdeId, targetFile: null });
  };

  const handleOpenFile = (e) => {
    e.stopPropagation();
    if (!project.last_modified_file) return;
    invoke("open_project", { path: project.path, ideId: activeIdeId, targetFile: project.last_modified_file });
  };

  // DnD 관련 훅 설정
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.path, // 고유 ID로 경로 사용
  });

  const dndTransform = transform
    ? { ...transform, scaleX: isDragging ? 1.02 : 1, scaleY: isDragging ? 1.02 : 1 }
    : null;

  const dndStyle = {
    transform: CSS.Transform.toString(dndTransform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div
      ref={setNodeRef} // DnD 참조 추가
      style={{
        ...dndStyle, // 드래그 애니메이션 스타일 적용
        backgroundColor: "var(--surface-glass)",
        borderColor: "var(--surface-border)",
        borderRadius: "var(--radius-lg)",
      }}
      onClick={handleOpenProject}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      className={`group relative backdrop-blur-xl border transition-all duration-500 cursor-pointer shadow-lg hover:shadow-2xl overflow-hidden ${typeMeta.border} hover:-translate-y-1`}
    >
      {/* 배경 시각 효과 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${typeMeta.bg} opacity-40 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.1] transition-all duration-700 transform rotate-[-15deg] group-hover:rotate-0 group-hover:scale-110">
        <TypeIcon size={140} />
      </div>

      <button
        type="button"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-all cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="18" r="2" />
          <circle cx="15" cy="18" r="2" />
        </svg>
      </button>

      {/* 액션: 제외 버튼 */}
      <button onClick={(e) => { e.stopPropagation(); excludeProject(project.path); }} className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      {/* 우클릭 IDE 선택 메뉴 */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)} />
          <div className="absolute top-12 right-4 z-[70] bg-[#121214]/95 border border-white/10 rounded-xl shadow-2xl py-2 min-w-[180px] backdrop-blur-2xl">
            {Object.entries(ICON_META.ide).map(([id, meta]) => (
              <button key={id} onClick={(e) => { e.stopPropagation(); setProjectIde(project.path, id); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${activeIdeId === id ? 'text-blue-400 bg-blue-500/5' : 'text-white/60'}`}>
                <SimpleIcon label={meta.label} slug={meta.slug} devicon={meta.devicon} size="h-4 w-4" />
                <span className="text-sm font-medium">{meta.label}</span>
                {activeIdeId === id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="relative z-10 p-6 flex flex-col h-full">
        {/* 상단: 프로젝트 정보 배지 */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${typeMeta.color} group-hover:scale-110 transition-transform`}>
            <TypeIcon size={20} />
          </div>
          <span className={`text-[10px] uppercase tracking-widest font-black ${typeMeta.color}`}>{typeMeta.label}</span>
        </div>

        {/* 중단: 이름 및 경로 (세련된 하이라이트 배경 적용) */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white/90 truncate group-hover:text-white transition-colors tracking-tight leading-tight">{project.name}</h3>
          <p 
            onClick={(e) => { e.stopPropagation(); invoke("open_in_explorer", { path: project.path }); }} 
            className={`inline-block text-[10px] font-mono text-white/20 truncate mt-1.5 cursor-pointer transition-all duration-300 uppercase tracking-wider
                       px-1.5 py-0.5 -ml-1.5 rounded-md hover:bg-white/5 ${typeMeta.hoverColor}`}
          >
            {project.path}
          </p>
        </div>

        {/* 하단: 시각적 도구 세트 */}
        <div className="flex items-center gap-4 mt-auto mb-5">
          <SimpleIcon label={ICON_META.ide[activeIdeId]?.label || activeIdeId} slug={ICON_META.ide[activeIdeId]?.slug} devicon={ICON_META.ide[activeIdeId]?.devicon} size="h-7 w-7" />
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
            {project.techs?.slice(0, 6).map(id => (
              <SimpleIcon key={id} label={ICON_META.tech[id]?.label || id} slug={ICON_META.tech[id]?.slug} devicon={ICON_META.tech[id]?.devicon} size="h-5 w-5" />
            ))}
          </div>
        </div>

        {/* 푸터: Context-Aware 액션 영역 */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          <div 
            onClick={handleOpenFile} 
            className={`flex items-center gap-2.5 text-[10px] font-mono italic cursor-pointer transition-all duration-300
                       px-1.5 py-1 -ml-1.5 rounded-md hover:bg-white/5
                       ${project.last_modified_file ? `text-white/30 ${typeMeta.hoverColor}` : 'text-white/20'}`}
          >
            {/* 테마 점: flex-shrink-0으로 찌그러짐 방지 및 정렬 */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${project.last_modified_file ? typeMeta.dotBg : 'bg-gray-700'}`} />
            <span className="truncate max-w-[160px] leading-none">
              {project.last_modified_file ? project.last_modified_file.split(/[/\\]/).pop() : 'No recent edits'}
            </span>
          </div>
          
          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${typeMeta.color} opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0`}>
             Launch <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AddProjectCard({ onAddProject }) {
  return (
    <div
      onClick={onAddProject}
      className="group relative h-full min-h-[220px] rounded-[var(--radius-lg)] border-2 border-dashed border-white/5 hover:border-indigo-500/40 bg-white/[0.02] hover:bg-indigo-500/[0.04] transition-all cursor-pointer flex flex-col items-center justify-center"
    >
      <div className="w-12 h-12 mb-4 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/20 group-hover:text-indigo-400"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
        </svg>
      </div>
      <span className="text-xs font-black uppercase tracking-[0.2em] text-white/20 group-hover:text-indigo-400">
        Manual Ignition
      </span>
    </div>
  );
}

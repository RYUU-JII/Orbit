import { useState } from "react";

export function EmptyState({ onAddProject }) {
  const [isCoreHovered, setIsCoreHovered] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-1000">
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32 mb-12 flex items-center justify-center">
          <div
            className={`absolute inset-[-40px] rounded-full transition-all duration-1000 ease-out
              bg-[radial-gradient(circle,_rgba(247,231,206,0.15)_0%,_rgba(174,198,207,0.1)_40%,_transparent_70%)]
              blur-3xl pointer-events-none ${isCoreHovered ? "opacity-100 scale-125" : "opacity-0"}`}
          />

          <div
            className={`relative w-full h-full border rounded-full flex items-center justify-center transition-colors duration-700 animate-[spin_20s_linear_infinite] ${
              isCoreHovered ? "border-white/10" : "border-white/5"
            }`}
          >
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5
                rounded-full transition-all duration-700 ${
                  isCoreHovered
                    ? "bg-[#F7E7CE] shadow-[0_0_15px_#F7E7CE,0_0_30px_#AEC6CF]"
                    : "bg-white/20"
                }`}
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div
              onClick={onAddProject}
              onPointerEnter={() => setIsCoreHovered(true)}
              onPointerLeave={() => setIsCoreHovered(false)}
              className={`w-20 h-20 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-700 cursor-pointer ${
                isCoreHovered
                  ? "border-[#F7E7CE]/30 scale-110 bg-white/[0.05]"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-colors duration-700 ${isCoreHovered ? "text-[#F7E7CE]" : "text-white/10"}`}
              >
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-5 pointer-events-none">
          <h2
            className={`text-2xl font-extralight text-white/40
              transition-all duration-1000 ease-out tracking-[0.4em] uppercase whitespace-nowrap
              ${isCoreHovered ? "text-white/80 text-[#F7E7CE] drop-shadow-[0_0_12px_rgba(247,231,206,0.5)]" : ""}`}
          >
            LIGHT UP THE STARS
          </h2>
          <p
            className={`text-white/30
              transition-all duration-1000 delay-100 max-w-sm leading-relaxed font-light text-sm italic mx-auto
              ${isCoreHovered ? "text-white/70 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" : ""}`}
          >
            당신의 우주에 첫 번째 별을 띄울 시간입니다. <br />
            <span className={`opacity-80 ${isCoreHovered ? "opacity-100" : ""}`}>
              코어를 클릭하여 탐사를 시작하세요.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

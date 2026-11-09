import React from 'react';

export const ArchitecturalBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#020203]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -12%, rgba(255, 255, 255, 0.035) 0%, rgba(245, 158, 11, 0.025) 35%, rgba(2, 2, 3, 0.99) 75%)',
        }}
      />

      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[75vh] opacity-15"
        style={{
          background:
            'conic-gradient(from 145deg at 50% 0%, transparent 0deg, rgba(255, 255, 255, 0.05) 15deg, transparent 30deg, rgba(245, 158, 11, 0.04) 35deg, transparent 48deg, rgba(255, 255, 255, 0.04) 58deg, transparent 72deg)',
          filter: 'blur(28px)',
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full opacity-[0.09]"
        viewBox="0 0 1920 1080"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="requiemGoldLine" x1="960" y1="0" x2="960" y2="1080" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#A1A1AA" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#27272A" stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="requiemHorizontal" x1="0" y1="540" x2="1920" y2="540" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.02" />
            <stop offset="25%" stopColor="#A1A1AA" stopOpacity="0.16" />
            <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.28" />
            <stop offset="75%" stopColor="#A1A1AA" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
          </linearGradient>

          <pattern id="architecturalGrid" width="120" height="120" patternUnits="userSpaceOnUse">
            <path
              d="M 120 0 L 0 0 0 120"
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="0.75"
            />
            <circle cx="60" cy="60" r="1" fill="rgba(255, 255, 255, 0.1)" />
          </pattern>
        </defs>

        <rect width="1920" height="1080" fill="url(#architecturalGrid)" />

        <g stroke="url(#requiemGoldLine)" strokeWidth="1.2">
          <line x1="90" y1="0" x2="90" y2="1080" />
          <line x1="110" y1="0" x2="110" y2="1080" strokeDasharray="6 6" />
          <line x1="240" y1="0" x2="240" y2="1080" />
          <line x1="254" y1="0" x2="254" y2="1080" />
          <line x1="420" y1="60" x2="420" y2="1080" strokeOpacity="0.5" />

          <line x1="1830" y1="0" x2="1830" y2="1080" />
          <line x1="1810" y1="0" x2="1810" y2="1080" strokeDasharray="6 6" />
          <line x1="1680" y1="0" x2="1680" y2="1080" />
          <line x1="1666" y1="0" x2="1666" y2="1080" />
          <line x1="1500" y1="60" x2="1500" y2="1080" strokeOpacity="0.5" />
        </g>

        <g stroke="url(#requiemGoldLine)" strokeWidth="1.4">
          <path d="M 90 1080 L 90 420 Q 90 60 960 -20 Q 1830 60 1830 420 L 1830 1080" />
          <path d="M 240 1080 L 240 460 Q 240 110 960 25 Q 1680 110 1680 460 L 1680 1080" />
          <path d="M 420 1080 L 420 500 Q 420 180 960 85 Q 1500 180 1500 500 L 1500 1080" />
          <path d="M 90 420 Q 520 220 960 260 Q 1400 220 1830 420" strokeOpacity="0.45" />
          <path d="M 240 460 Q 600 140 960 25 Q 1320 140 1680 460" strokeOpacity="0.55" />
          <path d="M 420 500 Q 690 290 960 260 Q 1230 290 1500 500" strokeOpacity="0.35" />
        </g>

        <g transform="translate(960, 260)" stroke="url(#requiemGoldLine)">
          <circle r="195" strokeWidth="1.2" strokeOpacity="0.5" />
          <circle r="178" strokeWidth="0.8" strokeDasharray="4 6" strokeOpacity="0.6" />
          <circle r="135" strokeWidth="1" strokeOpacity="0.45" />
          <circle r="88" strokeWidth="1.2" strokeOpacity="0.55" />
          <circle r="36" strokeWidth="1" strokeOpacity="0.7" />
          <polygon
            points="0,-178 126,-126 178,0 126,126 0,178 -126,126 -178,0 -126,-126"
            strokeWidth="0.75"
            strokeOpacity="0.35"
          />
          <polygon
            points="0,-135 95,-95 135,0 95,95 0,135 -95,95 -135,0 -95,-95"
            strokeWidth="0.75"
            strokeOpacity="0.35"
            transform="rotate(22.5)"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x2 = Math.cos(angle) * 195;
            const y2 = Math.sin(angle) * 195;
            return (
              <line
                key={i}
                x1="0"
                y1="0"
                x2={x2}
                y2={y2}
                strokeWidth="0.7"
                strokeOpacity="0.3"
              />
            );
          })}
        </g>

        <line x1="0" y1="260" x2="1920" y2="260" stroke="url(#requiemHorizontal)" strokeWidth="1" />
        <line x1="0" y1="500" x2="1920" y2="500" stroke="url(#requiemHorizontal)" strokeWidth="0.8" />
        <line x1="0" y1="820" x2="1920" y2="820" stroke="url(#requiemHorizontal)" strokeWidth="0.8" />

        <g stroke="url(#requiemGoldLine)" strokeWidth="0.6" strokeOpacity="0.25">
          <line x1="960" y1="260" x2="0" y2="920" />
          <line x1="960" y1="260" x2="360" y2="1080" />
          <line x1="960" y1="260" x2="720" y2="1080" />
          <line x1="960" y1="260" x2="1200" y2="1080" />
          <line x1="960" y1="260" x2="1560" y2="1080" />
          <line x1="960" y1="260" x2="1920" y2="920" />
        </g>
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, transparent 28%, rgba(0, 0, 0, 0.76) 72%, rgba(0, 0, 0, 0.97) 100%)',
        }}
      />
    </div>
  );
};

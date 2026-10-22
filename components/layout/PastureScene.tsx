/**
 * Cenário rural ilustrado (amanhecer, colinas, cerca de madeira e vacas) usado
 * como fundo do hero e das telas de autenticação, com overlay escuro para o vidro se destacar.
 */
export function PastureScene({ overlay = 'strong' }: { overlay?: 'strong' | 'soft' }) {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-dawn" aria-hidden>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff4d6" />
            <stop offset="0.5" stopColor="#f7cf7a" stopOpacity="0.8" />
            <stop offset="1" stopColor="#f0a957" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fa86a" />
            <stop offset="1" stopColor="#4f8a4b" />
          </linearGradient>
          <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5d9452" />
            <stop offset="1" stopColor="#3c6e3f" />
          </linearGradient>
          <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f7341" />
            <stop offset="1" stopColor="#24462b" />
          </linearGradient>
        </defs>

        <circle cx="1080" cy="330" r="260" fill="url(#sun)" />
        <circle cx="1080" cy="330" r="70" fill="#fff1c9" opacity="0.9" />

        {/* nuvens */}
        <g fill="#fff8ea" opacity="0.55">
          <ellipse cx="260" cy="170" rx="120" ry="26" />
          <ellipse cx="330" cy="150" rx="80" ry="24" />
          <ellipse cx="760" cy="120" rx="140" ry="22" />
          <ellipse cx="1260" cy="190" rx="110" ry="20" />
        </g>

        <path d="M0 520 C 240 440 420 470 640 500 S 1100 430 1440 480 L1440 900 L0 900Z" fill="url(#hillBack)" />
        <path d="M0 600 C 300 540 520 590 760 600 S 1180 540 1440 590 L1440 900 L0 900Z" fill="url(#hillMid)" />

        {/* árvores distantes */}
        <g fill="#2f5d3a" opacity="0.8">
          <ellipse cx="180" cy="555" rx="34" ry="42" />
          <rect x="176" y="580" width="8" height="30" fill="#5b3d26" />
          <ellipse cx="1290" cy="560" rx="40" ry="48" />
          <rect x="1286" y="590" width="8" height="34" fill="#5b3d26" />
          <ellipse cx="1350" cy="575" rx="26" ry="32" />
        </g>

        {/* vacas no pasto */}
        <g opacity="0.92">
          <Cow x={520} y={600} scale={1} coat="#f7f3ea" spots="#2b2b2b" />
          <Cow x={700} y={622} scale={0.8} coat="#8b5e3c" spots="#6b4428" flip />
          <Cow x={930} y={598} scale={0.7} coat="#e9e4da" spots="#cfc6b5" />
        </g>

        <path d="M0 700 C 320 650 600 700 900 700 S 1260 660 1440 690 L1440 900 L0 900Z" fill="url(#hillFront)" />

        {/* cerca de madeira */}
        <g stroke="#6b4428" strokeWidth="9" strokeLinecap="round">
          {[60, 200, 340, 480, 620].map((x, i) => (
            <line key={x} x1={x} y1={705 - i * 4} x2={x} y2={800 - i * 4} />
          ))}
          <line x1="40" y1="730" x2="640" y2="708" />
          <line x1="40" y1="765" x2="640" y2="745" />
        </g>
      </svg>
      <div
        className={`absolute inset-0 ${
          overlay === 'strong'
            ? 'bg-gradient-to-b from-[#1a2e1d]/45 via-[#1a2e1d]/55 to-[#1a2e1d]/85'
            : 'bg-gradient-to-b from-[#1a2e1d]/15 via-transparent to-[#1a2e1d]/50'
        }`}
      />
    </div>
  );
}

/** Cenário fixo atrás das áreas logadas/públicas: as vaquinhas ficam visíveis através do vidro. */
export function PastureBackdrop() {
  return (
    <div className="fixed inset-0 -z-10" aria-hidden>
      <PastureScene overlay="soft" />
      <div className="absolute inset-0 bg-creme/55" />
    </div>
  );
}

interface CowProps {
  x: number;
  y: number;
  scale: number;
  coat: string;
  spots: string;
  flip?: boolean;
}

function Cow({ x, y, scale, coat, spots, flip }: CowProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <ellipse cx="0" cy="0" rx="62" ry="32" fill={coat} />
      <ellipse cx="-18" cy="-8" rx="16" ry="12" fill={spots} />
      <ellipse cx="22" cy="8" rx="13" ry="9" fill={spots} />
      <rect x="-48" y="18" width="11" height="38" rx="4" fill={coat} />
      <rect x="-28" y="20" width="11" height="36" rx="4" fill={coat} />
      <rect x="24" y="20" width="11" height="36" rx="4" fill={coat} />
      <rect x="42" y="18" width="11" height="38" rx="4" fill={coat} />
      <path d="M55 -18 q20 -10 32 6 q8 16 -2 30 q-14 10 -26 -4z" fill={coat} />
      <ellipse cx="86" cy="12" rx="12" ry="9" fill="#e8b4a0" />
      <path d="M60 -20 l-8 -12 M78 -18 l8 -12" stroke="#d9c9a6" strokeWidth="4" strokeLinecap="round" />
      <path d="M-62 -4 q-14 10 -8 30" stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  );
}

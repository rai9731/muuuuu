/** Ilustração exibida quando o anúncio ainda não tem foto. */
export function CowPlaceholder({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-b from-palha to-folha/40 ${className}`} role="img" aria-label="Anúncio sem foto">
      <svg viewBox="0 0 120 80" className="h-1/2 w-auto opacity-70" aria-hidden>
        <ellipse cx="50" cy="42" rx="34" ry="20" fill="#F7F3EA" stroke="#2B2B2B" strokeWidth="2.5" />
        <ellipse cx="38" cy="38" rx="9" ry="7" fill="#2B2B2B" />
        <ellipse cx="62" cy="48" rx="7" ry="5" fill="#2B2B2B" />
        <rect x="24" y="56" width="6" height="16" rx="2" fill="#2B2B2B" />
        <rect x="68" y="56" width="6" height="16" rx="2" fill="#2B2B2B" />
        <circle cx="88" cy="30" r="13" fill="#F7F3EA" stroke="#2B2B2B" strokeWidth="2.5" />
        <ellipse cx="95" cy="36" rx="7" ry="5" fill="#E8B4A0" />
        <circle cx="86" cy="26" r="2" fill="#2B2B2B" />
      </svg>
    </div>
  );
}

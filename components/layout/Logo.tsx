import { Link } from 'react-router-dom';

interface LogoProps {
  light?: boolean;
  to?: string;
  compact?: boolean;
}

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#2F5D3A" />
      <path d="M12 22c4-6 10-6 13-3h14c3-3 9-3 13 3-3 1-6 1-8 0v14c0 8-5 14-12 14s-12-6-12-14V22c-2 1-5 1-8 0z" fill="#F7F3EA" />
      <circle cx="26.5" cy="33" r="2.6" fill="#2B2B2B" />
      <circle cx="37.5" cy="33" r="2.6" fill="#2B2B2B" />
      <ellipse cx="32" cy="43.5" rx="6.5" ry="4.2" fill="#D9A441" />
      <path d="M8 54h48" stroke="#4F8A4B" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light, to = '/', compact }: LogoProps) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-xl" aria-label="Boi na Rede — página inicial">
      <LogoMark />
      {!compact && (
        <span className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-pasto'}`}>
          Boi na <span className={light ? 'text-trigo' : 'text-terra'}>Rede</span>
        </span>
      )}
    </Link>
  );
}

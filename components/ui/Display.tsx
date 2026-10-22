import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { TONE_CLASSES } from '@utils/constants';
import { initials } from '@utils/format';
import { Button } from './Button';

// ─── GlassCard ───
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
  padded?: boolean;
}

export function GlassCard({ children, className = '', as: Tag = 'div', padded = true }: GlassCardProps) {
  return <Tag className={`glass rounded-3xl ${padded ? 'p-5 sm:p-6' : ''} ${className}`}>{children}</Tag>;
}

// ─── Badge ───
interface BadgeProps {
  tone?: keyof typeof TONE_CLASSES;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: keyof typeof TONE_CLASSES }>; value: string }) {
  const item = map[value] ?? { label: value, tone: 'gray' as const };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

// ─── Avatar ───
interface AvatarProps {
  name: string | null | undefined;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const AVATAR_SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-24 w-24 text-2xl' };

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name ? `Foto de ${name}` : 'Foto do usuário'} className={`${AVATAR_SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white/70 ${className}`} />;
  }
  return (
    <span aria-hidden className={`${AVATAR_SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-folha to-pasto font-semibold text-white ring-2 ring-white/70 ${className}`}>
      {initials(name)}
    </span>
  );
}

// ─── Skeleton ───
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-3xl p-3">
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-4 h-6 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState (ilustrado) ───
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: 'pasture' | 'search' | 'chat' | 'bell' | 'cart';
}

export function EmptyState({ title, description, action, illustration = 'pasture' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <EmptyIllustration kind={illustration} />
      <h3 className="mt-5 text-lg font-semibold text-grafite">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-grafite/70">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function EmptyIllustration({ kind }: { kind: EmptyStateProps['illustration'] }) {
  return (
    <svg viewBox="0 0 200 140" className="h-32 w-auto" aria-hidden>
      <ellipse cx="100" cy="122" rx="80" ry="10" fill="#2F5D3A" opacity="0.12" />
      <path d="M20 110 Q60 80 100 98 T180 100 L180 122 L20 122Z" fill="#4F8A4B" opacity="0.35" />
      <circle cx="160" cy="30" r="14" fill="#D9A441" opacity="0.6" />
      {/* cerca */}
      <g stroke="#8B5E3C" strokeWidth="3" strokeLinecap="round" opacity="0.7">
        <line x1="28" y1="78" x2="28" y2="114" />
        <line x1="58" y1="80" x2="58" y2="112" />
        <line x1="22" y1="88" x2="64" y2="88" />
        <line x1="22" y1="100" x2="64" y2="100" />
      </g>
      {kind === 'search' && (
        <g transform="translate(95 40)">
          <circle cx="20" cy="20" r="18" fill="#F7F3EA" stroke="#2F5D3A" strokeWidth="5" />
          <line x1="33" y1="33" x2="50" y2="50" stroke="#2F5D3A" strokeWidth="7" strokeLinecap="round" />
        </g>
      )}
      {kind === 'chat' && (
        <g transform="translate(90 35)">
          <rect x="0" y="0" width="60" height="40" rx="12" fill="#F7F3EA" stroke="#2F5D3A" strokeWidth="4" />
          <path d="M14 40 L10 54 L28 40" fill="#F7F3EA" stroke="#2F5D3A" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="18" cy="20" r="4" fill="#4F8A4B" /><circle cx="30" cy="20" r="4" fill="#4F8A4B" /><circle cx="42" cy="20" r="4" fill="#4F8A4B" />
        </g>
      )}
      {kind === 'bell' && (
        <g transform="translate(100 35)" fill="#F7F3EA" stroke="#2F5D3A" strokeWidth="4" strokeLinejoin="round">
          <path d="M0 50 Q6 44 6 30 Q6 8 25 6 Q44 8 44 30 Q44 44 50 50 Z" />
          <circle cx="25" cy="58" r="6" fill="#D9A441" />
        </g>
      )}
      {kind === 'cart' && (
        <g transform="translate(92 40)" fill="none" stroke="#2F5D3A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 4 H12 L22 44 H58 L66 16 H16" fill="#F7F3EA" />
          <circle cx="26" cy="56" r="5" fill="#D9A441" /><circle cx="54" cy="56" r="5" fill="#D9A441" />
        </g>
      )}
      {kind === 'pasture' && (
        <g transform="translate(92 52)">
          {/* vaquinha */}
          <ellipse cx="34" cy="30" rx="32" ry="20" fill="#F7F3EA" stroke="#2B2B2B" strokeWidth="3" />
          <ellipse cx="22" cy="26" rx="8" ry="6" fill="#2B2B2B" />
          <ellipse cx="46" cy="34" rx="7" ry="5" fill="#2B2B2B" />
          <rect x="8" y="44" width="6" height="16" rx="2" fill="#2B2B2B" />
          <rect x="52" y="44" width="6" height="16" rx="2" fill="#2B2B2B" />
          <circle cx="66" cy="18" r="13" fill="#F7F3EA" stroke="#2B2B2B" strokeWidth="3" />
          <ellipse cx="72" cy="24" rx="7" ry="5" fill="#E8B4A0" />
          <circle cx="64" cy="14" r="2" fill="#2B2B2B" />
        </g>
      )}
    </svg>
  );
}

// ─── ErrorState ───
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center" role="alert">
      <p className="text-base font-semibold text-grafite">Não foi possível carregar</p>
      <p className="mt-1 max-w-md text-sm text-grafite/70">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

// ─── Pagination ───
interface PaginationProps {
  page: number;
  lastPage: number;
  total?: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, lastPage, total, onChange }: PaginationProps) {
  if (lastPage <= 1) return null;
  const pages = Array.from({ length: lastPage }, (_, i) => i + 1).filter((p) => p === 1 || p === lastPage || Math.abs(p - page) <= 1);
  return (
    <nav className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Paginação">
      {total !== undefined && <p className="text-sm text-grafite/65">{total} resultado{total === 1 ? '' : 's'}</p>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="glass rounded-xl p-2 text-grafite transition hover:bg-white disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-grafite/50">…</span>}
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-9 min-w-9 rounded-xl px-3 text-sm font-semibold transition ${p === page ? 'bg-pasto text-white' : 'glass text-grafite hover:bg-white'}`}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= lastPage}
          className="glass rounded-xl p-2 text-grafite transition hover:bg-white disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

// ─── PageHeader ───
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-grafite sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-grafite/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ─── StatCard ───
interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: string;
  tone?: 'pasto' | 'trigo' | 'terra' | 'folha';
}

const STAT_TONES = {
  pasto: 'bg-pasto/12 text-pasto',
  folha: 'bg-folha/15 text-folha',
  trigo: 'bg-trigo/20 text-[#8a6119]',
  terra: 'bg-terra/15 text-terra',
};

export function StatCard({ label, value, icon, hint, tone = 'pasto' }: StatCardProps) {
  return (
    <GlassCard className="hover-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-grafite/70">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-grafite">{value}</p>
          {hint && <p className="mt-1 text-xs text-grafite/60">{hint}</p>}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${STAT_TONES[tone]}`}>{icon}</span>
      </div>
    </GlassCard>
  );
}

// ─── Tabs (filtro simples em pílulas) ───
interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; count?: number }[];
}

export function Tabs({ value, onChange, options }: TabsProps) {
  return (
    <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
            value === o.value ? 'bg-pasto text-white shadow-sm' : 'glass text-grafite/80 hover:bg-white'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-75">({o.count})</span>}
        </button>
      ))}
    </div>
  );
}

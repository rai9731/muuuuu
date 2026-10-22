// Formatação padrão pt-BR. Datas sempre exibidas em UTC-3 (America/Sao_Paulo).
const TZ = 'America/Sao_Paulo';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFormatter = new Intl.NumberFormat('pt-BR');

export function formatCurrency(value: number | string | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

export function formatNumber(value: number | string | null | undefined): string {
  return numberFormatter.format(Number(value ?? 0));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  const date = d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return `${date} às ${time}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return formatDate(value);
}

export function formatAge(months: number | null | undefined): string {
  if (months === null || months === undefined) return '—';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return rest ? `${y} e ${rest} ${rest === 1 ? 'mês' : 'meses'}` : y;
}

export function formatWeight(kg: number | string | null | undefined): string {
  if (kg === null || kg === undefined) return '—';
  return `${formatNumber(kg)} kg`;
}

export function formatMemberSince(value: string | null | undefined): string {
  if (!value) return '';
  const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30)));
  if (months < 1) return 'Novo na plataforma';
  if (months < 12) return `Há ${months} ${months === 1 ? 'mês' : 'meses'} na plataforma`;
  const years = Math.floor(months / 12);
  return `Há ${years} ${years === 1 ? 'ano' : 'anos'} na plataforma`;
}

/** Data de hoje (UTC-3) no formato AAAA-MM-DD, para inputs type="date". */
export function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

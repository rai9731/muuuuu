import type { ReactNode } from 'react';
import { GlassCard, ListSkeleton } from './Display';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Oculta a coluna no card mobile (ex.: dados secundários). */
  hideOnMobile?: boolean;
  /** Destaca como título do card mobile. */
  primary?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}

/** Tabela no desktop; cards empilhados no mobile. */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, actions, onRowClick }: DataTableProps<T>) {
  if (loading) {
    return (
      <GlassCard>
        <ListSkeleton rows={6} />
      </GlassCard>
    );
  }

  if (!rows.length) return <GlassCard>{empty}</GlassCard>;

  const primary = columns.find((c) => c.primary) ?? columns[0];

  return (
    <>
      {/* Desktop */}
      <GlassCard padded={false} className="hidden overflow-hidden md:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-pasto/10 bg-white/40 text-xs uppercase tracking-wide text-grafite/60">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.className ?? ''}`}>
                    {c.header}
                  </th>
                ))}
                {actions && <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-pasto/5 transition last:border-0 hover:bg-white/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <GlassCard key={rowKey(row)} className="!p-4">
            <div onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'cursor-pointer' : ''}>
              <div className="font-semibold text-grafite">{primary.render(row)}</div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {columns
                  .filter((c) => c !== primary && !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-xs text-grafite/55">{c.header}</dt>
                      <dd className="mt-0.5 truncate text-grafite">{c.render(row)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-pasto/10 pt-3">{actions(row)}</div>}
          </GlassCard>
        ))}
      </div>
    </>
  );
}

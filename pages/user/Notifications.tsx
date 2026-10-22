import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationService } from '@services/notificationService';
import type { AppNotification } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useUnreadCounts } from '@hooks/useUnreadCounts';
import { Button } from '@components/ui/Button';
import { Badge, EmptyState, ErrorState, GlassCard, ListSkeleton, PageHeader, Pagination, Tabs } from '@components/ui/Display';
import { NOTIFICATION_TYPES } from '@utils/constants';
import { formatRelative } from '@utils/format';

function targetFor(n: AppNotification, admin: boolean): string | null {
  const d = n.data as { cow_id?: number; order_id?: number; user_id?: number };
  if (d.order_id) return admin ? `/admin/vendas/${d.order_id}` : n.type === 'sale_made' || n.type === 'sale_completed' ? '/minhas-vendas' : `/minhas-compras/${d.order_id}`;
  if (d.user_id && admin) return `/admin/usuarios/${d.user_id}`;
  if (d.cow_id) return admin ? '/admin/anuncios' : n.type === 'cow_rejected' ? `/minhas-vacas/${d.cow_id}/editar` : `/anuncios/${d.cow_id}`;
  return null;
}

/** Central de notificações; serve ao usuário e ao administrador (cada um vê as suas). */
export default function Notifications() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { refresh } = useUnreadCounts();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => notificationService.list({ filter: filter || undefined, page }), [filter, page]);

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      await notificationService.markRead(n.id).catch(() => undefined);
      refresh();
      reload();
    }
    const to = targetFor(n, isAdmin);
    if (to) navigate(to);
  };

  const readAll = async () => {
    await notificationService.markAllRead();
    refresh();
    reload();
  };

  return (
    <div>
      <PageHeader title="Notificações" description="Avisos sobre anúncios, pedidos e pagamentos."
        actions={<Button variant="outline" icon={<CheckCheck className="h-4 w-4" />} onClick={readAll}>Marcar todas como lidas</Button>} />
      <div className="mb-4"><Tabs value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: '', label: 'Todas' }, { value: 'unread', label: 'Não lidas' }]} /></div>
      {error ? <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard> : loading ? <GlassCard><ListSkeleton rows={5} /></GlassCard> : !data?.data.length ? (
        <GlassCard><EmptyState title="Nenhuma notificação" description="Quando algo acontecer, você verá aqui." /></GlassCard>
      ) : (
        <>
          <GlassCard padded={false}>
            <ul className="divide-y divide-pasto/10">
              {data.data.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n)} className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/60 ${n.read_at ? '' : 'bg-trigo/10'}`}>
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pasto/10 text-pasto"><Bell className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${n.read_at ? 'font-medium' : 'font-bold'}`}>{n.title}</span>
                        <Badge tone="gray">{NOTIFICATION_TYPES[n.type] ?? n.type}</Badge>
                      </span>
                      {n.body && <span className="mt-0.5 block truncate text-sm text-grafite/70">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-grafite/55">{formatRelative(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

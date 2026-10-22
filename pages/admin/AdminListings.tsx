import { useState } from 'react';
import { Check, Pause, Trash2, X } from 'lucide-react';
import { adminService } from '@services/adminService';
import { errorMessage } from '@services/api';
import type { Cow } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useToast } from '@hooks/useToast';
import { Button } from '@components/ui/Button';
import { ConfirmDialog } from '@components/ui/ConfirmDialog';
import { DataTable, type Column } from '@components/ui/DataTable';
import { EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { Input, Textarea } from '@components/ui/Field';
import { COW_STATUS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

const TABS = [
  { value: 'pending', label: 'Em análise' }, { value: 'active', label: 'Ativos' }, { value: 'paused', label: 'Pausados' },
  { value: 'rejected', label: 'Recusados' }, { value: 'sold', label: 'Vendidos' }, { value: '', label: 'Todos' },
];

export default function AdminListings() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Cow | null>(null);
  const [removing, setRemoving] = useState<Cow | null>(null);
  const [reason, setReason] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminService.cows({ status: status || undefined, search: search || undefined, page }), [status, search, page]);

  const act = async (fn: () => Promise<{ message: string }>) => {
    try {
      toast.success((await fn()).message);
      setRejecting(null);
      setRemoving(null);
      setReason('');
      reload();
    } catch (err) {
      toast.error('Não foi possível concluir', errorMessage(err));
    }
  };

  const columns: Column<Cow>[] = [
    { key: 'title', header: 'Anúncio', primary: true, render: (c) => <div><p className="font-semibold">{c.title}</p><p className="text-xs text-grafite/60">{c.breed?.name} · {c.city}/{c.state}</p></div> },
    { key: 'seller', header: 'Vendedor', render: (c) => c.seller?.name ?? '—' },
    { key: 'price', header: 'Preço', render: (c) => formatCurrency(c.price) },
    { key: 'date', header: 'Criado em', render: (c) => formatDate(c.created_at), hideOnMobile: true },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge map={COW_STATUS} value={c.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Anúncios" description="Modere os anúncios enviados pelos vendedores." />
      <div className="mb-4 space-y-3">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} />
        <Input placeholder="Buscar por título ou vendedor" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error ? <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard> : (
        <>
          <DataTable
            columns={columns} rows={data?.data ?? []} rowKey={(c) => c.id} loading={loading}
            empty={<EmptyState title="Nenhum anúncio aqui" description="Nada para exibir neste filtro." />}
            actions={(c) => (
              <>
                {(c.status === 'pending' || c.status === 'rejected' || c.status === 'paused') && (
                  <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={() => act(() => adminService.approveCow(c.id))}>Aprovar</Button>
                )}
                {c.status === 'pending' && <Button size="sm" variant="outline" icon={<X className="h-4 w-4" />} onClick={() => setRejecting(c)}>Recusar</Button>}
                {c.status === 'active' && <Button size="sm" variant="outline" icon={<Pause className="h-4 w-4" />} onClick={() => act(() => adminService.pauseCow(c.id))}>Pausar</Button>}
                {c.status !== 'reserved' && c.status !== 'sold' && <Button size="sm" variant="ghost" aria-label="Excluir" icon={<Trash2 className="h-4 w-4" />} onClick={() => setRemoving(c)} />}
              </>
            )}
          />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}

      <ConfirmDialog open={!!rejecting} onClose={() => setRejecting(null)} title="Recusar anúncio" confirmLabel="Recusar" tone="danger" confirmDisabled={!reason.trim()}
        description="O vendedor verá o motivo para ajustar o anúncio." onConfirm={() => act(() => adminService.rejectCow(rejecting!.id, reason))}>
        <Textarea label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </ConfirmDialog>
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title="Excluir anúncio?" confirmLabel="Excluir" tone="danger"
        description={removing?.title} onConfirm={() => act(() => adminService.deleteCow(removing!.id))} />
    </div>
  );
}

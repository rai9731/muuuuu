import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCheck, Eye, Pause, Pencil, Play, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { cowService } from '@services/cowService';
import { errorMessage } from '@services/api';
import type { Cow } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useToast } from '@hooks/useToast';
import { Button, LinkButton } from '@components/ui/Button';
import { ConfirmDialog } from '@components/ui/ConfirmDialog';
import { DataTable, type Column } from '@components/ui/DataTable';
import { EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { CowPlaceholder } from '@components/cow/CowPlaceholder';
import { COW_STATUS } from '@utils/constants';
import { formatCurrency, formatDate, formatNumber } from '@utils/format';

type Action = { type: 'delete' | 'sold'; cow: Cow } | null;

const TABS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Em análise' },
  { value: 'active', label: 'Ativos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'reserved', label: 'Reservados' },
  { value: 'sold', label: 'Vendidos' },
  { value: 'rejected', label: 'Recusados' },
];

export default function MyCows() {
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action>(null);
  const { data, loading, error, reload } = useAsync(() => cowService.mine({ status: status || undefined, page }), [status, page]);

  const changeStatus = async (cow: Cow, act: 'pause' | 'resume' | 'sold') => {
    try {
      const res = await cowService.changeStatus(cow.id, act);
      toast.success(res.message);
      reload();
    } catch (err) {
      toast.error('Não foi possível atualizar o anúncio', errorMessage(err));
    }
  };

  const confirmAction = async () => {
    if (!action) return;
    try {
      if (action.type === 'delete') {
        const res = await cowService.remove(action.cow.id);
        toast.success(res.message);
      } else {
        await changeStatus(action.cow, 'sold');
      }
      setAction(null);
      reload();
    } catch (err) {
      toast.error('Não foi possível concluir a ação', errorMessage(err));
    }
  };

  const columns: Column<Cow>[] = [
    {
      key: 'cow',
      header: 'Vaca',
      primary: true,
      render: (cow) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-14 shrink-0 overflow-hidden rounded-xl">
            {cow.cover_thumb_url ? <img src={cow.cover_thumb_url} alt="" className="h-full w-full object-cover" /> : <CowPlaceholder />}
          </div>
          <div className="min-w-0">
            <Link to={`/anuncios/${cow.id}`} className="block truncate font-semibold text-grafite hover:text-pasto">{cow.title}</Link>
            <p className="text-xs text-grafite/60">{cow.breed?.name} · criado em {formatDate(cow.created_at)}</p>
            {cow.status === 'rejected' && cow.rejection_reason && (
              <p className="mt-1 flex items-start gap-1 text-xs font-medium text-red-700">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> Motivo: {cow.rejection_reason}
              </p>
            )}
          </div>
        </div>
      ),
    },
    { key: 'price', header: 'Preço', render: (cow) => <span className="font-semibold">{formatCurrency(cow.price)}</span> },
    { key: 'status', header: 'Status', render: (cow) => <StatusBadge map={COW_STATUS} value={cow.status} /> },
    {
      key: 'views',
      header: 'Visualizações',
      render: (cow) => <span className="inline-flex items-center gap-1 text-grafite/75"><Eye className="h-3.5 w-3.5" /> {formatNumber(cow.views_count)}</span>,
    },
  ];

  const actions = (cow: Cow) => {
    const editable = !['sold', 'reserved'].includes(cow.status);
    return (
      <>
        {editable && (
          <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/minhas-vacas/${cow.id}/editar`)} aria-label="Editar">
            <span className="md:hidden">Editar</span>
          </Button>
        )}
        {cow.status === 'active' && (
          <Button size="sm" variant="ghost" icon={<Pause className="h-4 w-4" />} onClick={() => changeStatus(cow, 'pause')} aria-label="Pausar">
            <span className="md:hidden">Pausar</span>
          </Button>
        )}
        {cow.status === 'paused' && (
          <Button size="sm" variant="ghost" icon={<Play className="h-4 w-4" />} onClick={() => changeStatus(cow, 'resume')} aria-label="Reativar">
            <span className="md:hidden">Reativar</span>
          </Button>
        )}
        {['active', 'paused'].includes(cow.status) && (
          <Button size="sm" variant="ghost" icon={<CheckCheck className="h-4 w-4" />} onClick={() => setAction({ type: 'sold', cow })} aria-label="Marcar como vendida">
            <span className="md:hidden">Vendida</span>
          </Button>
        )}
        {cow.status !== 'reserved' && (
          <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => setAction({ type: 'delete', cow })} aria-label="Excluir">
            <span className="md:hidden">Excluir</span>
          </Button>
        )}
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Minhas vacas"
        description="Gerencie seus anúncios e acompanhe as visualizações."
        actions={<LinkButton to="/minhas-vacas/nova" variant="cta" icon={<Plus className="h-4 w-4" />}>Anunciar nova vaca</LinkButton>}
      />
      <div className="mb-4">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} />
      </div>
      {error ? (
        <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(c) => c.id}
            loading={loading}
            actions={actions}
            empty={
              <EmptyState
                title={status ? 'Nenhum anúncio com este status' : 'Você ainda não tem anúncios'}
                description="Anuncie sua vaca em poucos minutos e alcance compradores de todo o Brasil."
                action={<LinkButton to="/minhas-vacas/nova" icon={<Plus className="h-4 w-4" />}>Anunciar nova vaca</LinkButton>}
              />
            }
          />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}

      <ConfirmDialog
        open={!!action}
        onClose={() => setAction(null)}
        onConfirm={confirmAction}
        tone={action?.type === 'delete' ? 'danger' : 'primary'}
        title={action?.type === 'delete' ? 'Excluir anúncio?' : 'Marcar como vendida?'}
        confirmLabel={action?.type === 'delete' ? 'Excluir' : 'Marcar como vendida'}
        description={
          action?.type === 'delete'
            ? `O anúncio "${action.cow.title}" será removido da plataforma. Esta ação não pode ser desfeita.`
            : `Use esta opção se você vendeu "${action?.cow.title}" fora da plataforma. O anúncio sai da vitrine.`
        }
      />
    </div>
  );
}

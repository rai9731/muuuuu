import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService } from '@services/orderService';
import type { Order } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { LinkButton } from '@components/ui/Button';
import { DataTable, type Column } from '@components/ui/DataTable';
import { EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { CowPlaceholder } from '@components/cow/CowPlaceholder';
import { ORDER_STATUS, PAYMENT_METHODS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

const TABS = [
  { value: '', label: 'Todos' },
  ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })),
];

export default function MyPurchases() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => orderService.purchases({ status: status || undefined, page }), [status, page]);

  const columns: Column<Order>[] = [
    {
      key: 'cow',
      header: 'Pedido',
      primary: true,
      render: (o) => (
        <div className="flex items-center gap-3">
          <div className="h-11 w-12 shrink-0 overflow-hidden rounded-xl">
            {o.cow.cover_thumb_url ? <img src={o.cow.cover_thumb_url} alt="" className="h-full w-full object-cover" /> : <CowPlaceholder />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{o.cow.title}</p>
            <p className="text-xs text-grafite/60">#{o.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'seller', header: 'Vendedor', render: (o) => o.seller.name },
    { key: 'date', header: 'Data', render: (o) => formatDate(o.created_at) },
    { key: 'payment', header: 'Pagamento', render: (o) => (o.payment ? PAYMENT_METHODS[o.payment.method] : '—'), hideOnMobile: true },
    { key: 'total', header: 'Total', render: (o) => <span className="font-semibold">{formatCurrency(o.total)}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Minhas compras" description="Acompanhe seus pedidos, pagamentos e entregas." />
      <div className="mb-4"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} /></div>
      {error ? (
        <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(o) => o.id}
            loading={loading}
            onRowClick={(o) => navigate(`/minhas-compras/${o.id}`)}
            empty={<EmptyState illustration="cart" title="Nenhuma compra por aqui" description="Quando você comprar uma vaca, o pedido aparece nesta lista." action={<LinkButton to="/anuncios">Explorar anúncios</LinkButton>} />}
          />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

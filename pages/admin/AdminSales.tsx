import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '@services/adminService';
import type { Order } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { DataTable, type Column } from '@components/ui/DataTable';
import { EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { Input } from '@components/ui/Field';
import { OrderStatusBadge } from '@components/ui/OrderStatusBadge';
import { PAYOUT_STATUS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

const TABS = [
  { value: '', label: 'Todas' }, { value: 'awaiting_payment', label: 'Aguardando pagamento' }, { value: 'paid', label: 'Pagas' },
  { value: 'in_transit', label: 'Em transporte' }, { value: 'delivered', label: 'Entregues' }, { value: 'cancelled', label: 'Canceladas' },
];

export default function AdminSales() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => adminService.sales({ status: status || undefined, search: search || undefined, page }), [status, search, page]);

  const columns: Column<Order>[] = [
    { key: 'code', header: 'Pedido', primary: true, render: (o) => <div><p className="font-semibold">#{o.code}</p><p className="text-xs text-grafite/60">{formatDate(o.created_at)}</p></div> },
    { key: 'cow', header: 'Vaca', render: (o) => <span className="line-clamp-1">{o.cow.title}</span> },
    { key: 'buyer', header: 'Comprador', render: (o) => o.buyer.name },
    { key: 'seller', header: 'Vendedor', render: (o) => o.seller.name },
    { key: 'total', header: 'Total', render: (o) => <span className="font-semibold">{formatCurrency(o.total)}</span> },
    { key: 'fee', header: 'Comissão', render: (o) => formatCurrency(o.platform_fee), hideOnMobile: true },
    { key: 'payout', header: 'Repasse', render: (o) => <StatusBadge map={PAYOUT_STATUS} value={o.payout_status} />, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusBadge order={o} /> },
  ];

  return (
    <div>
      <PageHeader title="Vendas" description="Todos os pedidos da plataforma." />
      <div className="mb-4 space-y-3">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} />
        <Input placeholder="Buscar por código, comprador ou vendedor" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error ? <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard> : (
        <>
          <DataTable columns={columns} rows={data?.data ?? []} rowKey={(o) => o.id} loading={loading} onRowClick={(o) => navigate(`/admin/vendas/${o.id}`)}
            empty={<EmptyState illustration="cart" title="Nenhuma venda" />} />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

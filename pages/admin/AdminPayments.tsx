import { useState } from 'react';
import { adminService, type AdminPayment } from '@services/adminService';
import { useAsync } from '@hooks/useAsync';
import { DataTable, type Column } from '@components/ui/DataTable';
import { EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { PAYMENT_METHODS, PAYMENT_STATUS, PAYOUT_STATUS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

const TABS = [{ value: '', label: 'Todos' }, { value: 'pending', label: 'Pendentes' }, { value: 'approved', label: 'Aprovados' }, { value: 'refused', label: 'Recusados' }, { value: 'refunded', label: 'Estornados' }];

export default function AdminPayments() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => adminService.payments({ status: status || undefined, page }), [status, page]);

  const columns: Column<AdminPayment>[] = [
    { key: 'code', header: 'Pedido', primary: true, render: (p) => <div><p className="font-semibold">#{p.order.code}</p><p className="text-xs text-grafite/60">{formatDate(p.created_at)}</p></div> },
    { key: 'cow', header: 'Animal', render: (p) => p.cow.title },
    { key: 'payer', header: 'Pagador', render: (p) => p.payer.name },
    { key: 'seller', header: 'Vendedor', render: (p) => p.seller.name, hideOnMobile: true },
    { key: 'method', header: 'Forma', render: (p) => PAYMENT_METHODS[p.method] },
    { key: 'amount', header: 'Valor', render: (p) => <span className="font-semibold">{formatCurrency(p.amount)}</span> },
    { key: 'status', header: 'Pagamento', render: (p) => <StatusBadge map={PAYMENT_STATUS} value={p.status} /> },
    { key: 'payout', header: 'Repasse', render: (p) => <StatusBadge map={PAYOUT_STATUS} value={p.order.payout_status} />, hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader title="Pagamentos" description="Acompanhamento de pagamentos e repasses." />
      <div className="mb-4"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} /></div>
      {error ? <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard> : (
        <>
          <DataTable columns={columns} rows={data?.data ?? []} rowKey={(p) => p.id} loading={loading} empty={<EmptyState title="Nenhum pagamento" />} />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { adminService } from '@services/adminService';
import { useAsync } from '@hooks/useAsync';
import { ErrorState, GlassCard, PageHeader, Skeleton, StatusBadge } from '@components/ui/Display';
import { Timeline } from '@components/ui/Timeline';
import { DELIVERY_METHODS, ORDER_STATUS, PAYMENT_METHODS, PAYMENT_STATUS, PAYOUT_STATUS } from '@utils/constants';
import { formatCurrency, formatDateTime } from '@utils/format';

export default function AdminSaleDetail() {
  const { id } = useParams();
  const { data: o, loading, error, reload } = useAsync(() => adminService.sale(id!), [id]);

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;
  if (loading || !o) return <Skeleton className="h-64" />;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-grafite/60">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`Pedido #${o.code}`} description={formatDateTime(o.created_at)} actions={<StatusBadge map={ORDER_STATUS} value={o.status} />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-2 font-bold">Resumo</h2>
          <dl className="divide-y divide-pasto/10">
            {row('Animal', o.cow.title)}
            {row('Comprador', <Link className="hover:underline" to={`/admin/usuarios/${o.buyer.id}`}>{o.buyer.name}</Link>)}
            {row('Vendedor', <Link className="hover:underline" to={`/admin/usuarios/${o.seller.id}`}>{o.seller.name}</Link>)}
            {row('Entrega', DELIVERY_METHODS[o.delivery_method])}
            {row('Valor do animal', formatCurrency(o.price))}
            {row(`Comissão (${o.commission_percent}%)`, formatCurrency(o.platform_fee))}
            {row('Total pago pelo comprador', formatCurrency(o.total))}
            {row('Repasse ao vendedor', formatCurrency(o.seller_amount))}
            {row('Status do repasse', <StatusBadge map={PAYOUT_STATUS} value={o.payout_status} />)}
          </dl>
        </GlassCard>
        <GlassCard>
          <h2 className="mb-2 font-bold">Pagamento</h2>
          {o.payment ? (
            <dl className="divide-y divide-pasto/10">
              {row('Forma', PAYMENT_METHODS[o.payment.method])}
              {row('Status', <StatusBadge map={PAYMENT_STATUS} value={o.payment.status} />)}
              {row('Valor', formatCurrency(o.payment.amount))}
              {row('Pago em', o.payment.paid_at ? formatDateTime(o.payment.paid_at) : '—')}
            </dl>
          ) : <p className="text-sm text-grafite/60">Sem pagamento registrado.</p>}
          {o.timeline && <div className="mt-4"><Timeline events={o.timeline} /></div>}
        </GlassCard>
      </div>
    </div>
  );
}

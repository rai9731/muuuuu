import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Truck } from 'lucide-react';
import { orderService } from '@services/orderService';
import { messageService } from '@services/messageService';
import { errorMessage } from '@services/api';
import type { Order } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { Button, LinkButton } from '@components/ui/Button';
import { ConfirmDialog } from '@components/ui/ConfirmDialog';
import { DataTable, type Column } from '@components/ui/DataTable';
import { Avatar, EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { OrderStatusBadge, PaymentStatusBadge } from '@components/ui/OrderStatusBadge';
import { PAYOUT_STATUS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

const TABS = [
  { value: '', label: 'Todas' },
  { value: 'awaiting_payment', label: 'Aguardando pagamento' },
  { value: 'paid', label: 'Pagas' },
  { value: 'in_transit', label: 'Em transporte' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'cancelled', label: 'Canceladas' },
];

export default function MySales() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [shipping, setShipping] = useState<Order | null>(null);
  const { data, loading, error, reload } = useAsync(() => orderService.sales({ status: status || undefined, page }), [status, page]);

  const ship = async () => {
    try {
      const res = await orderService.ship(shipping!.id);
      toast.success(res.message);
      setShipping(null);
      reload();
    } catch (err) {
      toast.error('Não foi possível atualizar o envio', errorMessage(err));
    }
  };

  const openChat = async (o: Order) => {
    if (o.conversation_id) return navigate(`/mensagens/${o.conversation_id}`);
    try {
      const conv = await messageService.start(o.cow.id, `Olá, ${o.buyer.name.split(' ')[0]}! Sobre o pedido #${o.code}.`);
      navigate(`/mensagens/${conv.id}`);
    } catch (err) {
      toast.error('Não foi possível abrir a conversa', errorMessage(err));
    }
  };

  const columns: Column<Order>[] = [
    {
      key: 'buyer',
      header: 'Comprador',
      primary: true,
      render: (o) => (
        <div className="flex items-center gap-2">
          <Avatar name={o.buyer.name} src={o.buyer.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{o.buyer.name}</p>
            <p className="text-xs text-grafite/60">#{o.code} · {formatDate(o.created_at)}</p>
          </div>
        </div>
      ),
    },
    { key: 'cow', header: 'Vaca', render: (o) => <span className="line-clamp-1">{o.cow.title}</span> },
    { key: 'value', header: 'Valor', render: (o) => <span className="font-semibold">{formatCurrency(o.price)}</span> },
    { key: 'net', header: 'Você recebe', render: (o) => formatCurrency(o.seller_amount), hideOnMobile: true },
    { key: 'payment', header: 'Pagamento', render: (o) => (o.payment ? <PaymentStatusBadge payment={o.payment} /> : '—') },
    { key: 'payout', header: 'Repasse', render: (o) => <StatusBadge map={PAYOUT_STATUS} value={o.payout_status} /> },
    { key: 'status', header: 'Pedido', render: (o) => <OrderStatusBadge order={o} /> },
  ];

  return (
    <div>
      <PageHeader title="Minhas vendas" description="Acompanhe pagamentos, repasses e envios das suas vendas." />
      {user && !user.payout_pix_key && !user.payout_bank && (
        <GlassCard className="mb-4 flex flex-col gap-3 border-l-4 border-l-trigo sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Cadastre sua chave Pix ou conta bancária para receber os repasses das vendas.</p>
          <LinkButton to="/perfil#recebimento" size="sm" variant="outline">Cadastrar dados de recebimento</LinkButton>
        </GlassCard>
      )}
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
            actions={(o) => (
              <>
                {o.status === 'paid' && o.payment?.test_mode && (
                  <span className="text-xs font-semibold text-grafite/60">
                    {o.payment.test_mode === 'sandbox' ? 'Pagamento de teste (Sandbox): não enviar' : 'Simulado: não enviar'}
                  </span>
                )}
                {o.status === 'paid' && !o.payment?.test_mode && (
                  <Button size="sm" variant="outline" icon={<Truck className="h-4 w-4" />} onClick={() => setShipping(o)}>Marcar em transporte</Button>
                )}
                <Button size="sm" variant="ghost" icon={<MessageCircle className="h-4 w-4" />} onClick={() => openChat(o)} aria-label="Conversar com o comprador">
                  <span className="md:hidden">Conversar</span>
                </Button>
              </>
            )}
            empty={<EmptyState illustration="cart" title="Nenhuma venda ainda" description="Quando alguém comprar uma vaca sua, a venda aparece aqui." action={<LinkButton to="/minhas-vacas/nova">Anunciar nova vaca</LinkButton>} />}
          />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}

      <ConfirmDialog
        open={!!shipping}
        onClose={() => setShipping(null)}
        onConfirm={ship}
        title="Marcar como em transporte?"
        confirmLabel="Confirmar envio"
        description={`O comprador ${shipping?.buyer.name ?? ''} será avisado de que o animal está a caminho.`}
      />
    </div>
  );
}

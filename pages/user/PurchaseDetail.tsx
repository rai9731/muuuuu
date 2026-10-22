import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Barcode, CheckCircle2, Copy, CreditCard, ExternalLink, MessageCircle, PackageCheck, QrCode, Star, Zap } from 'lucide-react';
import { orderService } from '@services/orderService';
import { messageService } from '@services/messageService';
import { errorMessage } from '@services/api';
import { useAsync } from '@hooks/useAsync';
import { useToast } from '@hooks/useToast';
import { Button } from '@components/ui/Button';
import { ConfirmDialog } from '@components/ui/ConfirmDialog';
import { Avatar, ErrorState, GlassCard, Skeleton, StatusBadge } from '@components/ui/Display';
import { Textarea } from '@components/ui/Field';
import { Modal } from '@components/ui/Modal';
import { RatingStars } from '@components/ui/RatingStars';
import { Timeline } from '@components/ui/Timeline';
import { CowPlaceholder } from '@components/cow/CowPlaceholder';
import { DELIVERY_METHODS, ORDER_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } from '@utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '@utils/format';

export default function PurchaseDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.purchase(id!), [id]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = params.get('novo') === '1';

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(order!.payment!.pix_payload!);
      toast.success('Código Pix copiado!', 'Cole no app do seu banco para pagar.');
    } catch {
      toast.error('Não foi possível copiar', 'Selecione o código e copie manualmente.');
    }
  };

  const talkToSeller = async () => {
    if (order?.conversation_id) {
      navigate(`/mensagens/${order.conversation_id}`);
      return;
    }
    setBusy(true);
    try {
      const conv = await messageService.start(order!.cow.id, `Olá! Sobre o pedido #${order!.code}.`);
      navigate(`/mensagens/${conv.id}`);
    } catch (err) {
      toast.error('Não foi possível abrir a conversa', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelivery = async () => {
    try {
      const res = await orderService.confirmDelivery(order!.id);
      setData(res.data);
      setConfirmOpen(false);
      toast.success(res.message);
    } catch (err) {
      toast.error('Não foi possível confirmar o recebimento', errorMessage(err));
    }
  };

  const sendReview = async () => {
    setBusy(true);
    try {
      const res = await orderService.review(order!.id, rating, comment);
      setData(res.data);
      setReviewOpen(false);
      toast.success(res.message);
    } catch (err) {
      toast.error('Não foi possível enviar a avaliação', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const simulate = async () => {
    setBusy(true);
    try {
      const res = await orderService.simulatePayment(order!.id);
      setData(res.data);
      toast.success(res.message);
    } catch (err) {
      toast.error('Não foi possível simular o pagamento', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;
  if (loading || !order) return <Skeleton className="h-[480px] rounded-3xl" />;

  const payment = order.payment;
  const pending = order.status === 'awaiting_payment' && payment?.status === 'pending';

  return (
    <div>
      <button type="button" onClick={() => navigate('/minhas-compras')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-grafite/70 hover:text-pasto">
        <ArrowLeft className="h-4 w-4" /> Minhas compras
      </button>

      {isNew && (
        <GlassCard className="mb-6 border-l-4 border-l-folha text-center sm:text-left">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <CheckCircle2 className="h-14 w-14 shrink-0 text-folha" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold">Pedido realizado com sucesso!</h1>
              <p className="mt-1 text-grafite/75">
                Número do pedido: <strong className="text-pasto">#{order.code}</strong>. {pending ? 'Conclua o pagamento abaixo — a vaca está reservada para você.' : ''}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pedido #{order.code}</h2>
          <p className="text-sm text-grafite/65">Realizado em {formatDateTime(order.created_at)}</p>
        </div>
        <StatusBadge map={ORDER_STATUS} value={order.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {payment && (
            <GlassCard>
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  {payment.method === 'pix' ? <QrCode className="h-5 w-5 text-pasto" /> : payment.method === 'boleto' ? <Barcode className="h-5 w-5 text-pasto" /> : <CreditCard className="h-5 w-5 text-pasto" />}
                  Pagamento via {PAYMENT_METHODS[payment.method]}
                </h3>
                <StatusBadge map={PAYMENT_STATUS} value={payment.status} />
              </div>

              {pending && (
                <div className="mt-5">
                  {payment.method === 'pix' && (
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      {payment.pix_qr_image && (
                        <img src={`data:image/png;base64,${payment.pix_qr_image}`} alt="QR Code Pix para pagamento" className="h-48 w-48 rounded-2xl bg-white p-2" />
                      )}
                      <div className="w-full min-w-0 flex-1">
                        <p className="text-sm text-grafite/75">Escaneie o QR Code ou use o Pix copia e cola:</p>
                        <code className="mt-2 block max-h-24 overflow-y-auto break-all rounded-xl bg-white/70 p-3 text-xs">{payment.pix_payload}</code>
                        <Button className="mt-3" variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={copyPix} disabled={!payment.pix_payload}>
                          Copiar código Pix
                        </Button>
                      </div>
                    </div>
                  )}
                  {payment.method === 'boleto' && payment.boleto_url && (
                    <a href={payment.boleto_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-pasto px-5 text-sm font-semibold text-white hover:bg-folha">
                      <Barcode className="h-4 w-4" /> Abrir segunda via do boleto <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {payment.method === 'credit_card' && payment.invoice_url && (
                    <a href={payment.invoice_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-pasto px-5 text-sm font-semibold text-white hover:bg-folha">
                      <CreditCard className="h-4 w-4" /> Pagar com cartão no ambiente seguro <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {payment.due_date && <p className="mt-3 text-xs text-grafite/60">Vencimento: {formatDate(payment.due_date)}. Se não for pago, o pedido é cancelado e a vaca volta para a vitrine.</p>}
                  {payment.simulated && (
                    <div className="mt-4 rounded-2xl bg-trigo/15 p-4">
                      <p className="text-sm text-grafite/80">Cobrança simulada (Asaas não configurado neste ambiente).</p>
                      <Button className="mt-2" size="sm" variant="cta" icon={<Zap className="h-4 w-4" />} onClick={simulate} loading={busy}>
                        Simular pagamento confirmado
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {payment.paid_at && <p className="mt-3 text-sm text-grafite/70">Pago em {formatDateTime(payment.paid_at)}</p>}
            </GlassCard>
          )}

          <GlassCard>
            <h3 className="mb-5 font-semibold">Acompanhamento</h3>
            {order.timeline && <Timeline events={order.timeline} />}
            <div className="mt-6 flex flex-wrap gap-2">
              {['paid', 'in_transit'].includes(order.status) && (
                <Button icon={<PackageCheck className="h-4 w-4" />} onClick={() => setConfirmOpen(true)}>Confirmar recebimento</Button>
              )}
              {order.status === 'delivered' && !order.review && (
                <Button variant="cta" icon={<Star className="h-4 w-4" />} onClick={() => setReviewOpen(true)}>Avaliar vendedor</Button>
              )}
            </div>
            {order.review && (
              <div className="mt-5 rounded-2xl bg-white/50 p-4">
                <p className="text-xs font-semibold uppercase text-grafite/55">Sua avaliação</p>
                <RatingStars value={order.review.rating} size="md" />
                {order.review.comment && <p className="mt-1 text-sm text-grafite/80">{order.review.comment}</p>}
              </div>
            )}
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <div className="flex gap-3">
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
                {order.cow.cover_thumb_url ? <img src={order.cow.cover_thumb_url} alt="" className="h-full w-full object-cover" /> : <CowPlaceholder />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-terra">{order.cow.breed?.name}</p>
                <p className="font-semibold">{order.cow.title}</p>
                <p className="text-xs text-grafite/60">{DELIVERY_METHODS[order.delivery_method]}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-2 border-t border-pasto/10 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-grafite/70">Valor</dt><dd>{formatCurrency(order.price)}</dd></div>
              <div className="flex justify-between"><dt className="text-grafite/70">Taxa da plataforma</dt><dd className="text-grafite/60">incluída</dd></div>
              <div className="flex justify-between text-base"><dt className="font-semibold">Total</dt><dd className="font-bold text-pasto">{formatCurrency(order.total)}</dd></div>
            </dl>
          </GlassCard>

          <GlassCard>
            <p className="text-xs font-semibold uppercase text-grafite/55">Vendedor</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={order.seller.name} src={order.seller.avatar_url} size="lg" />
              <div>
                <p className="font-semibold">{order.seller.name}</p>
                <p className="text-sm text-grafite/65">{order.seller.city}/{order.seller.state}</p>
                {order.seller.phone && <p className="text-sm text-grafite/65">{order.seller.phone}</p>}
              </div>
            </div>
            <Button variant="outline" block className="mt-4" icon={<MessageCircle className="h-4 w-4" />} onClick={talkToSeller} loading={busy}>
              Falar com o vendedor
            </Button>
          </GlassCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelivery}
        title="Confirmar recebimento?"
        confirmLabel="Sim, recebi"
        description="Confirme apenas se o animal já chegou até você ou foi retirado na propriedade. O pedido será marcado como entregue."
      />

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Avaliar vendedor"
        description={order.seller.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>Cancelar</Button>
            <Button onClick={sendReview} loading={busy}>Enviar avaliação</Button>
          </>
        }
      >
        <div className="flex justify-center"><RatingStars value={rating} onChange={setRating} size="lg" /></div>
        <Textarea label="Comentário (opcional)" className="mt-4" wrapperClassName="mt-4" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Como foi a negociação, a entrega e o animal?" />
      </Modal>
    </div>
  );
}

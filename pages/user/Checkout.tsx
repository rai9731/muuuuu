import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, MapPin, QrCode, ShieldCheck, Truck, Warehouse } from 'lucide-react';
import { orderService } from '@services/orderService';
import { ApiError, errorMessage } from '@services/api';
import type { DeliveryMethod, PaymentMethod } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { Button, LinkButton } from '@components/ui/Button';
import { Avatar, ErrorState, GlassCard, PageHeader, Skeleton } from '@components/ui/Display';
import { CowPlaceholder } from '@components/cow/CowPlaceholder';
import { formatAge, formatCurrency, formatNumber, formatWeight } from '@utils/format';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; description: string; icon: typeof QrCode }[] = [
  { value: 'pix', label: 'Pix', description: 'Código Pix copia e cola; depois você confere o pagamento no pedido.', icon: QrCode },
];

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; description: string; icon: typeof Truck }[] = [
  { value: 'freight', label: 'Frete', description: 'Combine o transporte com o vendedor pelo chat.', icon: Truck },
  { value: 'pickup', label: 'Retirada na propriedade', description: 'Você busca o animal na fazenda do vendedor.', icon: Warehouse },
];

export default function Checkout() {
  const { cowId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => orderService.checkoutPreview(cowId!), [cowId]);
  const [payment, setPayment] = useState<PaymentMethod | ''>('');
  const [delivery, setDelivery] = useState<DeliveryMethod>('freight');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!payment) {
      toast.warning('Escolha a forma de pagamento.');
      return;
    }
    setSubmitting(true);
    try {
      const order = await orderService.checkout(cowId!, { payment_method: payment, delivery_method: delivery });
      navigate(`/minhas-compras/${order.id}?novo=1`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && !user?.profile_complete) {
        toast.warning('Complete seu cadastro', err.message);
        navigate('/perfil?completar=1');
      } else {
        toast.error('Não foi possível concluir a compra', errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <GlassCard>
        <ErrorState message={error} onRetry={reload} />
        <div className="text-center"><LinkButton to="/anuncios" variant="outline">Voltar para o marketplace</LinkButton></div>
      </GlassCard>
    );
  }

  if (loading || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]" aria-busy="true">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }

  const { cow } = data;
  const methods = PAYMENT_OPTIONS.filter((p) => data.payment_methods.includes(p.value));

  return (
    <div>
      <PageHeader title="Finalizar compra" description="Revise os dados e escolha como pagar." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <GlassCard>
            <h2 className="font-semibold">Resumo da vaca</h2>
            <div className="mt-4 flex gap-4">
              <div className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl">
                {cow.photos[0] ? <img src={cow.photos[0].thumb_url ?? cow.photos[0].url} alt={cow.title} className="h-full w-full object-cover" /> : <CowPlaceholder />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-terra">{cow.breed?.name}</p>
                <p className="font-semibold">{cow.title}</p>
                <p className="mt-1 text-sm text-grafite/70">{formatAge(cow.age_months)} · {formatWeight(cow.weight_kg)}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-grafite/70"><MapPin className="h-3.5 w-3.5" /> {cow.city}/{cow.state}</p>
              </div>
            </div>
            {cow.seller && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/45 p-3">
                <Avatar name={cow.seller.name} src={cow.seller.avatar_url} />
                <div className="min-w-0">
                  <p className="text-xs text-grafite/60">Vendedor</p>
                  <p className="truncate text-sm font-semibold">{cow.seller.name}{cow.seller.farm_name ? ` · ${cow.seller.farm_name}` : ''}</p>
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Entrega</h2>
            <RadioCards name="delivery" value={delivery} onChange={(v) => setDelivery(v as DeliveryMethod)} options={DELIVERY_OPTIONS} />
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Forma de pagamento</h2>
            <RadioCards name="payment" value={payment} onChange={(v) => setPayment(v as PaymentMethod)} options={methods} />
            {data.simulated_gateway && (
              <p className="mt-4 rounded-xl bg-trigo/15 p-3 text-xs text-grafite/80">
                Ambiente de demonstração: a cobrança é SIMULADA (não passa pelo Asaas). A confirmação só acontece quando você conferir o pagamento no pedido.
              </p>
            )}
          </GlassCard>
        </div>

        <div>
          <GlassCard className="lg:sticky lg:top-24">
            <h2 className="font-semibold">Valores</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-grafite/70">Valor da vaca</dt><dd className="font-semibold">{formatCurrency(data.price)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-grafite/70">Taxa da plataforma ({formatNumber(data.commission_percent)}%)</dt>
                <dd className="text-grafite/70">{formatCurrency(data.platform_fee)}</dd>
              </div>
              <p className="text-xs text-grafite/55">A taxa é descontada do repasse ao vendedor — você não paga nada a mais.</p>
              <div className="flex justify-between border-t border-pasto/10 pt-3 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-bold text-pasto">{formatCurrency(data.total)}</dd>
              </div>
            </dl>
            <Button variant="cta" size="lg" block className="mt-6" onClick={submit} loading={submitting} disabled={!payment} icon={<Lock className="h-4 w-4" />}>
              Confirmar compra
            </Button>
            <p className="mt-3 flex items-start gap-2 text-xs text-grafite/65">
              <ShieldCheck className="h-4 w-4 shrink-0 text-folha" /> Enquanto o pagamento estiver pendente, a vaca fica reservada para você e sai da vitrine.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

interface RadioCardsProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description: string; icon: typeof QrCode }[];
}

function RadioCards({ name, value, onChange, options }: RadioCardsProps) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup">
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${checked ? 'border-folha bg-folha/10' : 'border-transparent bg-white/50 hover:bg-white/80'}`}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${checked ? 'bg-folha text-white' : 'bg-pasto/10 text-pasto'}`}>
              <o.icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-grafite/65">{o.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

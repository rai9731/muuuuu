import { Link } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, Handshake, Plus, ShoppingBag, Tractor, TriangleAlert } from 'lucide-react';
import { orderService } from '@services/orderService';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { LinkButton } from '@components/ui/Button';
import { EmptyState, ErrorState, GlassCard, ListSkeleton, PageHeader, StatCard, StatusBadge } from '@components/ui/Display';
import { CowPlaceholder } from '@components/cow/CowPlaceholder';
import { COW_STATUS, ORDER_STATUS } from '@utils/constants';
import { formatCurrency, formatDate, formatNumber } from '@utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => orderService.dashboard(), []);

  return (
    <div>
      <PageHeader
        title={`Olá, ${user?.name.split(' ')[0]}!`}
        description="Acompanhe seus anúncios, compras e vendas."
        actions={<LinkButton to="/minhas-vacas/nova" variant="cta" icon={<Plus className="h-4 w-4" />}>Anunciar nova vaca</LinkButton>}
      />

      {user && !user.profile_complete && (
        <GlassCard className="mb-6 flex flex-col gap-3 border-l-4 border-l-trigo sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-trigo-dark" aria-hidden />
            <div>
              <p className="font-semibold">Complete seu cadastro</p>
              <p className="text-sm text-grafite/75">Para anunciar e comprar, informe CPF/CNPJ, telefone, cidade e estado.</p>
            </div>
          </div>
          <LinkButton to="/perfil?completar=1" variant="outline" size="sm">Completar agora</LinkButton>
        </GlassCard>
      )}

      {error ? (
        <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Vacas anunciadas" value={loading ? '—' : formatNumber(data?.stats.cows_listed)} icon={<Tractor className="h-5 w-5" />} />
            <StatCard label="Vacas vendidas" value={loading ? '—' : formatNumber(data?.stats.cows_sold)} icon={<Handshake className="h-5 w-5" />} tone="folha" />
            <StatCard label="Compras realizadas" value={loading ? '—' : formatNumber(data?.stats.purchases)} icon={<ShoppingBag className="h-5 w-5" />} tone="terra" />
            <StatCard label="Valor total vendido" value={loading ? '—' : formatCurrency(data?.stats.total_sold)} icon={<BadgeDollarSign className="h-5 w-5" />} tone="trigo" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <GlassCard>
              <SectionHead title="Últimos anúncios" to="/minhas-vacas" />
              {loading ? (
                <ListSkeleton rows={4} />
              ) : !data?.latest_cows.length ? (
                <EmptyState
                  title="Você ainda não anunciou nenhuma vaca"
                  description="Publique seu primeiro anúncio e alcance compradores de todo o Brasil."
                  action={<LinkButton to="/minhas-vacas/nova" size="sm" icon={<Plus className="h-4 w-4" />}>Anunciar nova vaca</LinkButton>}
                />
              ) : (
                <ul className="divide-y divide-pasto/10">
                  {data.latest_cows.map((cow) => (
                    <li key={cow.id}>
                      <Link to={`/minhas-vacas/${cow.id}/editar`} className="flex items-center gap-3 rounded-xl py-3 transition hover:bg-white/40">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                          {cow.cover_thumb_url ? <img src={cow.cover_thumb_url} alt="" className="h-full w-full object-cover" /> : <CowPlaceholder />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{cow.title}</p>
                          <p className="text-xs text-grafite/60">{cow.breed?.name} · {formatCurrency(cow.price)}</p>
                        </div>
                        <StatusBadge map={COW_STATUS} value={cow.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            <GlassCard>
              <SectionHead title="Últimas negociações" to="/minhas-compras" />
              {loading ? (
                <ListSkeleton rows={4} />
              ) : !data?.latest_deals.length ? (
                <EmptyState illustration="cart" title="Nenhuma negociação ainda" description="Suas compras e vendas aparecem aqui." action={<LinkButton to="/anuncios" size="sm" variant="outline">Explorar anúncios</LinkButton>} />
              ) : (
                <ul className="divide-y divide-pasto/10">
                  {data.latest_deals.map((order) => {
                    const isBuyer = order.buyer.id === user?.id;
                    return (
                      <li key={order.id}>
                        <Link to={isBuyer ? `/minhas-compras/${order.id}` : '/minhas-vendas'} className="flex items-center gap-3 rounded-xl py-3 transition hover:bg-white/40">
                          <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${isBuyer ? 'bg-terra/15 text-terra' : 'bg-folha/15 text-pasto'}`}>
                            {isBuyer ? 'Compra' : 'Venda'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{order.cow.title}</p>
                            <p className="text-xs text-grafite/60">#{order.code} · {formatDate(order.created_at)} · {formatCurrency(order.total)}</p>
                          </div>
                          <StatusBadge map={ORDER_STATUS} value={order.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}

function SectionHead({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-pasto hover:text-folha">
        Ver todos <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

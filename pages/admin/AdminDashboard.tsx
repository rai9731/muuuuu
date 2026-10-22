import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Banknote, Clock, Percent, ShoppingBag, Tractor, Users, Wallet } from 'lucide-react';
import { adminService } from '@services/adminService';
import { useAuth } from '@hooks/useAuth';
import { useAsync } from '@hooks/useAsync';
import { Input } from '@components/ui/Field';
import { ErrorState, GlassCard, Skeleton, StatCard, StatusBadge } from '@components/ui/Display';
import { ChartCard, DonutChart, NoData, RankBars, TrendChart } from '@components/admin/charts';
import { PAYMENT_METHODS, PAYMENT_STATUS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminService.dashboard({ from: from || undefined, to: to || undefined }), [from, to]);

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;
  const k = data?.kpis;
  const avgTicket = k && k.cows_sold ? k.revenue / k.cows_sold : 0;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pasto via-folha to-pasto-dark p-6 text-white shadow-glass-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-trigo/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-white/75">Painel administrativo</p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Olá, {user?.name.split(' ')[0]} 🐮</h1>
            <p className="mt-2 max-w-lg text-white/80">
              {k ? <>A plataforma tem <strong>{k.users}</strong> usuários e <strong>{k.cows_listed}</strong> anúncios ativos.</> : 'Carregando a visão geral da plataforma…'}
            </p>
          </div>
          <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-2">
            <Input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-white/70">até</span>
            <Input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </section>

      {loading || !k || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          {k.pending_listings > 0 && (
            <Link to="/admin/anuncios" className="glass flex items-center gap-3 rounded-2xl border-trigo/50 px-5 py-3 text-sm transition hover:bg-white/80">
              <AlertTriangle className="h-5 w-5 shrink-0 text-trigo-dark" aria-hidden />
              <span className="flex-1"><strong>{k.pending_listings}</strong> anúncio{k.pending_listings > 1 ? 's' : ''} aguardando sua análise.</span>
              <span className="inline-flex items-center gap-1 font-semibold text-pasto">Moderar <ArrowRight className="h-4 w-4" /></span>
            </Link>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Receita (GMV)" value={formatCurrency(k.revenue)} icon={<Banknote className="h-5 w-5" />} />
            <StatCard label="Comissões" value={formatCurrency(k.commissions)} icon={<Percent className="h-5 w-5" />} tone="folha" />
            <StatCard label="Ticket médio" value={formatCurrency(avgTicket)} icon={<Wallet className="h-5 w-5" />} tone="terra" />
            <StatCard label="Pagamentos pendentes" value={k.pending_payments} icon={<Clock className="h-5 w-5" />} tone="trigo" hint={formatCurrency(k.pending_payments_amount)} />
            <StatCard label="Usuários" value={k.users} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Anúncios ativos" value={k.cows_listed} icon={<Tractor className="h-5 w-5" />} tone="folha" />
            <StatCard label="Vendas concluídas" value={k.cows_sold} icon={<ShoppingBag className="h-5 w-5" />} tone="terra" />
            <StatCard label="Aguardando análise" value={k.pending_listings} icon={<Clock className="h-5 w-5" />} tone="trigo" hint="Anúncios pendentes" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Vendas por mês" subtitle="Receita (área) e nº de vendas (linha)">
              {data.sales_by_month.length
                ? <TrendChart data={data.sales_by_month} area={{ key: 'total', name: 'Receita' }} line={{ key: 'count', name: 'Vendas' }} />
                : <NoData>Sem vendas no período.</NoData>}
            </ChartCard>
            <ChartCard title="Anúncios" subtitle="Situação da vitrine">
              <DonutChart
                data={[
                  { status: 'Ativos', total: k.cows_listed },
                  { status: 'Em análise', total: k.pending_listings },
                  { status: 'Vendidos', total: k.cows_sold },
                ]}
                nameKey="status" valueKey="total" centerLabel="anúncios"
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Vendas por raça" subtitle="Participação no total de vendas">
              {data.sales_by_breed.length ? <DonutChart data={data.sales_by_breed.slice(0, 6)} nameKey="breed" valueKey="count" centerLabel="vendas" /> : <NoData />}
            </ChartCard>
            <ChartCard title="Receita por estado" subtitle="Onde a plataforma mais fatura">
              {data.sales_by_state.length ? <RankBars data={data.sales_by_state.slice(0, 7)} nameKey="state" valueKey="total" name="Receita" money /> : <NoData />}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard title="Últimas vendas" to="/admin/vendas" link="Ver todas" empty={!data.latest_sales.length && 'Nenhuma venda ainda.'}>
              {data.latest_sales.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/admin/vendas/${o.id}`} className="min-w-0 truncate font-medium hover:underline">#{o.code} · {o.cow.title}</Link>
                  <span className="shrink-0 font-semibold">{formatCurrency(o.total)}</span>
                </li>
              ))}
            </ListCard>
            <ListCard title="Últimos pagamentos" to="/admin/pagamentos" link="Ver todos" empty={!data.latest_payments.length && 'Nenhum pagamento ainda.'}>
              {data.latest_payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0"><span className="block truncate font-medium">{p.payer.name}</span><span className="text-xs text-grafite/60">{PAYMENT_METHODS[p.method]} · {formatCurrency(p.amount)}</span></span>
                  <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                </li>
              ))}
            </ListCard>
            <ListCard title="Últimos anúncios" to="/admin/anuncios" link="Moderar" empty={!data.latest_cows.length && 'Nenhum anúncio ainda.'}>
              {data.latest_cows.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0"><span className="block truncate font-medium">{c.title}</span><span className="text-xs text-grafite/60">{c.seller?.name}</span></span>
                  <span className="shrink-0 text-xs text-grafite/60">{formatDate(c.created_at)}</span>
                </li>
              ))}
            </ListCard>
          </div>
        </>
      )}
    </div>
  );
}

function ListCard({ title, to, link, empty, children }: { title: string; to: string; link: string; empty: string | false; children: React.ReactNode }) {
  return (
    <GlassCard>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">{title}</h2>
        <Link to={to} className="text-sm font-semibold text-pasto hover:underline">{link}</Link>
      </div>
      <ul className="divide-y divide-pasto/10 text-sm">
        {children}
        {empty && <li className="py-3 text-grafite/60">{empty}</li>}
      </ul>
    </GlassCard>
  );
}

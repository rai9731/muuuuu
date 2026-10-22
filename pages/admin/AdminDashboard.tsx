import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, Clock, Percent, ShoppingBag, Tractor, Users } from 'lucide-react';
import { adminService } from '@services/adminService';
import { useAsync } from '@hooks/useAsync';
import { Input } from '@components/ui/Field';
import { ErrorState, GlassCard, PageHeader, Skeleton, StatCard } from '@components/ui/Display';
import { formatCurrency, formatDate } from '@utils/format';

export default function AdminDashboard() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminService.dashboard({ from: from || undefined, to: to || undefined }), [from, to]);

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;
  const k = data?.kpis;

  return (
    <div>
      <PageHeader
        title="Painel administrativo"
        description="Visão geral da plataforma."
        actions={
          <div className="flex gap-2">
            <Input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />
      {loading || !k ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Usuários" value={k.users} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Anúncios ativos" value={k.cows_listed} icon={<Tractor className="h-5 w-5" />} tone="folha" />
            <StatCard label="Vendas concluídas" value={k.cows_sold} icon={<ShoppingBag className="h-5 w-5" />} tone="terra" />
            <StatCard label="Aguardando análise" value={k.pending_listings} icon={<Clock className="h-5 w-5" />} tone="trigo" hint="Anúncios pendentes" />
            <StatCard label="Receita (GMV)" value={formatCurrency(k.revenue)} icon={<Banknote className="h-5 w-5" />} />
            <StatCard label="Comissões" value={formatCurrency(k.commissions)} icon={<Percent className="h-5 w-5" />} tone="folha" />
            <StatCard label="Pagamentos pendentes" value={k.pending_payments} icon={<Clock className="h-5 w-5" />} tone="trigo" hint={formatCurrency(k.pending_payments_amount)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h2 className="mb-3 font-bold">Vendas por mês</h2>
              {data!.sales_by_month.length ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={data!.sales_by_month}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="total" name="Total" fill="#2f6b3a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-grafite/60">Sem vendas no período.</p>}
            </GlassCard>
            <GlassCard>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Últimas vendas</h2><Link to="/admin/vendas" className="text-sm text-pasto underline">Ver todas</Link></div>
              <ul className="divide-y divide-pasto/10 text-sm">
                {data!.latest_sales.map((o) => (
                  <li key={o.id} className="flex justify-between py-2"><Link to={`/admin/vendas/${o.id}`} className="font-medium hover:underline">#{o.code} · {o.cow.title}</Link><span>{formatCurrency(o.total)}</span></li>
                ))}
                {!data!.latest_sales.length && <li className="py-2 text-grafite/60">Nenhuma venda ainda.</li>}
              </ul>
            </GlassCard>
            <GlassCard className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Últimos anúncios</h2><Link to="/admin/anuncios" className="text-sm text-pasto underline">Moderar</Link></div>
              <ul className="divide-y divide-pasto/10 text-sm">
                {data!.latest_cows.map((c) => (
                  <li key={c.id} className="flex justify-between py-2"><span>{c.title} <span className="text-grafite/60">· {c.seller?.name}</span></span><span className="text-grafite/60">{formatDate(c.created_at)}</span></li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { adminService } from '@services/adminService';
import { useAsync } from '@hooks/useAsync';
import { ErrorState, GlassCard, PageHeader, Skeleton, StatCard } from '@components/ui/Display';
import { ChartCard, DonutChart, GroupedBars, NoData, TrendChart } from '@components/admin/charts';
import { Input } from '@components/ui/Field';
import { formatCurrency } from '@utils/format';

export default function AdminReports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminService.reports({ from: from || undefined, to: to || undefined }), [from, to]);

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;

  return (
    <div>
      <PageHeader title="Relatórios" description="Desempenho de vendas por período."
        actions={<div className="flex gap-2"><Input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} /></div>} />
      {loading || !data ? <Skeleton className="h-64" /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Receita" value={formatCurrency(data.summary.revenue)} icon="R$" />
            <StatCard label="Comissões" value={formatCurrency(data.summary.commissions)} icon="%" tone="folha" />
            <StatCard label="Vendas" value={data.summary.sales} icon="#" tone="terra" />
            <StatCard label="Ticket médio" value={formatCurrency(data.summary.average_ticket)} icon="Ø" tone="trigo" />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Receita e comissões por mês">
              {data.by_period.length
                ? <GroupedBars data={data.by_period} series={[{ key: 'total', name: 'Receita', color: '#2f5d3a' }, { key: 'commissions', name: 'Comissões', color: '#d9a441' }]} />
                : <NoData />}
            </ChartCard>
            <ChartCard title="Raças mais vendidas">
              {data.top_breeds.length ? <DonutChart data={data.top_breeds.slice(0, 6)} nameKey="breed" valueKey="count" centerLabel="vendas" /> : <NoData />}
            </ChartCard>
          </div>
          <ChartCard title="Evolução das vendas" subtitle="Receita (área) e nº de vendas (linha)">
            {data.by_period.length ? <TrendChart data={data.by_period} area={{ key: 'total', name: 'Receita' }} line={{ key: 'count', name: 'Vendas' }} height={240} /> : <NoData />}
          </ChartCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h2 className="mb-2 font-bold">Maiores vendedores</h2>
              <ul className="divide-y divide-pasto/10 text-sm">
                {data.top_users.map((u) => <li key={u.id} className="flex justify-between py-2"><span>{u.name} <span className="text-grafite/60">· {u.sales} vendas</span></span><span className="font-semibold">{formatCurrency(u.total_sold)}</span></li>)}
                {!data.top_users.length && <li className="py-2 text-grafite/60">Sem dados.</li>}
              </ul>
            </GlassCard>
            <GlassCard>
              <h2 className="mb-2 font-bold">Raças mais vendidas</h2>
              <ul className="divide-y divide-pasto/10 text-sm">
                {data.top_breeds.map((b) => <li key={b.breed} className="flex justify-between py-2"><span>{b.breed} <span className="text-grafite/60">· {b.count}</span></span><span className="font-semibold">{formatCurrency(b.total)}</span></li>)}
                {!data.top_breeds.length && <li className="py-2 text-grafite/60">Sem dados.</li>}
              </ul>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminService } from '@services/adminService';
import { useAsync } from '@hooks/useAsync';
import { ErrorState, GlassCard, PageHeader, Skeleton, StatCard } from '@components/ui/Display';
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
          <GlassCard>
            <h2 className="mb-3 font-bold">Receita e comissões por mês</h2>
            {data.by_period.length ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={data.by_period}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="total" name="Receita" fill="#2f6b3a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="commissions" name="Comissões" fill="#d9a441" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-grafite/60">Sem dados no período.</p>}
          </GlassCard>
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

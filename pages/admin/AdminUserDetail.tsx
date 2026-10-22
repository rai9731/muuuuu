import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, KeyRound, ShieldCheck } from 'lucide-react';
import { adminService } from '@services/adminService';
import { errorMessage } from '@services/api';
import { useAsync } from '@hooks/useAsync';
import { useToast } from '@hooks/useToast';
import { Button } from '@components/ui/Button';
import { ConfirmDialog } from '@components/ui/ConfirmDialog';
import { Avatar, ErrorState, GlassCard, PageHeader, Skeleton, StatusBadge } from '@components/ui/Display';
import { Input } from '@components/ui/Field';
import { COW_STATUS, ORDER_STATUS, USER_STATUS } from '@utils/constants';
import { formatCurrency, formatDate } from '@utils/format';

export default function AdminUserDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminService.user(id!), [id]);
  const [confirm, setConfirm] = useState<'block' | 'unblock' | 'reset' | null>(null);
  const [password, setPassword] = useState('');

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;
  if (loading || !data) return <Skeleton className="h-64" />;
  const { user: u } = data;

  const run = async () => {
    try {
      const res =
        confirm === 'block' ? await adminService.blockUser(u.id)
        : confirm === 'unblock' ? await adminService.unblockUser(u.id)
        : await adminService.resetPassword(u.id, password);
      toast.success(res.message);
      setConfirm(null);
      setPassword('');
      reload();
    } catch (err) {
      toast.error('Não foi possível concluir', errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={u.name} description={u.email}
        actions={<>
          <Button variant="outline" icon={<KeyRound className="h-4 w-4" />} onClick={() => setConfirm('reset')}>Senha provisória</Button>
          {u.status === 'active'
            ? <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setConfirm('block')}>Bloquear</Button>
            : <Button icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setConfirm('unblock')}>Desbloquear</Button>}
        </>} />
      <GlassCard className="flex flex-wrap items-center gap-4">
        <Avatar name={u.name} src={u.avatar_url} size="lg" />
        <dl className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-grafite/60">Status</dt><dd><StatusBadge map={USER_STATUS} value={u.status} /></dd></div>
          <div><dt className="text-xs text-grafite/60">Documento</dt><dd>{u.document ?? '—'}</dd></div>
          <div><dt className="text-xs text-grafite/60">Telefone</dt><dd>{u.phone ?? '—'}</dd></div>
          <div><dt className="text-xs text-grafite/60">Local</dt><dd>{u.city ? `${u.city}/${u.state}` : '—'}</dd></div>
          <div><dt className="text-xs text-grafite/60">Fazenda</dt><dd>{u.farm_name ?? '—'}</dd></div>
          <div><dt className="text-xs text-grafite/60">Cadastro</dt><dd>{formatDate(u.created_at)}</dd></div>
        </dl>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-2 font-bold">Anúncios ({data.cows.length})</h2>
        <ul className="divide-y divide-pasto/10 text-sm">
          {data.cows.map((c) => <li key={c.id} className="flex items-center justify-between py-2"><span>{c.title}</span><span className="flex items-center gap-3">{formatCurrency(c.price)}<StatusBadge map={COW_STATUS} value={c.status} /></span></li>)}
          {!data.cows.length && <li className="py-2 text-grafite/60">Nenhum anúncio.</li>}
        </ul>
      </GlassCard>
      {([['Compras', data.purchases], ['Vendas', data.sales]] as const).map(([label, orders]) => (
        <GlassCard key={label}>
          <h2 className="mb-2 font-bold">{label} ({orders.length})</h2>
          <ul className="divide-y divide-pasto/10 text-sm">
            {orders.map((o) => <li key={o.id} className="flex items-center justify-between py-2"><Link to={`/admin/vendas/${o.id}`} className="hover:underline">#{o.code} · {o.cow.title}</Link><span className="flex items-center gap-3">{formatCurrency(o.total)}<StatusBadge map={ORDER_STATUS} value={o.status} /></span></li>)}
            {!orders.length && <li className="py-2 text-grafite/60">Nada por aqui.</li>}
          </ul>
        </GlassCard>
      ))}

      <ConfirmDialog open={confirm === 'block' || confirm === 'unblock'} onClose={() => setConfirm(null)} onConfirm={run}
        tone={confirm === 'block' ? 'danger' : 'primary'} confirmLabel={confirm === 'block' ? 'Bloquear' : 'Desbloquear'}
        title={confirm === 'block' ? 'Bloquear usuário?' : 'Desbloquear usuário?'}
        description={confirm === 'block' ? 'Ele será desconectado e não poderá entrar.' : 'Ele poderá acessar a conta novamente.'} />
      <ConfirmDialog open={confirm === 'reset'} onClose={() => setConfirm(null)} onConfirm={run} title="Definir senha provisória" confirmLabel="Definir" confirmDisabled={password.length < 6}
        description="No próximo acesso o usuário será obrigado a trocar a senha.">
        <Input label="Senha provisória" type="text" value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo de 6 caracteres." />
      </ConfirmDialog>
    </div>
  );
}

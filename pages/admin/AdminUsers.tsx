import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, type AdminUserRow } from '@services/adminService';
import { useAsync } from '@hooks/useAsync';
import { DataTable, type Column } from '@components/ui/DataTable';
import { Avatar, EmptyState, ErrorState, GlassCard, PageHeader, Pagination, StatusBadge, Tabs } from '@components/ui/Display';
import { Input } from '@components/ui/Field';
import { USER_STATUS } from '@utils/constants';
import { formatDate } from '@utils/format';

const TABS = [{ value: '', label: 'Todos' }, { value: 'active', label: 'Ativos' }, { value: 'blocked', label: 'Bloqueados' }];

export default function AdminUsers() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => adminService.users({ status: status || undefined, search: search || undefined, page }), [status, search, page]);

  const columns: Column<AdminUserRow>[] = [
    { key: 'name', header: 'Usuário', primary: true, render: (u) => (
      <div className="flex items-center gap-2"><Avatar name={u.name} src={u.avatar_url} size="sm" /><div><p className="font-semibold">{u.name}</p><p className="text-xs text-grafite/60">{u.email}</p></div></div>
    ) },
    { key: 'city', header: 'Local', render: (u) => (u.city ? `${u.city}/${u.state}` : '—') },
    { key: 'cows', header: 'Anúncios', render: (u) => u.cows_count },
    { key: 'sales', header: 'Vendas', render: (u) => u.sales_count },
    { key: 'purchases', header: 'Compras', render: (u) => u.purchases_count },
    { key: 'since', header: 'Desde', render: (u) => formatDate(u.created_at), hideOnMobile: true },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge map={USER_STATUS} value={u.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Usuários" description="Gerencie contas de compradores e vendedores." />
      <div className="mb-4 space-y-3">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} />
        <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error ? <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard> : (
        <>
          <DataTable columns={columns} rows={data?.data ?? []} rowKey={(u) => u.id} loading={loading} onRowClick={(u) => navigate(`/admin/usuarios/${u.id}`)}
            empty={<EmptyState title="Nenhum usuário encontrado" />} />
          {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

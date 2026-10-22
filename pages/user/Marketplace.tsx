import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { cowService, type CowFilters as Filters } from '@services/cowService';
import { useAsync } from '@hooks/useAsync';
import { useDebounce } from '@hooks/useDebounce';
import { CowCard } from '@components/cow/CowCard';
import { CowFilters } from '@components/cow/CowFilters';
import { Modal } from '@components/ui/Modal';
import { Button } from '@components/ui/Button';
import { CardGridSkeleton, EmptyState, ErrorState, GlassCard, PageHeader, Pagination } from '@components/ui/Display';
import { Input, Select } from '@components/ui/Field';

const FILTER_KEYS: (keyof Filters)[] = ['breed_id', 'purpose', 'price_min', 'price_max', 'age_min', 'age_max', 'weight_min', 'weight_max', 'state', 'city', 'pregnant', 'sort'];

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounce(search, 450);

  const filters = useMemo<Filters>(() => {
    const f: Filters = { page: Number(params.get('page') ?? 1) };
    FILTER_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) (f as Record<string, string | number>)[k] = v;
    });
    return f;
  }, [params]);

  const query = useMemo(() => ({ ...filters, search: debouncedSearch || undefined }), [filters, debouncedSearch]);
  const { data, loading, error, reload } = useAsync((signal) => cowService.list(query, signal), [JSON.stringify(query)]);

  const update = (next: Filters) => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    Object.entries(next).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && !(k === 'page' && Number(v) === 1)) p.set(k, String(v));
    });
    setParams(p);
    setMobileFilters(false);
  };

  const reset = () => {
    setSearch('');
    setParams(new URLSearchParams());
    setMobileFilters(false);
  };

  const activeCount = FILTER_KEYS.filter((k) => k !== 'sort' && filters[k]).length;

  return (
    <div>
      <PageHeader title="Marketplace" description="Encontre vacas de leite, corte e reprodução de produtores de todo o Brasil." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <form className="flex-1" role="search" onSubmit={(e) => e.preventDefault()}>
          <Input
            aria-label="Buscar por título, raça ou cidade"
            placeholder="Buscar por título, raça ou cidade…"
            icon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <div className="flex gap-2">
          <Select
            aria-label="Ordenar por"
            value={filters.sort ?? 'recent'}
            onChange={(e) => update({ ...filters, sort: e.target.value, page: 1 })}
            options={[
              { value: 'recent', label: 'Mais recentes' },
              { value: 'price_asc', label: 'Menor preço' },
              { value: 'price_desc', label: 'Maior preço' },
            ]}
            wrapperClassName="flex-1 sm:w-48"
          />
          <Button variant="outline" className="lg:hidden" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setMobileFilters(true)}>
            Filtros{activeCount ? ` (${activeCount})` : ''}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <GlassCard className="sticky top-24">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-4 w-4 text-pasto" /> Filtros</h2>
            <CowFilters value={filters} onChange={update} onReset={reset} />
          </GlassCard>
        </aside>

        <section className="min-w-0 flex-1" aria-live="polite">
          {error ? (
            <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>
          ) : loading && !data ? (
            <CardGridSkeleton />
          ) : !data?.data.length ? (
            <GlassCard>
              <EmptyState
                illustration="search"
                title="Nenhuma vaca encontrada"
                description="Tente remover alguns filtros ou buscar por outro termo."
                action={<Button variant="outline" onClick={reset}>Limpar filtros</Button>}
              />
            </GlassCard>
          ) : (
            <>
              <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60 transition' : ''}`}>
                {data.data.map((cow) => <CowCard key={cow.id} cow={cow} />)}
              </div>
              <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={(page) => update({ ...filters, page })} />
            </>
          )}
        </section>
      </div>

      <Modal open={mobileFilters} onClose={() => setMobileFilters(false)} title="Filtros">
        <CowFilters value={filters} onChange={update} onReset={reset} />
      </Modal>
    </div>
  );
}

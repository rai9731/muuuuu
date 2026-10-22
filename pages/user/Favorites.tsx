import { useState } from 'react';
import { cowService } from '@services/cowService';
import { useAsync } from '@hooks/useAsync';
import { LinkButton } from '@components/ui/Button';
import { CardGridSkeleton, EmptyState, ErrorState, GlassCard, PageHeader, Pagination } from '@components/ui/Display';
import { CowCard } from '@components/cow/CowCard';

export default function Favorites() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload, setData } = useAsync(() => cowService.favorites(page), [page]);

  return (
    <div>
      <PageHeader title="Favoritos" description="As vacas que você salvou para ver depois." />
      {error ? (
        <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>
      ) : loading ? (
        <CardGridSkeleton count={3} />
      ) : !data?.data.length ? (
        <GlassCard>
          <EmptyState
            title="Nenhuma vaca favorita ainda"
            description="Toque no coração dos anúncios para salvá-los aqui."
            action={<LinkButton to="/anuncios">Explorar anúncios</LinkButton>}
          />
        </GlassCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((cow) => (
              <CowCard
                key={cow.id}
                cow={{ ...cow, is_favorite: true }}
                onFavoriteChange={(c, fav) => !fav && setData((prev) => ({ ...prev!, data: prev!.data.filter((x) => x.id !== c.id) }))}
              />
            ))}
          </div>
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

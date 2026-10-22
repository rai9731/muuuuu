import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Heart, MapPin, Scale, Timer } from 'lucide-react';
import type { Cow } from '@services/types';
import { cowService } from '@services/cowService';
import { errorMessage } from '@services/api';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { formatAge, formatCurrency, formatWeight } from '@utils/format';
import { PURPOSE_LABELS } from '@utils/constants';
import { CowPlaceholder } from './CowPlaceholder';

interface CowCardProps {
  cow: Cow;
  onFavoriteChange?: (cow: Cow, favorite: boolean) => void;
  compact?: boolean;
}

export function CowCard({ cow, onFavoriteChange, compact }: CowCardProps) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [favorite, setFavorite] = useState(!!cow.is_favorite);
  const [busy, setBusy] = useState(false);

  const toggleFavorite = async () => {
    if (!user) {
      toast.info('Entre para favoritar', 'Crie sua conta gratuita ou faça login para salvar vacas favoritas.');
      navigate('/entrar', { state: { from: `/anuncios/${cow.id}` } });
      return;
    }
    setBusy(true);
    try {
      const res = await cowService.toggleFavorite(cow.id);
      setFavorite(res.favorite);
      onFavoriteChange?.(cow, res.favorite);
      toast.success(res.favorite ? 'Adicionada aos favoritos' : 'Removida dos favoritos');
    } catch (err) {
      toast.error('Não foi possível atualizar os favoritos', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="glass hover-lift group relative flex h-full flex-col overflow-hidden rounded-3xl">
      <Link to={`/anuncios/${cow.id}`} className="block" aria-label={`Ver anúncio: ${cow.title}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          {cow.cover_thumb_url ? (
            <img
              src={cow.cover_thumb_url}
              alt={`Foto de ${cow.title}`}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <CowPlaceholder />
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {cow.verified && (
              <span className="glass-strong inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-pasto">
                <BadgeCheck className="h-3.5 w-3.5" /> Verificado
              </span>
            )}
            <span className="rounded-full bg-grafite/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              {PURPOSE_LABELS[cow.purpose]}
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={busy}
        className="glass-strong absolute right-3 top-3 rounded-full p-2 transition hover:scale-110"
        aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-pressed={favorite}
      >
        <Heart className={`h-4 w-4 ${favorite ? 'fill-red-500 text-red-500' : 'text-grafite'}`} />
      </button>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-terra">{cow.breed?.name}</p>
        <Link to={`/anuncios/${cow.id}`} className="mt-0.5 line-clamp-1 font-semibold text-grafite hover:text-pasto">
          {cow.title}
        </Link>
        {!compact && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-grafite/75">
            <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-folha" aria-hidden /> {formatAge(cow.age_months)}</span>
            <span className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 text-folha" aria-hidden /> {formatWeight(cow.weight_kg)}</span>
            <span className="col-span-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-folha" aria-hidden /> {cow.city}/{cow.state}</span>
          </div>
        )}
        <p className="mt-auto pt-3 text-xl font-bold text-pasto">{formatCurrency(cow.price)}</p>
      </div>
    </article>
  );
}

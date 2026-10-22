import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import type { Media } from '@services/types';
import { CowPlaceholder } from './CowPlaceholder';

interface CowGalleryProps {
  title: string;
  photos: Media[];
  video: Media | null;
}

export function CowGallery({ title, photos, video }: CowGalleryProps) {
  const items = [...photos, ...(video ? [video] : [])];
  const [index, setIndex] = useState(0);
  const current = items[index];

  useEffect(() => setIndex(0), [photos.length, video?.id]);

  if (!items.length) {
    return (
      <div className="glass aspect-[4/3] overflow-hidden rounded-3xl">
        <CowPlaceholder />
      </div>
    );
  }

  const go = (delta: number) => setIndex((i) => (i + delta + items.length) % items.length);

  return (
    <div>
      <div className="glass relative aspect-[4/3] overflow-hidden rounded-3xl bg-grafite/5">
        {current.type === 'video' ? (
          <video key={current.id} src={current.url} controls className="h-full w-full bg-black object-contain">
            Seu navegador não reproduz vídeos.
          </video>
        ) : (
          <img src={current.url} alt={`${title} — foto ${index + 1} de ${photos.length}`} className="h-full w-full object-cover" />
        )}
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="glass-strong absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 transition hover:scale-110" aria-label="Foto anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="glass-strong absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 transition hover:scale-110" aria-label="Próxima foto">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-grafite/60 px-2.5 py-1 text-xs font-medium text-white">
              {index + 1}/{items.length}
            </span>
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition ${i === index ? 'ring-folha' : 'ring-transparent opacity-75 hover:opacity-100'}`}
              aria-label={item.type === 'video' ? 'Ver vídeo' : `Ver foto ${i + 1}`}
            >
              {item.type === 'video' ? (
                <span className="flex h-full w-full items-center justify-center bg-grafite text-white"><PlayCircle className="h-6 w-6" /></span>
              ) : (
                <img src={item.thumb_url ?? item.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

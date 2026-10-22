import { Check } from 'lucide-react';
import type { TimelineEvent } from '@services/types';
import { formatDateTime } from '@utils/format';

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-5">
      {events.map((event, index) => (
        <li key={event.status} className="relative flex gap-3">
          {index < events.length - 1 && (
            <span className={`absolute left-[15px] top-8 h-[calc(100%-4px)] w-0.5 ${event.done ? 'bg-folha' : 'bg-pasto/15'}`} aria-hidden />
          )}
          <span
            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              event.done ? (event.status === 'cancelled' ? 'bg-red-500 text-white' : 'bg-folha text-white') : 'bg-white/80 text-grafite/40 ring-1 ring-pasto/15'
            }`}
          >
            {event.done ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
          </span>
          <div className="pt-1">
            <p className={`text-sm font-semibold ${event.done ? 'text-grafite' : 'text-grafite/50'}`}>{event.label}</p>
            <p className="text-xs text-grafite/60">{event.date ? formatDateTime(event.date) : 'Aguardando'}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

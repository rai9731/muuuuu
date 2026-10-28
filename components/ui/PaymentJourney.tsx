import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { JourneyStep } from '@services/types';

/** Etapas da jornada de pagamento. `checking` força a etapa "Conferindo pagamento" como em andamento. */
export function PaymentJourney({ steps, checking = false }: { steps: JourneyStep[]; checking?: boolean }) {
  return (
    <ol className="space-y-3" aria-label="Etapas do pagamento">
      {steps.map((s) => {
        const state = checking && s.key === 'checking' ? 'current' : s.state;
        const icon =
          state === 'done' ? <Check className="h-4 w-4" /> :
          state === 'warning' ? <AlertTriangle className="h-4 w-4" /> :
          state === 'current' ? (checking && s.key === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-current" />) :
          <span className="h-2 w-2 rounded-full bg-current" />;
        const circle =
          state === 'done' ? 'bg-folha text-white' :
          state === 'warning' ? 'bg-red-500 text-white' :
          state === 'current' ? 'bg-trigo text-grafite' :
          'bg-white/80 text-grafite/40 ring-1 ring-pasto/15';
        return (
          <li key={s.key} className="flex gap-3" aria-current={state === 'current' ? 'step' : undefined}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${circle}`}>{icon}</span>
            <div className="pt-1">
              <p className={`text-sm font-semibold ${state === 'todo' ? 'text-grafite/50' : 'text-grafite'}`}>{s.label}</p>
              {s.note && state !== 'todo' && <p className="text-xs text-grafite/65">{s.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

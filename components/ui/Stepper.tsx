import { Check } from 'lucide-react';

interface StepperProps {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  const progress = (current / (steps.length - 1)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-grafite/65 sm:hidden">
        <span>Etapa {current + 1} de {steps.length}</span>
        <span className="font-semibold text-pasto">{steps[current]}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-pasto/10 sm:hidden">
        <div className="h-full rounded-full bg-folha transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <ol className="hidden items-center sm:flex">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = onStepClick && index < current;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(index)}
                className="flex items-center gap-2 disabled:cursor-default"
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                    done ? 'bg-folha text-white' : active ? 'bg-pasto text-white ring-4 ring-folha/20' : 'bg-white/70 text-grafite/55'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className={`text-sm font-medium ${active ? 'text-pasto' : done ? 'text-grafite' : 'text-grafite/55'}`}>{label}</span>
              </button>
              {index < steps.length - 1 && (
                <span className={`mx-3 h-0.5 flex-1 rounded-full transition ${done ? 'bg-folha' : 'bg-pasto/15'}`} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { Star } from 'lucide-react';

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-8 w-8' };

export function RatingStars({ value, onChange, size = 'sm' }: RatingStarsProps) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={`Avaliação ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = <Star className={`${SIZES[size]} ${filled ? 'fill-trigo text-trigo' : 'text-grafite/25'}`} aria-hidden />;
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

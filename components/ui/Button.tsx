import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'cta' | 'ghost' | 'danger' | 'glass' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pasto text-white hover:bg-folha shadow-sm',
  secondary: 'bg-palha text-grafite hover:bg-palha/80',
  cta: 'bg-trigo text-grafite hover:bg-trigo-dark hover:text-white shadow-sm',
  ghost: 'text-grafite hover:bg-pasto/10',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  glass: 'glass-dark text-white hover:bg-white/25',
  outline: 'border border-pasto/40 text-pasto hover:bg-pasto/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {}

const base =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] whitespace-nowrap';

export function Button({ variant = 'primary', size = 'md', loading, icon, block, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends CommonProps {
  to: string;
}

export function LinkButton({ to, variant = 'primary', size = 'md', icon, block, className = '', children }: LinkButtonProps) {
  return (
    <Link to={to} className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}>
      {icon}
      {children}
    </Link>
  );
}

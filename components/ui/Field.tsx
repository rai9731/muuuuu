import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const control =
  'w-full rounded-xl border bg-white/70 px-3.5 text-sm text-grafite placeholder:text-grafite/45 transition focus:bg-white focus:outline-none focus:ring-2 disabled:opacity-60';
const stateClass = (error?: string) =>
  error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-pasto/15 focus:border-folha focus:ring-folha/25';

interface WrapperProps {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ id, label, error, hint, required, children, className = '' }: WrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-grafite/90">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-grafite/60">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, wrapperClassName, className = '', id, required, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper id={inputId} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grafite/45">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`${control} ${stateClass(error)} h-11 ${icon ? 'pl-10' : ''} ${className}`}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
});

export function PasswordInput(props: Omit<InputProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <FieldWrapper id={id} label={props.label} error={props.error} hint={props.hint} required={props.required} className={props.wrapperClassName}>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!props.error}
          className={`${control} ${stateClass(props.error)} h-11 pr-11 ${props.className ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-grafite/55 hover:bg-pasto/10 hover:text-pasto"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FieldWrapper>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  placeholder?: string;
  options: { value: string | number; label: string }[];
}

export function Select({ label, error, hint, options, placeholder, wrapperClassName, className = '', id, required, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldWrapper id={selectId} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select
        id={selectId}
        required={required}
        aria-invalid={!!error}
        className={`${control} ${stateClass(error)} h-11 pr-8 ${className}`}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export function Textarea({ label, error, hint, wrapperClassName, className = '', id, required, ...rest }: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <FieldWrapper id={areaId} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea
        id={areaId}
        required={required}
        aria-invalid={!!error}
        className={`${control} ${stateClass(error)} min-h-24 py-2.5 ${className}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
}

export function Checkbox({ label, error, id, className = '', ...rest }: CheckboxProps) {
  const autoId = useId();
  const boxId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={boxId} className="flex cursor-pointer items-start gap-2.5 text-sm text-grafite/85">
        <input
          id={boxId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-pasto/30 accent-pasto"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-grafite">{label}</p>
        {description && <p className="text-xs text-grafite/65">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-folha' : 'bg-grafite/20'} disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

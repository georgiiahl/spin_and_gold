import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, helperText, error, className, id, ...props }, ref) {
  const inputId = id ?? props.name;
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;

  return (
    <label className="block space-y-1.5 text-sm" htmlFor={inputId}>
      {label && <span className="text-slate-200">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full rounded-xl border bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500',
          error ? 'border-red-500' : 'border-slate-700 focus:border-gold-400',
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? <span id={`${inputId}-error`} className="text-xs text-red-400">{error}</span> : helperText ? <span id={`${inputId}-help`} className="text-xs text-slate-400">{helperText}</span> : null}
    </label>
  );
});

export default Input;

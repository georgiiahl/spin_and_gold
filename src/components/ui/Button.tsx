import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-gold-500 to-amber-400 text-slate-950 shadow-lg shadow-gold-900/20 hover:brightness-105',
  secondary: 'border border-slate-500 bg-slate-900 text-slate-100 hover:bg-slate-800',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800',
  danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:brightness-105',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props },
  ref
) {
  return (
    <motion.span
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className="inline-flex"
    >
      <button
        ref={ref}
        type={props.type ?? 'button'}
        {...props}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      >
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
        {children}
      </button>
    </motion.span>
  );
});

export default Button;

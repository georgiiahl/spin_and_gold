import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-700 text-slate-100',
  success: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30',
  error: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30',
};

export default function Badge({ className, variant = 'default', ...props }: Props) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', variantClasses[variant], className)} {...props} />;
}

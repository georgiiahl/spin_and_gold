import { HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

type Props = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
};

export default function Card({ className, hover = false, ...props }: Props) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn('rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-card backdrop-blur', className)}
        {...props}
      />
    </motion.div>
  );
}

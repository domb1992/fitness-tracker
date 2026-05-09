import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'solid' | 'lime' | 'pr' | 'success' | 'warning' | 'danger' | 'info';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const isBanner = ['success', 'warning', 'danger', 'info'].includes(variant);

    if (isBanner) {
      const bannerVariants = {
        success: 'bg-[var(--success)] text-white shadow-lg shadow-oklch(var(--success)/0.2)',
        warning: 'bg-[var(--warning)] text-white shadow-lg shadow-oklch(var(--warning)/0.2)',
        danger: 'bg-[var(--danger)] text-white shadow-lg shadow-oklch(var(--danger)/0.2)',
        info: 'bg-[var(--ink)] text-[var(--paper)]',
      };

      return (
        <div
          ref={ref as any}
          className={cn(
            'px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest rounded-2xl flex items-center gap-3 animate-slide-up',
            bannerVariants[variant as keyof typeof bannerVariants],
            className
          )}
          {...props as any}
        />
      );
    }

    const variants = {
      default: 'bg-[var(--paper-2)] text-[var(--ink-2)] border border-[var(--border)]',
      solid: 'bg-[var(--ink)] text-[var(--paper)]',
      lime: 'bg-[var(--lime)] text-[var(--lime-ink)] font-bold',
      pr: 'bg-[var(--lime)] text-[var(--lime-ink)] text-[9px] px-2 py-0.5 rounded-md font-black shadow-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider',
          variants[variant as keyof typeof variants],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

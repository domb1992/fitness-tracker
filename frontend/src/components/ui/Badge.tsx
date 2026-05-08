import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'solid' | 'lime' | 'pr' | 'success' | 'warning' | 'danger' | 'info';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    if (['success', 'warning', 'danger', 'info'].includes(variant)) {
      const bannerClass = variant === 'info' ? 'banner-info' : `banner-${variant}`;
      return (
        <div
          ref={ref as any}
          className={cn('banner rounded-[var(--r-1)]', bannerClass, className)}
          {...props as any}
        />
      );
    }

    const variants = {
      default: 'chip',
      solid: 'chip chip-solid',
      lime: 'chip chip-lime',
      pr: 'pr-badge',
    };

    return (
      <span
        ref={ref}
        className={cn(variants[variant as keyof typeof variants], className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

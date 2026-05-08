import React from 'react';
import { cn } from '../../lib/utils';

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'h1' | 'h2' | 'h3' | 'label' | 'mono' | 'bignum';
}

export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant = 'mono', ...props }, ref) => {
    const variants = {
      h1: 'text-2xl font-bold tracking-tight text-[var(--ink)]',
      h2: 'text-xl font-bold tracking-tight text-[var(--ink)]',
      h3: 'section-title',
      label: 'ft-label',
      mono: 'mono-tag',
      bignum: 'bignum',
    };

    const Tag = ['h1', 'h2', 'h3'].includes(variant) ? (variant as any) : 'span';

    return (
      <Tag
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      />
    );
  }
);

Typography.displayName = 'Typography';

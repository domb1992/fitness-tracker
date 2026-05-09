import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'surface' | 'glass';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'card', interactive, ...props }, ref) => {
    const variants = {
      card: 'card bg-[var(--paper)]',
      surface: 'surface bg-[var(--paper-2)] border-none',
      glass: 'bg-white/5 backdrop-blur-md border border-white/10 shadow-xl',
    };

    return (
      <div
        ref={ref}
        className={cn(
          variants[variant],
          interactive && 'card-interactive',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

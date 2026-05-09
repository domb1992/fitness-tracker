import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'surface';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'card', interactive, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === 'card' ? 'card' : 'surface',
          interactive && 'card-interactive',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

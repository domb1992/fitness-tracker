import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full group">
        {label && (
          <label className="ft-label transition-opacity group-focus-within:opacity-100">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'ft-input w-full',
            error && 'border-[var(--danger)] focus:border-[var(--danger)] bg-[var(--danger)]/5',
            className
          )}
          {...props}
        />
        {error && (
          <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-widest text-[var(--danger)] font-bold">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

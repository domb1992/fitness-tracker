import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="ft-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'ft-input',
            error && 'border-[var(--danger)] focus:border-[var(--danger)]',
            className
          )}
          {...props}
        />
        {error && (
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--danger)]">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

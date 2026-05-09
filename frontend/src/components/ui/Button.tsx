import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-sans font-semibold transition-all focus:outline-none disabled:opacity-38 disabled:cursor-not-allowed active:scale-[0.982]';

    const variants = {
      primary: 'bg-[var(--ink)] text-[var(--paper)] shadow-sm hover:shadow-md',
      secondary: 'bg-[var(--paper-2)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--paper-3)]',
      ghost: 'bg-transparent text-[var(--ink-2)] border border-[var(--border)] hover:bg-[var(--paper-2)] active:bg-[var(--paper-3)]',
      danger: 'bg-[var(--danger)] text-white hover:opacity-90',
      lime: 'bg-[var(--lime)] text-[var(--lime-ink)] shadow-[0_2px_12px_var(--lime-glow)] hover:shadow-[0_4px_20px_var(--lime-glow)]',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs rounded-[var(--r-xs)]',
      md: 'h-11 px-4 text-sm rounded-[var(--r-1)]',
      lg: 'h-14 px-5 text-base rounded-[var(--r-2)]',
    };

    const isBlock = className?.includes('w-full') || className?.includes('block-btn');

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          isBlock && 'w-full flex justify-between px-5',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </span>
        ) : (
          <>
            {leftIcon && <span className={cn(children && 'mr-2')}>{leftIcon}</span>}
            <span className={cn(isBlock && 'flex-1 text-left')}>{children}</span>
            {rightIcon && <span className={cn(children && 'ml-2')}>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

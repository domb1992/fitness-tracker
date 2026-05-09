import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'lime';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-sans font-bold transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] select-none';

    const variants = {
      primary: 'bg-[var(--ink)] text-[var(--paper)] shadow-md hover:bg-opacity-90',
      secondary: 'bg-[var(--paper-2)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--paper-3)] hover:border-[var(--ink-4)]',
      ghost: 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]',
      danger: 'bg-[var(--danger)] text-white shadow-sm hover:opacity-90',
      lime: 'bg-[var(--lime)] text-[var(--lime-ink)] shadow-lg shadow-[var(--lime-glow)] hover:scale-[1.02] active:scale-[0.98]',
    };

    const sizes = {
      sm: 'h-9 px-3.5 text-[13px] rounded-[var(--r-1)]',
      md: 'h-12 px-5 text-sm rounded-[var(--r-1)]',
      lg: 'h-[58px] px-6 text-base rounded-[var(--r-2)]',
      icon: 'h-10 w-10 p-0 rounded-full',
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
          isBlock && 'w-full flex justify-between px-6',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="font-mono text-[10px] uppercase tracking-wider">Loading</span>
          </div>
        ) : (
          <>
            {leftIcon && <span className={cn('flex items-center', children && 'mr-2.5')}>{leftIcon}</span>}
            <span className={cn(isBlock && 'flex-1 text-left')}>{children}</span>
            {rightIcon && <span className={cn('flex items-center', children && 'ml-2.5')}>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

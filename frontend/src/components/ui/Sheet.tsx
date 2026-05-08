import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxHeight = '80dvh',
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="ft-sheet-overlay" onClick={onClose}>
      <div
        className={cn(
          'ft-sheet flex flex-col p-0',
          className
        )}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ft-sheet-handle mt-5 mb-0 flex-shrink-0" />

        {(title || !!onClose) && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            {title && <h2 className="m-0 text-xl font-bold tracking-tight text-[var(--ink)]">{title}</h2>}
            <Button
              variant="ghost"
              size="sm"
              className="icon-btn h-8 w-8"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-8 scroll-y">
          {children}
        </div>

        {footer && (
          <div className="px-5 pb-8 pt-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

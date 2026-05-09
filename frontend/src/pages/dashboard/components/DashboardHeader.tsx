import React from 'react';
import { Typography, Card } from '../../../components/ui';
import { dailyQuote } from '../../../lib/utils';

interface DashboardHeaderProps {
  name: string | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ name }) => {
  const firstName = name ? name.split(' ')[0] : null;

  return (
    <div className="px-6 pt-10 pb-6">
      <Typography variant="mono" className="mb-1.5 block opacity-60">
        {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
      </Typography>
      <Typography variant="h1" className="text-3xl mb-6 block tracking-tight leading-none">Dashboard</Typography>

      <Card variant="surface" className="p-5 flex gap-4 items-start bg-[var(--paper-2)] rounded-[var(--r-2)]">
        <div className="w-10 h-10 rounded-full bg-[var(--paper)] flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-[var(--ink-3)]">
            <path d="M3 21h18M3 7l9-4 9 4v10l-9 4-9-4V7z"/>
            <path d="M12 3v18"/>
          </svg>
        </div>
        <p className="m-0 font-sans text-sm font-medium italic text-[var(--ink-2)] leading-relaxed pt-1">
          “{dailyQuote()}”
        </p>
      </Card>
    </div>
  );
};

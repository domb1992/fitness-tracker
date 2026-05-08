import React from 'react';
import { Typography, Card } from '../../../components/ui';
import { dailyQuote } from '../../../lib/utils';

interface DashboardHeaderProps {
  name: string | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ name }) => {
  const firstName = name ? name.split(' ')[0] : null;

  return (
    <div className="px-5 pt-[18px] pb-4">
      <Typography variant="mono" className="mb-1 block">
        {firstName ? `Hey, ${firstName}` : 'Hey'}
      </Typography>

      <Card variant="surface" className="p-[13px_15px] flex gap-[11px] items-start border-none shadow-none bg-[var(--paper-2)]">
        <svg width={17} height={13} viewBox="0 0 18 14" fill="currentColor"
          className="text-[var(--ink-4)] flex-shrink-0 mt-1">
          <path d="M0 14V8.4C0 3.6 3 1 9 0l1.35 1.8C7.2 2.6 5.55 4 5.1 6H8V14H0zm10 0V8.4C10 3.6 13 1 19 0l1.35 1.8C17.2 2.6 15.55 4 15.1 6H18V14h-8z"/>
        </svg>
        <p className="m-0 font-sans text-[13px] italic text-[var(--ink-2)] leading-[1.55]">
          {dailyQuote()}
        </p>
      </Card>
    </div>
  );
};

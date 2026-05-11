import React from 'react';
import { ApexMark } from '../../../components/ApexMark';
import { dailyQuote } from '../../../lib/utils';

interface DashboardHeaderProps {
  name: string | null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ name }) => {
  const firstName = name ? name.split(' ')[0] : null;
  const greeting  = getGreeting();

  return (
    <div className="px-5 pt-[20px] pb-5">
      {/* Brand wordmark */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
      }}>
        <ApexMark size={22} color="var(--ink)" accentColor="var(--lime)" />
        <span style={{
          fontFamily: 'var(--sans)',
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: '-0.04em',
          color: 'var(--ink)',
          lineHeight: 1,
        }}>
          Fit<span style={{ fontWeight: 300, opacity: 0.45 }}>Track</span>
        </span>
      </div>

      {/* Greeting */}
      <p style={{
        margin: '0 0 2px',
        fontFamily: 'var(--mono)',
        fontSize: 10,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
      }}>
        {greeting}
      </p>
      <h1 style={{
        margin: '0 0 16px',
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        color: 'var(--ink)',
      }}>
        {firstName ? firstName : 'Athlete'} 👋
      </h1>

      {/* Quote card */}
      <div style={{
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        padding: '13px 15px',
        background: 'var(--paper-2)',
        borderRadius: 'var(--r-2)',
        border: '1px solid var(--border)',
      }}>
        <svg width={16} height={12} viewBox="0 0 18 14" fill="currentColor"
          style={{ color: 'var(--ink-4)', flexShrink: 0, marginTop: 2 }}>
          <path d="M0 14V8.4C0 3.6 3 1 9 0l1.35 1.8C7.2 2.6 5.55 4 5.1 6H8V14H0zm10 0V8.4C10 3.6 13 1 19 0l1.35 1.8C17.2 2.6 15.55 4 15.1 6H18V14h-8z"/>
        </svg>
        <p style={{
          margin: 0,
          fontSize: 13,
          fontStyle: 'italic',
          color: 'var(--ink-2)',
          lineHeight: 1.55,
        }}>
          {dailyQuote()}
        </p>
      </div>
    </div>
  );
};

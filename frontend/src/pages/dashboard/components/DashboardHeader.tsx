import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Translations } from '../../../i18n/locales/en';

interface DashboardHeaderProps {
  name: string | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ name }) => {
  const { t, i18n } = useTranslation();
  const firstName = name ? name.split(' ')[0] : null;
  const h = new Date().getHours();
  const greeting = h < 12 ? t('dashboard.greeting.morning')
    : h < 17 ? t('dashboard.greeting.afternoon')
    : t('dashboard.greeting.evening');

  const quotes = t('quotes', { returnObjects: true }) as Translations['quotes'];
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = quotes[dayOfYear % quotes.length];

  return (
    <div className="px-5 pt-[20px] pb-5">
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
        {firstName ? firstName : t('dashboard.greeting.fallback')} 👋
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
          {quote}
        </p>
      </div>
    </div>
  );
};

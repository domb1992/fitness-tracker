import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkoutSession } from '../../../types';
import { fmtDuration, timeAgo } from '../../../lib/utils';
import { useUIStore } from '../../../store/store';

interface RecentWorkoutListProps {
  sessions: WorkoutSession[];
  onShowAll: () => void;
  onDelete: (id: string) => void;
}

export const RecentWorkoutList: React.FC<RecentWorkoutListProps> = ({
  sessions, onShowAll, onDelete,
}) => {
  const navigate  = useNavigate();
  const { t } = useTranslation();
  const recentSess = sessions.slice(0, 5);
  const { dashRecentOpen: open, setDashRecentOpen: setOpen } = useUIStore();

  if (recentSess.length === 0) return null;

  return (
    <div className="px-5 pb-6">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
      }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <h3 style={{
            margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)',
          }}>
            {t('dashboard.recentWorkouts')}
          </h3>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {sessions.length > 5 && (
          <button
            onClick={onShowAll}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'var(--ink-3)',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
            className="hover:text-[var(--ink)] transition-colors"
          >
            {t('dashboard.seeAll')}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.22s ease', overflow: 'hidden' }}>
      <div style={{ minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recentSess.map((s) => (
          <div
            key={s.id}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', overflow: 'hidden',
              borderLeft: `3px solid ${s.plan_color || 'var(--ink)'}`,
            }}
          >
            <button
              onClick={() => navigate(`/session/${s.id}`)}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left', padding: '13px 10px 13px 14px',
              }}
              className="hover:bg-[var(--paper-2)] transition-colors"
            >
              <div style={{
                fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--ink)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.plan_name}
              </div>
              <div style={{
                marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.04em', color: 'var(--ink-3)',
              }}>
                {timeAgo(s.completed_at!, t)} · {fmtDuration(s.duration_seconds)} · {t('common.sets', { count: s.total_sets ?? 0 })}
              </div>
            </button>
            <button
              onClick={() => onDelete(s.id)}
              aria-label={`${t('common.delete')} ${s.plan_name}`}
              style={{
                width: 32, height: 32, marginRight: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--r-1)', cursor: 'pointer',
                color: 'var(--ink-4)',
                transition: 'color var(--duration-fast) var(--ease), border-color var(--duration-fast) var(--ease), transform var(--duration-fast) var(--ease-spring)',
              }}
              className="hover:text-[var(--danger)] hover:border-[var(--danger)] active:scale-90"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
      </div>{/* end collapsible inner */}
      </div>{/* end collapsible grid */}
    </div>
  );
};

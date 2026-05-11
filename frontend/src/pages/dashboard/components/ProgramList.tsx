import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui';
import { TrainingPlan } from '../../../types';
import { timeAgo } from '../../../lib/utils';

interface ProgramListProps {
  plans: TrainingPlan[];
}

export const ProgramList: React.FC<ProgramListProps> = ({ plans }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="px-5 pb-[22px]">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {t('dashboard.programs')}
        </h3>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em',
          color: 'var(--ink-4)',
        }}>
          {t('dashboard.plans', { count: plans.length })}
        </span>
      </div>

      {plans.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px', gap: 14,
          border: '1.5px dashed var(--border)', borderRadius: 'var(--r-2)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--paper-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-3)',
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div>
            <p style={{
              margin: '0 0 4px', fontFamily: 'var(--mono)', fontSize: 10,
              letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)',
            }}>
              {t('dashboard.noPlansTitle')}
            </p>
            <p style={{
              margin: 0, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5,
            }}>
              {t('dashboard.noPlansBody')}
            </p>
          </div>
          <Button onClick={() => navigate('/setup')} className="max-w-[180px] mx-auto h-11">
            {t('dashboard.createFirstPlan')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', overflow: 'hidden',
                borderLeft: `3px solid ${plan.color || 'var(--ink)'}`,
              }}
            >
              <button
                onClick={() => navigate(`/plan/${plan.id}`)}
                style={{
                  flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: '14px 10px 14px 14px',
                }}
                className="hover:bg-[var(--paper-2)] transition-colors"
              >
                <div style={{
                  fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em',
                  color: 'var(--ink)', lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {plan.name}
                </div>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
                  marginTop: 5,
                }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.04em', color: 'var(--ink-4)',
                  }}>
                    {t('common.exercises', { count: plan.exercise_count })}
                  </span>
                  <span style={{ color: 'var(--ink-4)', fontSize: 9 }}>·</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.04em', color: 'var(--ink-4)',
                  }}>
                    {t('common.sessions', { count: plan.session_count })}
                  </span>
                  <span style={{ color: 'var(--ink-4)', fontSize: 9 }}>·</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9,
                    color: 'var(--ink-3)',
                  }}>
                    {plan.last_used ? timeAgo(plan.last_used) : t('common.never')}
                  </span>
                </div>
              </button>
              <div style={{ paddingRight: 12, paddingLeft: 4, flexShrink: 0 }}>
                <button
                  onClick={() => navigate(`/workout/${plan.id}`)}
                  style={{
                    height: 36, paddingLeft: 14, paddingRight: 14,
                    background: 'var(--ink)', color: 'var(--paper)',
                    border: 'none', borderRadius: 'var(--r-1)',
                    fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
                    letterSpacing: '-0.01em',
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer', flexShrink: 0,
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) var(--ease)',
                  }}
                  className="active:scale-95 hover:shadow-sm"
                >
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
                    <path d="M7 4.5v15l13-7.5z"/>
                  </svg>
                  {t('dashboard.start')}
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => navigate('/setup')}
            style={{
              width: '100%', marginTop: 4, height: 42,
              background: 'transparent',
              border: '1.5px dashed var(--border)',
              borderRadius: 'var(--r-2)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--ink-4)',
              cursor: 'pointer',
              transition: 'background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)',
            }}
            className="hover:bg-[var(--paper-2)] hover:text-[var(--ink-2)] active:scale-[0.99]"
          >
            {t('dashboard.addNewPlan')}
          </button>
        </div>
      )}
    </div>
  );
};

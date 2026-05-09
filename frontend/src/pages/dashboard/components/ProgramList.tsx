import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Button } from '../../../components/ui';
import { TrainingPlan } from '../../../types';
import { timeAgo } from '../../../lib/utils';

interface ProgramListProps {
  plans: TrainingPlan[];
}

export const ProgramList: React.FC<ProgramListProps> = ({ plans }) => {
  const navigate = useNavigate();

  return (
    <div className="px-5 pb-[22px]">
      <div className="flex justify-between items-baseline mb-3">
        <Typography variant="h3">Programs</Typography>
        <Typography variant="mono">{plans.length} active</Typography>
      </div>

      {plans.length === 0 ? (
        <div className="empty-state border border-dashed border-[var(--border)] rounded-[var(--r-2)] p-[36px_20px]">
          <div className="empty-state-icon mb-3">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <Typography variant="mono" className="mb-4 block">No plans yet</Typography>
          <Button onClick={() => navigate('/setup')} className="max-w-[180px] mx-auto h-12">
            Create first plan
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="flex items-center overflow-hidden border-l-[3.5px]"
              style={{ borderLeftColor: plan.color || 'var(--ink)' }}
            >
              <button
                onClick={() => navigate(`/plan/${plan.id}`)}
                className="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-[14px_12px_14px_14px] hover:bg-[var(--paper-2)] transition-colors"
              >
                <div className="text-sm font-bold tracking-tight text-[var(--ink)] leading-tight">
                  {plan.name}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 opacity-70">
                  <Typography variant="mono" className="text-[9px]">{plan.exercise_count} exercises</Typography>
                  <span className="text-[var(--ink-4)] text-[9px]">•</span>
                  <Typography variant="mono" className="text-[9px]">{plan.session_count} sessions</Typography>
                  <span className="text-[var(--ink-4)] text-[9px]">•</span>
                  <Typography variant="mono" className="text-[9px] normal-case">
                    {plan.last_used ? timeAgo(plan.last_used) : 'Never done'}
                  </Typography>
                </div>
              </button>
              <div className="pr-3 pl-1 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={() => navigate(`/workout/${plan.id}`)}
                  rightIcon={(
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6"/>
                    </svg>
                  )}
                  className="h-9 px-3.5 bg-[var(--ink)] text-[var(--paper)] font-bold shadow-sm active:scale-95"
                >
                  Start
                </Button>
              </div>
            </Card>
          ))}

          <button
            onClick={() => navigate('/setup')}
            className="w-full mt-1 h-11 bg-transparent border border-dashed border-[var(--border)] rounded-[var(--r-2)] font-mono text-[10px] tracking-widest uppercase text-[var(--ink-3)] cursor-pointer hover:bg-[var(--paper-2)] transition-colors active:scale-[0.99]"
          >
            + Add New Plan
          </button>
        </div>
      )}
    </div>
  );
};

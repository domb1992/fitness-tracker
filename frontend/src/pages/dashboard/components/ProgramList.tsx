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
    <div className="px-6 pb-8">
      <div className="flex justify-between items-center mb-4">
        <Typography variant="h3" className="text-lg">Programs</Typography>
        <Typography variant="mono" className="bg-[var(--paper-2)] px-2 py-0.5 rounded-full text-[9px]">{plans.length} active</Typography>
      </div>

      {plans.length === 0 ? (
        <Card variant="surface" className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-[var(--border)] rounded-[var(--r-2)] bg-transparent">
          <div className="w-12 h-12 rounded-full bg-[var(--paper-2)] flex items-center justify-center mb-4 text-[var(--ink-4)]">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <Typography variant="mono" className="mb-6 block text-center opacity-50">No programs found</Typography>
          <Button onClick={() => navigate('/setup')} variant="primary" className="min-w-[200px]">
            Create First Plan
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="flex items-center overflow-hidden p-0 group"
            >
              <button
                onClick={() => navigate(`/plan/${plan.id}`)}
                className="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-5 hover:bg-[var(--paper-2)] transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: plan.color || 'var(--ink)' }} />
                  <div className="text-base font-bold tracking-tight text-[var(--ink)] leading-tight group-hover:translate-x-0.5 transition-transform">
                    {plan.name}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-60">
                  <Typography variant="mono" className="text-[9px]">{plan.exercise_count} exercises</Typography>
                  <span className="w-0.5 h-0.5 rounded-full bg-[var(--ink-4)]" />
                  <Typography variant="mono" className="text-[9px] normal-case">
                    {plan.last_used ? timeAgo(plan.last_used) : 'New'}
                  </Typography>
                </div>
              </button>
              <div className="pr-4 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={() => navigate(`/workout/${plan.id}`)}
                  variant="lime"
                  className="h-10 px-5 font-extrabold shadow-sm hover:scale-[1.05]"
                >
                  Start
                </Button>
              </div>
            </Card>
          ))}

          <button
            onClick={() => navigate('/setup')}
            className="w-full h-[58px] bg-transparent border-2 border-dashed border-[var(--border)] rounded-[var(--r-2)] font-mono text-[11px] font-bold tracking-widest uppercase text-[var(--ink-3)] cursor-pointer hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add New Plan
          </button>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { plansApi } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { recognizeExercise, MUSCLE_REGIONS } from '../lib/exerciseDatabase';

const PLAN_COLORS = [
  { label: 'Lime',    value: '#a3e635' },
  { label: 'Indigo',  value: '#6366F1' },
  { label: 'Violet',  value: '#8B5CF6' },
  { label: 'Blue',    value: '#3B82F6' },
  { label: 'Cyan',    value: '#06B6D4' },
  { label: 'Emerald', value: '#10B981' },
  { label: 'Orange',  value: '#F97316' },
  { label: 'Rose',    value: '#F43F5E' },
];

type MuscleSource = 'auto' | 'manual' | 'none';

type ExRow = {
  id: string | null;
  name: string;
  sets: string;
  target_reps: string;
  seat_position: string;
  notes: string;
  expanded: boolean;
  planned_duration_minutes: string; // warmup only
  // muscle assignment
  primary_muscles: string[];
  secondary_muscles: string[];
  movement_pattern: string;
  equipment: string;
  muscle_source: MuscleSource;
  muscle_confidence: number;
  muscles_expanded: boolean;
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

const TimerIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

// ─── Muscle chip state cycling ─────────────────────────────────────────────────
// Click cycles: none → primary → secondary → none

function getMuscleState(
  muscle: string,
  primary: string[],
  secondary: string[],
): 'none' | 'primary' | 'secondary' {
  if (primary.includes(muscle)) return 'primary';
  if (secondary.includes(muscle)) return 'secondary';
  return 'none';
}

function cycleMuscle(
  muscle: string,
  primary: string[],
  secondary: string[],
): { primary: string[]; secondary: string[] } {
  const state = getMuscleState(muscle, primary, secondary);
  if (state === 'none') {
    return { primary: [...primary, muscle], secondary };
  } else if (state === 'primary') {
    return { primary: primary.filter((m) => m !== muscle), secondary: [...secondary, muscle] };
  } else {
    return { primary, secondary: secondary.filter((m) => m !== muscle) };
  }
}

// ─── Muscle picker component ───────────────────────────────────────────────────

interface MusclePickerProps {
  primary: string[];
  secondary: string[];
  onChange: (primary: string[], secondary: string[]) => void;
}

function MusclePicker({ primary, secondary, onChange }: MusclePickerProps) {
  const { t } = useTranslation();
  // Deduplicate Rear Delts which appears in both Back and Shoulders regions
  const seen = new Set<string>();
  const regions = MUSCLE_REGIONS.map((r) => ({
    ...r,
    muscles: r.muscles.filter((m) => {
      if (seen.has(m)) return false;
      seen.add(m);
      return true;
    }),
  })).filter((r) => r.muscles.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 6 }}>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="mono-tag" style={{ fontSize: 9 }}>{t('plan.tapToCycle')}</span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
          background: 'var(--ink)', color: 'var(--paper)',
          padding: '2px 7px', borderRadius: 4,
        }}>{t('plan.primary')}</span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
          background: 'var(--paper-3)', color: 'var(--ink-2)',
          border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4,
        }}>{t('plan.secondary')}</span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
          color: 'var(--ink-4)', padding: '2px 7px', borderRadius: 4,
          border: '1px solid var(--hair)',
        }}>{t('plan.none')}</span>
      </div>

      {regions.map((region) => (
        <div key={region.label}>
          <div className="mono-tag" style={{ marginBottom: 6, color: 'var(--ink-3)' }}>
            {region.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {region.muscles.map((muscle) => {
              const state = getMuscleState(muscle, primary, secondary);
              return (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => {
                    const next = cycleMuscle(muscle, primary, secondary);
                    onChange(next.primary, next.secondary);
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    ...(state === 'primary'
                      ? { background: 'var(--ink)', color: 'var(--paper)', border: 'none' }
                      : state === 'secondary'
                      ? { background: 'var(--paper-3)', color: 'var(--ink-2)', border: '1px solid var(--border)' }
                      : { background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--hair)' }),
                  }}
                >
                  {muscle}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {(primary.length > 0 || secondary.length > 0) && (
        <button
          type="button"
          onClick={() => onChange([], [])}
          style={{
            alignSelf: 'flex-start', padding: '4px 10px',
            background: 'transparent', border: '1px solid var(--hair)',
            borderRadius: 6, cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
            color: 'var(--ink-3)',
          }}
        >
          {t('plan.clearAll')}
        </button>
      )}
    </div>
  );
}

// ─── Muscle summary chips (compact read-only display) ─────────────────────────

function MuscleSummary({
  primary, secondary, source, confidence,
}: {
  primary: string[]; secondary: string[];
  source: MuscleSource; confidence: number;
}) {
  if (primary.length === 0 && secondary.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {primary.map((m) => (
        <span key={m} style={{
          background: 'var(--ink)', color: 'var(--paper)',
          padding: '2px 8px', borderRadius: 4,
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
        }}>{m}</span>
      ))}
      {secondary.map((m) => (
        <span key={m} style={{
          background: 'var(--paper-3)', color: 'var(--ink-2)',
          border: '1px solid var(--border)',
          padding: '2px 8px', borderRadius: 4,
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
        }}>{m}</span>
      ))}
      {source === 'auto' && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 4,
          background: 'oklch(0.55 0.18 145 / 0.1)',
          border: '1px solid oklch(0.55 0.18 145 / 0.25)',
          color: 'oklch(0.45 0.14 145)',
          fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.04em',
        }}>
          <SparkleIcon /> AUTO {confidence >= 0.8 ? '' : confidence >= 0.5 ? '~' : '?'}
        </span>
      )}
      {source === 'manual' && (
        <span style={{
          padding: '2px 7px', borderRadius: 4,
          background: 'oklch(0.62 0.16 55 / 0.1)',
          border: '1px solid oklch(0.62 0.16 55 / 0.25)',
          color: 'oklch(0.50 0.12 55)',
          fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.04em',
        }}>MANUAL</span>
      )}
    </div>
  );
}

// ─── Run auto-detection and return updated row ─────────────────────────────────

function applyDetection(row: ExRow, name: string): Partial<ExRow> {
  if (name.trim().length < 3) return {};
  const result = recognizeExercise(name);
  if (!result) return {};
  return {
    primary_muscles:   result.exercise.primaryMuscles,
    secondary_muscles: result.exercise.secondaryMuscles,
    movement_pattern:  result.exercise.movementPattern,
    equipment:         result.exercise.equipment,
    muscle_source:     'auto',
    muscle_confidence: result.confidence,
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EditPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate   = useNavigate();
  const { t } = useTranslation();

  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState('');
  const [dirty,             setDirty]             = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPlan,      setDeletingPlan]      = useState(false);

  const [planName,  setPlanName]  = useState('');
  const [planDesc,  setPlanDesc]  = useState('');
  const [planColor, setPlanColor] = useState(PLAN_COLORS[0].value);

  const [warmups,    setWarmups]    = useState<ExRow[]>([]);
  const [exercises,  setExercises]  = useState<ExRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  useEffect(() => {
    plansApi.getAll()
      .then((plans) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) { navigate('/dashboard', { replace: true }); return; }
        setPlanName(plan.name);
        setPlanDesc(plan.description ?? '');
        setPlanColor(plan.color);

        const toRow = (ex: typeof plan.exercises[0]): ExRow => ({
          id:                       ex.id,
          name:                     ex.name,
          sets:                     String(ex.sets),
          target_reps:              String(ex.target_reps),
          seat_position:            ex.seat_position ?? '',
          notes:                    ex.notes ?? '',
          expanded:                 !!(ex.seat_position || ex.notes),
          planned_duration_minutes: ex.planned_duration_minutes != null && ex.planned_duration_minutes > 0
            ? String(ex.planned_duration_minutes) : '',
          primary_muscles:   ex.primary_muscles ?? [],
          secondary_muscles: ex.secondary_muscles ?? [],
          movement_pattern:  ex.movement_pattern ?? '',
          equipment:         ex.equipment ?? '',
          muscle_source:     (ex.muscle_source as MuscleSource) ?? 'none',
          muscle_confidence: 0,
          muscles_expanded:  false,
        });

        setWarmups(plan.exercises.filter((e) => e.exercise_type === 'warmup').map(toRow));
        setExercises(plan.exercises.filter((e) => e.exercise_type !== 'warmup').map(toRow));
      })
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [planId, navigate]);

  function mark() { setDirty(true); }

  function goBack() {
    if (dirty && !window.confirm(t('plan.unsavedChanges'))) return;
    navigate('/dashboard');
  }

  // ─── Warmup helpers ─────────────────────────────────────────────────────────

  function updateWarmup(idx: number, field: keyof ExRow, value: string | boolean | string[]) {
    setWarmups((rows) => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    mark();
  }

  function addWarmup() {
    setWarmups((rows) => [
      ...rows,
      {
        id: null, name: '', sets: '1', target_reps: '0',
        seat_position: '', notes: '', expanded: false, planned_duration_minutes: '',
        primary_muscles: [], secondary_muscles: [], movement_pattern: '',
        equipment: '', muscle_source: 'none', muscle_confidence: 0, muscles_expanded: false,
      },
    ]);
    mark();
  }

  function removeWarmup(idx: number) {
    const row = warmups[idx];
    if (row.id) setDeletedIds((ids) => [...ids, row.id!]);
    setWarmups((rows) => rows.filter((_, i) => i !== idx));
    mark();
  }

  function moveWarmupUp(idx: number) {
    if (idx === 0) return;
    setWarmups((rows) => { const next = [...rows]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; });
    mark();
  }

  function moveWarmupDown(idx: number) {
    setWarmups((rows) => {
      if (idx >= rows.length - 1) return rows;
      const next = [...rows]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next;
    });
    mark();
  }

  // ─── Strength exercise helpers ───────────────────────────────────────────────

  function updateEx(idx: number, field: keyof ExRow, value: string | boolean | string[]) {
    setExercises((rows) => rows.map((r, i) => {
      if (i !== idx) return r;
      const updated: ExRow = { ...r, [field]: value };

      // Auto-detect muscles on name change if source is not 'manual'
      if (field === 'name' && typeof value === 'string' && updated.muscle_source !== 'manual') {
        const detected = applyDetection(updated, value);
        return { ...updated, ...detected };
      }
      return updated;
    }));
    mark();
  }

  function updateExMuscles(idx: number, primary: string[], secondary: string[]) {
    setExercises((rows) => rows.map((r, i) =>
      i !== idx ? r : {
        ...r,
        primary_muscles: primary,
        secondary_muscles: secondary,
        muscle_source: 'manual',
        muscle_confidence: 1,
      }
    ));
    mark();
  }

  function redetectMuscles(idx: number) {
    setExercises((rows) => rows.map((r, i) => {
      if (i !== idx) return r;
      const detected = applyDetection(r, r.name);
      return { ...r, ...detected, muscle_source: Object.keys(detected).length > 0 ? 'auto' : 'none' };
    }));
    mark();
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setExercises((rows) => { const next = [...rows]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; });
    mark();
  }

  function moveDown(idx: number) {
    setExercises((rows) => {
      if (idx >= rows.length - 1) return rows;
      const next = [...rows]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next;
    });
    mark();
  }

  function addRow() {
    setExercises((rows) => [
      ...rows,
      {
        id: null, name: '', sets: '3', target_reps: '10',
        seat_position: '', notes: '', expanded: false, planned_duration_minutes: '',
        primary_muscles: [], secondary_muscles: [], movement_pattern: '',
        equipment: '', muscle_source: 'none', muscle_confidence: 0, muscles_expanded: false,
      },
    ]);
    mark();
  }

  function removeRow(idx: number) {
    const row = exercises[idx];
    if (row.id) setDeletedIds((ids) => [...ids, row.id!]);
    setExercises((rows) => rows.filter((_, i) => i !== idx));
    mark();
  }

  async function handleDeletePlan() {
    setDeletingPlan(true);
    try {
      await plansApi.delete(planId!);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to delete plan');
      setDeletingPlan(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleSave() {
    if (!planName.trim()) { setError(t('plan.planNameRequiredShort')); return; }
    setSaving(true); setError('');
    try {
      await plansApi.update(planId!, { name: planName.trim(), description: planDesc, color: planColor });
      for (const id of deletedIds) await plansApi.deleteExercise(planId!, id);

      for (let i = 0; i < warmups.length; i++) {
        const wu = warmups[i];
        const data = {
          name: wu.name.trim() || 'Warmup',
          sets: 1, target_reps: '0',
          exercise_order: i + 1,
          seat_position: wu.seat_position.trim(), notes: wu.notes.trim(),
          exercise_type: 'warmup',
          planned_duration_minutes: parseInt(wu.planned_duration_minutes) || 0,
          primary_muscles: [], secondary_muscles: [],
          movement_pattern: '', equipment: 'cardio', muscle_source: 'none',
        };
        if (wu.id === null) await plansApi.addExercise(planId!, data);
        else await plansApi.updateExercise(planId!, wu.id, data);
      }

      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const data = {
          name: ex.name.trim() || 'Exercise',
          sets: Math.max(1, parseInt(ex.sets) || 3),
          target_reps: ex.target_reps.trim() || '10',
          exercise_order: warmups.length + i + 1,
          seat_position: ex.seat_position.trim(), notes: ex.notes.trim(),
          exercise_type: 'strength',
          planned_duration_minutes: 0,
          primary_muscles:   ex.primary_muscles,
          secondary_muscles: ex.secondary_muscles,
          movement_pattern:  ex.movement_pattern,
          equipment:         ex.equipment,
          muscle_source:     ex.muscle_source,
        };
        if (ex.id === null) await plansApi.addExercise(planId!, data);
        else await plansApi.updateExercise(planId!, ex.id, data);
      }

      setDirty(false);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono-tag">{t('common.loading')}</span>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--paper-2)', border: '1px solid var(--hair)',
    borderRadius: 8, padding: '10px 12px', fontSize: 14,
    fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none',
  };

  const optionalToggleStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
    display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };

  return (
    <div className="ft-screen" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={goBack}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag">{t('plan.editPlan')}</div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            height: 32, padding: '0 14px',
            background: dirty && !saving ? 'var(--ink)' : 'transparent',
            color: dirty && !saving ? 'var(--paper)' : 'var(--ink-3)',
            border: '1px solid var(--hair)', borderRadius: 6,
            fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
            cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? t('plan.saving') : t('plan.save')}
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Plan Details */}
        <div className="surface" style={{ padding: '16px 16px' }}>
          <div className="mono-tag" style={{ marginBottom: 14 }}>{t('plan.details')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="ft-label">{t('plan.planName')}</label>
              <input type="text" value={planName} style={inputStyle}
                onChange={(e) => { setPlanName(e.target.value); mark(); }}
                placeholder={t('plan.planNamePlaceholder')}
              />
            </div>
            <div>
              <label className="ft-label">{t('plan.description')}</label>
              <input type="text" value={planDesc} style={inputStyle}
                onChange={(e) => { setPlanDesc(e.target.value); mark(); }}
                placeholder={t('plan.descriptionPlaceholder')}
              />
            </div>
            <div>
              <label className="ft-label">{t('plan.color')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {PLAN_COLORS.map((c) => (
                  <button key={c.value} type="button"
                    onClick={() => { setPlanColor(c.value); mark(); }}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                      backgroundColor: c.value, border: 'none',
                      outline: planColor === c.value ? '2px solid var(--ink)' : '2px solid transparent',
                      outlineOffset: 2,
                      transform: planColor === c.value ? 'scale(1.15)' : 'scale(1)',
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Warmup Exercises ── */}
        <div className="surface" style={{ padding: '16px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TimerIcon />
              <span className="mono-tag">{t('plan.warmup')}</span>
            </div>
            <span className="mono-tag">{t('plan.warmupExercisesCount', { count: warmups.length })}</span>
          </div>

          {warmups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {warmups.map((wu, idx) => (
                <div key={idx} style={{ border: '1px solid var(--hair)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => moveWarmupUp(idx)} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: idx === 0 ? 'default' : 'pointer', color: 'var(--ink-3)', opacity: idx === 0 ? 0.25 : 1 }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 15l-6-6-6 6"/></svg>
                      </button>
                      <button onClick={() => moveWarmupDown(idx)} disabled={idx === warmups.length - 1}
                        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: idx === warmups.length - 1 ? 'default' : 'pointer', color: 'var(--ink-3)', opacity: idx === warmups.length - 1 ? 0.25 : 1 }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                    </div>
                    <input type="text" value={wu.name} placeholder={t('plan.warmupPlaceholder')}
                      onChange={(e) => updateWarmup(idx, 'name', e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontSize: 13 }}
                    />
                    <button onClick={() => removeWarmup(idx)}
                      style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                  <div style={{ paddingLeft: 28 }}>
                    <label className="ft-label">{t('plan.plannedDuration')}</label>
                    <input type="number" inputMode="numeric" value={wu.planned_duration_minutes} min={1} max={120}
                      onChange={(e) => updateWarmup(idx, 'planned_duration_minutes', e.target.value)}
                      placeholder={t('plan.warmupDurationPlaceholder')}
                      style={{ ...inputStyle, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, maxWidth: 120 }}
                    />
                  </div>
                  <div style={{ paddingLeft: 28 }}>
                    <button type="button"
                      onClick={() => updateWarmup(idx, 'expanded', !wu.expanded)}
                      style={{ ...optionalToggleStyle, color: wu.expanded ? 'var(--ink-2)' : 'var(--ink-3)' }}
                    >
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        style={{ transform: wu.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                      {wu.expanded ? t('plan.hideOptional') : t('plan.seatAndNotes')}
                      {(wu.seat_position || wu.notes) && !wu.expanded && (
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }} />
                      )}
                    </button>
                    {wu.expanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                        <div>
                          <label className="ft-label">{t('plan.seatPositionWarmup')}</label>
                          <input type="text" value={wu.seat_position}
                            onChange={(e) => updateWarmup(idx, 'seat_position', e.target.value)}
                            placeholder={t('plan.seatPlaceholderWarmup')}
                            style={{ ...inputStyle, fontSize: 13 }}
                          />
                        </div>
                        <div>
                          <label className="ft-label">{t('plan.notesWarmup')}</label>
                          <input type="text" value={wu.notes}
                            onChange={(e) => updateWarmup(idx, 'notes', e.target.value)}
                            placeholder={t('plan.notesPlaceholderWarmup')}
                            style={{ ...inputStyle, fontSize: 13 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={addWarmup}
            style={{
              width: '100%', height: 44, background: 'transparent', color: 'var(--ink)',
              border: '1px dashed var(--hair)', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <TimerIcon />
            {t('plan.addWarmupExercise')}
          </button>
        </div>

        {/* ── Strength Exercises ── */}
        <div className="surface" style={{ padding: '16px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span className="mono-tag">{t('plan.exercises')}</span>
            <span className="mono-tag">{t('plan.totalExercisesCount', { count: exercises.length })}</span>
          </div>

          {exercises.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {exercises.map((ex, idx) => (
                <div key={idx} style={{ border: '1px solid var(--hair)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: idx === 0 ? 'default' : 'pointer', color: 'var(--ink-3)', opacity: idx === 0 ? 0.25 : 1 }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 15l-6-6-6 6"/></svg>
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx === exercises.length - 1}
                        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: idx === exercises.length - 1 ? 'default' : 'pointer', color: 'var(--ink-3)', opacity: idx === exercises.length - 1 ? 0.25 : 1 }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                    </div>
                    <input type="text" value={ex.name} placeholder={t('plan.exercisePlaceholder')}
                      onChange={(e) => updateEx(idx, 'name', e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontSize: 13 }}
                    />
                    <button onClick={() => removeRow(idx)}
                      style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>

                  {/* Sets / Reps */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 28 }}>
                    <div>
                      <label className="ft-label">{t('plan.sets')}</label>
                      <input type="number" value={ex.sets} min={1} max={10}
                        onChange={(e) => updateEx(idx, 'sets', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label className="ft-label">{t('plan.targetReps')}</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text" value={ex.target_reps}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '' || /^\d+$/.test(v) || /^max$/i.test(v)) {
                              updateEx(idx, 'target_reps', v.toLowerCase() === 'max' ? 'max' : v);
                            }
                          }}
                          placeholder="10"
                          style={{ ...inputStyle, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, flex: 1, minWidth: 0 }}
                        />
                        {ex.target_reps !== 'max' && (
                          <button type="button" onClick={() => { updateEx(idx, 'target_reps', 'max'); mark(); }}
                            style={{
                              flexShrink: 0, height: 38, padding: '0 8px',
                              background: 'transparent', border: '1px solid var(--hair)', borderRadius: 8,
                              cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
                              color: 'var(--ink-3)', whiteSpace: 'nowrap',
                            }}>MAX</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Muscle assignment ── */}
                  <div style={{ paddingLeft: 28 }}>
                    {/* Compact summary + toggle */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <MuscleSummary
                        primary={ex.primary_muscles}
                        secondary={ex.secondary_muscles}
                        source={ex.muscle_source}
                        confidence={ex.muscle_confidence}
                      />
                      {ex.primary_muscles.length === 0 && ex.secondary_muscles.length === 0 && ex.name.trim().length > 0 && (
                        <span className="mono-tag" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{t('plan.noMusclesDetected')}</span>
                      )}
                    </div>

                    {/* Toggle + action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setExercises((rows) => rows.map((r, i) =>
                          i === idx ? { ...r, muscles_expanded: !r.muscles_expanded } : r
                        ))}
                        style={{
                          ...optionalToggleStyle,
                          color: ex.muscles_expanded ? 'var(--ink-2)' : 'var(--ink-3)',
                        }}
                      >
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                          style={{ transform: ex.muscles_expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                        {ex.muscles_expanded ? t('plan.hideMuscles') : t('plan.editMuscles')}
                      </button>

                      {ex.muscle_source !== 'none' && (
                        <button
                          type="button"
                          onClick={() => redetectMuscles(idx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: 'var(--ink-3)',
                          }}
                        >
                          <SparkleIcon />
                          {t('plan.redetect')}
                        </button>
                      )}
                    </div>

                    {/* Inline muscle picker */}
                    {ex.muscles_expanded && (
                      <div style={{
                        marginTop: 10, padding: '12px 14px',
                        background: 'var(--paper-2)', borderRadius: 8,
                        border: '1px solid var(--hair)',
                      }}>
                        <MusclePicker
                          primary={ex.primary_muscles}
                          secondary={ex.secondary_muscles}
                          onChange={(p, s) => updateExMuscles(idx, p, s)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Optional fields toggle */}
                  <div style={{ paddingLeft: 28 }}>
                    <button type="button"
                      onClick={() => setExercises((rows) => rows.map((r, i) => i === idx ? { ...r, expanded: !r.expanded } : r))}
                      style={{ ...optionalToggleStyle, color: ex.expanded ? 'var(--ink-2)' : 'var(--ink-3)' }}
                    >
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        style={{ transform: ex.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                      {ex.expanded ? t('plan.hideOptional') : t('plan.seatAndNotes')}
                      {(ex.seat_position || ex.notes) && !ex.expanded && (
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }} />
                      )}
                    </button>

                    {ex.expanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                        <div>
                          <label className="ft-label">{t('plan.seatPosition')}</label>
                          <input type="text" value={ex.seat_position}
                            onChange={(e) => { updateEx(idx, 'seat_position', e.target.value); mark(); }}
                            placeholder={t('plan.seatPlaceholder')}
                            style={{ ...inputStyle, fontSize: 13 }}
                          />
                        </div>
                        <div>
                          <label className="ft-label">{t('plan.notesExercise')}</label>
                          <input type="text" value={ex.notes}
                            onChange={(e) => { updateEx(idx, 'notes', e.target.value); mark(); }}
                            placeholder={t('plan.notesPlaceholder')}
                            style={{ ...inputStyle, fontSize: 13 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {exercises.length === 0 && (
            <p className="mono-tag" style={{ textAlign: 'center', padding: '16px 0 12px' }}>{t('plan.noExercisesYet')}</p>
          )}

          <button onClick={addRow}
            style={{
              width: '100%', height: 44, background: 'transparent', color: 'var(--ink)',
              border: '1px dashed var(--hair)', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
            {t('plan.addExercise')}
          </button>
        </div>

        {error && (
          <div style={{ background: 'oklch(0.55 0.22 25 / 0.1)', border: '1px solid oklch(0.55 0.22 25 / 0.3)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'oklch(0.55 0.22 25)' }}>
            {error}
          </div>
        )}

        {/* Danger zone */}
        <div className="surface" style={{ padding: '16px' }}>
          <div className="mono-tag" style={{ marginBottom: 12 }}>{t('plan.dangerZone')}</div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              width: '100%', height: 44,
              background: 'oklch(0.55 0.22 25 / 0.08)', color: 'oklch(0.55 0.22 25)',
              border: '1px solid oklch(0.55 0.22 25 / 0.25)', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
            {t('plan.deleteThisPlan')}
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('plan.deletePlanTitle')}
          message={t('plan.deletePlanMessage')}
          confirmLabel={deletingPlan ? t('common.deleting') : t('plan.deletePlan')}
          cancelLabel={t('common.cancel')}
          dangerous
          onConfirm={handleDeletePlan}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Sticky Save */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, padding: '12px 20px 22px',
        background: 'linear-gradient(to top, var(--paper) 60%, transparent)',
      }}>
        <button className="block-btn lime" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? t('plan.saving') : t('plan.saveChanges')}
        </button>
      </div>
    </div>
  );
}

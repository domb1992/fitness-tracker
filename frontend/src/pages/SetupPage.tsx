import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { plansApi } from '../api/client';
import { Exercise, TrainingPlan } from '../types';
import { recognizeExercise } from '../lib/exerciseDatabase';

export default function SetupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [saving,     setSaving]     = useState(false);
  const [addingEx,   setAddingEx]   = useState(false);
  const [error,      setError]      = useState('');
  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
  const [exercises,  setExercises]  = useState<Exercise[]>([]);
  const [planName,   setPlanName]   = useState('');
  const [planDesc,   setPlanDesc]   = useState('');
  const [planColor,  setPlanColor]  = useState('#6366F1');
  const [exForm,     setExForm]     = useState({ name: '', sets: '3', target_reps: '10' });

  const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  async function createPlan() {
    if (!planName.trim()) { setError(t('plan.planNameRequired')); return; }
    setSaving(true); setError('');
    try {
      const plan = await plansApi.create({ name: planName, description: planDesc, color: planColor });
      setCurrentPlan(plan);
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
    } finally { setSaving(false); }
  }

  async function addExercise() {
    if (!exForm.name.trim() || !currentPlan) return;
    setAddingEx(true);
    try {
      // Auto-detect muscles silently
      const detection = recognizeExercise(exForm.name);
      const ex = await plansApi.addExercise(currentPlan.id, {
        name:           exForm.name,
        sets:           parseInt(exForm.sets) || 3,
        target_reps:    exForm.target_reps.trim() || '10',
        exercise_order: exercises.length + 1,
        exercise_type:  'strength',
        primary_muscles:   detection?.exercise.primaryMuscles   ?? [],
        secondary_muscles: detection?.exercise.secondaryMuscles ?? [],
        movement_pattern:  detection?.exercise.movementPattern  ?? '',
        equipment:         detection?.exercise.equipment        ?? '',
        muscle_source:     detection ? 'auto' : 'none',
      });
      setExercises((p) => [...p, ex]);
      setExForm({ name: '', sets: '3', target_reps: '10' });
    } catch (err: any) {
      setError(err.message || 'Failed to add exercise');
    } finally { setAddingEx(false); }
  }

  async function removeExercise(ex: Exercise) {
    if (!currentPlan) return;
    await plansApi.deleteExercise(currentPlan.id, ex.id).catch(() => {});
    setExercises((p) => p.filter((e) => e.id !== ex.id));
  }

  const S = { padding: '0 20px' } as const;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', paddingBottom: 80 }}>

      {/* Top bar */}
      <div style={{ padding: '16px 20px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="icon-btn" onClick={() => navigate('/dashboard')}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div>
          <span className="mono-tag">{t('plan.newPlan')}</span>
          <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {currentPlan ? currentPlan.name : t('plan.createPlan')}
          </h1>
        </div>
      </div>

      <div style={{ ...S, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!currentPlan ? (
          <div className="surface" style={{ padding: '18px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="ft-label">{t('plan.planName')}</label>
                <input className="ft-input" type="text" value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createPlan()}
                  placeholder={t('plan.planNamePlaceholder')} />
              </div>
              <div>
                <label className="ft-label">{t('plan.description')}</label>
                <input className="ft-input" type="text" value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder={t('plan.descriptionPlaceholder')} />
              </div>
              <div>
                <label className="ft-label">{t('plan.color')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setPlanColor(c)} style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: planColor === c ? `3px solid var(--ink)` : 'none',
                      outlineOffset: 2,
                    }} />
                  ))}
                </div>
              </div>
              {error && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'oklch(0.45 0.12 30)' }}>{error}</div>
              )}
              <button className="block-btn" onClick={createPlan} disabled={saving}>
                <span>{saving ? t('plan.creating') : t('plan.createPlan')}</span>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Existing exercises */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t('plan.exercises')}</h3>
                <span className="mono-tag">{t('plan.exercisesAdded', { count: exercises.length })}</span>
              </div>

              {exercises.length === 0 ? (
                <div style={{
                  border: '1px dashed var(--hair)', borderRadius: 'var(--r-2)',
                  padding: '24px 16px', textAlign: 'center',
                }}>
                  <p className="mono-tag">{t('plan.noExercisesYet')}</p>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--hair)', borderRadius: 'var(--r-2)', overflow: 'hidden' }}>
                  {exercises.map((ex, i) => (
                    <div key={ex.id} style={{
                      display: 'grid', gridTemplateColumns: '24px 1fr auto',
                      alignItems: 'center', gap: 12, padding: '13px 14px',
                      borderBottom: i < exercises.length - 1 ? '1px solid var(--hair)' : 'none',
                    }}>
                      <span className="bignum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                        <div className="mono-tag" style={{ marginTop: 2, textTransform: 'none' }}>
                          {ex.sets} sets × {ex.target_reps} reps
                        </div>
                      </div>
                      <button onClick={() => removeExercise(ex)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--ink-4)', padding: 4,
                      }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add exercise form */}
            <div className="surface" style={{ padding: '16px' }}>
              <p className="mono-tag" style={{ marginBottom: 10 }}>{t('plan.addExercise')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="ft-input" type="text" value={exForm.name}
                  onChange={(e) => setExForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addExercise()}
                  placeholder={t('plan.exercisePlaceholder')} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="ft-label">{t('plan.sets')}</label>
                    <input className="ft-input" type="number" value={exForm.sets}
                      onChange={(e) => setExForm((f) => ({ ...f, sets: e.target.value }))}
                      min={1} max={10} style={{ textAlign: 'center', fontFamily: 'var(--mono)' }} />
                  </div>
                  <div>
                    <label className="ft-label">{t('plan.targetReps')}</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="ft-input" type="text" value={exForm.target_reps}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v) || /^max$/i.test(v)) {
                            setExForm((f) => ({ ...f, target_reps: v.toLowerCase() === 'max' ? 'max' : v }));
                          }
                        }}
                        placeholder="10"
                        style={{ textAlign: 'center', fontFamily: 'var(--mono)', flex: 1, minWidth: 0 }}
                      />
                      {exForm.target_reps !== 'max' && (
                        <button
                          type="button"
                          onClick={() => setExForm((f) => ({ ...f, target_reps: 'max' }))}
                          style={{
                            flexShrink: 0, height: 38, padding: '0 8px',
                            background: 'transparent', border: '1px solid var(--hair)',
                            borderRadius: 8, cursor: 'pointer',
                            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
                            color: 'var(--ink-3)', whiteSpace: 'nowrap',
                          }}
                        >MAX</button>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={addExercise} disabled={!exForm.name.trim() || addingEx}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    height: 44, border: '1px solid var(--hair)', borderRadius: 'var(--r-2)',
                    background: 'var(--paper-2)', color: 'var(--ink)',
                    fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    opacity: (!exForm.name.trim() || addingEx) ? 0.4 : 1,
                  }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  {addingEx ? t('common.saving') : t('plan.addExercise')}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'oklch(0.45 0.12 30)' }}>{error}</div>
            )}

            <button className="block-btn lime" onClick={() => navigate('/dashboard', { replace: true })}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M7 4.5v15l13-7.5z"/>
                </svg>
                {t('plan.doneStartTraining')}
              </span>
              <span className="mono-tag" style={{ color: 'var(--lime-ink)', opacity: 0.7 }}>GO</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

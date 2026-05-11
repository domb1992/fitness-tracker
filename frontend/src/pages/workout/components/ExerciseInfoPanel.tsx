import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '../../../types';
import { getExerciseGuide, resolveExerciseMuscles } from '../../../lib/exerciseGuide';
import { MuscleMap } from './MuscleMap';

interface Props {
  exercise: Exercise;
}

export const ExerciseInfoPanel: React.FC<Props> = ({ exercise }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [contentH, setContentH] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const guide = getExerciseGuide(exercise);
  const { primary, secondary } = resolveExerciseMuscles(exercise);

  const hasMuscles = primary.length > 0 || secondary.length > 0;
  const hasGuide   = guide !== null;

  // Measure content height whenever it's populated
  useEffect(() => {
    if (contentRef.current) {
      setContentH(contentRef.current.scrollHeight);
    }
  }, [exercise.name, open]);

  if (!hasGuide && !hasMuscles) return null;

  return (
    <div
      style={{
        borderRadius: 'var(--r-2)',
        border: '1px solid var(--border)',
        background: 'var(--paper)',
        overflow: 'hidden',
      }}
    >
      {/* Toggle row */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Book icon */}
          <svg
            width={14} height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--lime)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span style={{
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--ink-2)',
          }}>
            {t('workout.formGuide')}
          </span>
          {hasMuscles && (
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-4)',
              background: 'var(--paper-2)',
              padding: '2px 6px',
              borderRadius: 4,
            }}>
              {t('workout.muscles')}
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg
          width={14} height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-4)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.28s var(--ease)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expandable content */}
      <div
        style={{
          maxHeight: open ? `${contentH}px` : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.32s var(--ease)',
        }}
      >
        <div ref={contentRef}>
          {/* Divider */}
          <div style={{ height: 1, background: 'var(--hair)', margin: '0 16px' }} />

          {/* Muscle map */}
          {hasMuscles && (
            <div style={{ padding: '16px 12px 4px' }}>
              <MuscleMap primaryMuscles={primary} secondaryMuscles={secondary} />
            </div>
          )}

          {/* Guide content */}
          {hasGuide && (
            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Quick tip */}
              <div style={{
                padding: '10px 12px',
                background: 'var(--lime-soft)',
                borderRadius: 'var(--r-1)',
                borderLeft: '3px solid var(--lime)',
              }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--lime-soft-text)',
                  opacity: 0.85,
                  display: 'block',
                  marginBottom: 4,
                }}>
                  {t('workout.keyTip')}
                </span>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: 'var(--ink)',
                }}>
                  {guide!.tip}
                </p>
              </div>

              {/* Form cues */}
              {guide!.cues.length > 0 && (
                <div>
                  <SectionLabel icon={
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  }>
                    {t('workout.formCues')}
                  </SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {guide!.cues.map((cue, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{
                          flexShrink: 0,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'var(--paper-2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--mono)',
                          fontSize: 8,
                          color: 'var(--ink-3)',
                          marginTop: 1,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{
                          fontFamily: 'var(--sans)',
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: 'var(--ink-2)',
                        }}>
                          {cue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common mistakes */}
              {guide!.mistakes.length > 0 && (
                <div>
                  <SectionLabel icon={
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="oklch(0.68 0.16 55)" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  }>
                    {t('workout.commonMistakes')}
                  </SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                    {guide!.mistakes.map((mistake, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: '7px 10px',
                        background: 'oklch(0.68 0.16 55 / 0.06)',
                        borderRadius: 'var(--r-xs)',
                        border: '1px solid oklch(0.68 0.16 55 / 0.10)',
                      }}>
                        <span style={{ flexShrink: 0, color: 'oklch(0.68 0.16 55)', marginTop: 1 }}>
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" opacity="0.15"/>
                            <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                            <circle cx="12" cy="17" r="1.2" fill="currentColor"/>
                          </svg>
                        </span>
                        <span style={{
                          fontFamily: 'var(--sans)',
                          fontSize: 12,
                          lineHeight: 1.5,
                          color: 'var(--ink-2)',
                        }}>
                          {mistake}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Breathing */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                padding: '8px 10px',
                background: 'var(--paper-2)',
                borderRadius: 'var(--r-xs)',
              }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)"
                  strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M12 22V12M12 2v3M4 5.3C4.8 7 8 9.5 12 9.5s7.2-2.5 8-4.2M4 18.7C4.8 17 8 14.5 12 14.5s7.2 2.5 8 4.2"/>
                </svg>
                <div>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-4)',
                    display: 'block',
                    marginBottom: 2,
                  }}>
                    {t('workout.breathing')}
                  </span>
                  <span style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--ink-3)',
                  }}>
                    {guide!.breathing}
                  </span>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function SectionLabel({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--ink-3)', display: 'flex' }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--ink-4)',
        fontWeight: 600,
      }}>
        {children}
      </span>
    </div>
  );
}

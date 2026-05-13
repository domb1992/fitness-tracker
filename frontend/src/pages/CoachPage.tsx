import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { exercisesApi, sessionsApi } from '../api/client';
import { useUIStore } from '../store/store';
import { computeAnalytics } from '../lib/analyticsEngine';
import type { AnalyticsResult, Insight, InsightCategory, ScoreBreakdown } from '../types';

// ─── Score ring (small, inline) ───────────────────────────────────────────────

function ScoreRingSmall({ score, color }: { score: number; color: string }) {
  const r    = 20;
  const circ = 2 * Math.PI * r;
  const pct  = Math.max(0, Math.min(1, score / 100));

  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={26} cy={26} r={r} fill="none"
          stroke="var(--paper-3)" strokeWidth={5} />
        <circle cx={26} cy={26} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700,
          letterSpacing: '-0.04em', color: 'var(--ink)',
        }}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Score factor bar ──────────────────────────────────────────────────────────

function FactorBar({ label, description, earned, max, positive }: {
  label: string; description: string;
  earned: number; max: number; positive: boolean;
}) {
  const pct = max > 0 ? Math.min(1, earned / max) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
          color: positive ? 'var(--positive)' : 'var(--warning)',
          letterSpacing: '0.04em',
        }}>
          {earned}/{max} pts
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'var(--paper-3)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct * 100}%`,
          background: positive ? 'var(--positive)' : 'var(--warning)',
          transition: 'width 0.6s var(--ease)',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', lineHeight: 1.4,
      }}>
        {description}
      </span>
    </div>
  );
}

// ─── Score card (expandable) ───────────────────────────────────────────────────

function ScoreCard({ bd, label, color, icon }: {
  bd: ScoreBreakdown;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const trendColor =
    bd.trendDirection === 'up'   ? 'var(--positive)' :
    bd.trendDirection === 'down' ? 'var(--warning)'  : 'var(--ink-3)';

  return (
    <div
      className="card"
      style={{ borderRadius: 'var(--r-2)', overflow: 'hidden', cursor: 'pointer' }}
      onClick={() => setExpanded(v => !v)}
    >
      {/* ── Collapsed header ── */}
      <div style={{ padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <ScoreRingSmall score={bd.score} color={color} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ color, flexShrink: 0 }}>{icon}</span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink-3)',
            }}>
              {label}
            </span>
          </div>
          <p style={{
            margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4,
            letterSpacing: '-0.005em',
          }}>
            {bd.summary}
          </p>
          {bd.trendText && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9, color: trendColor,
              letterSpacing: '0.04em', marginTop: 3, display: 'block',
            }}>
              {bd.trendText}
            </span>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          width={14} height={14} viewBox="0 0 24 24"
          fill="none" stroke="var(--ink-4)" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s var(--ease)',
          }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {/* ── Expanded breakdown ── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: expanded ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.25s var(--ease)',
        overflow: 'hidden',
      }}>
        <div style={{ minHeight: 0 }}>
          <div
            style={{ padding: '0 14px 16px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ height: 1, background: 'var(--hair)', marginBottom: 14 }} />

            {/* Factor bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {bd.factors.map((f, i) => (
                <FactorBar key={i} {...f} />
              ))}
            </div>

            {/* Positives */}
            {bd.positives.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--positive)', display: 'block', marginBottom: 6,
                }}>
                  WORKING FOR YOU
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bd.positives.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--positive)', fontSize: 10, lineHeight: 1.5, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Negatives */}
            {bd.negatives.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--warning)', display: 'block', marginBottom: 6,
                }}>
                  HOLDING YOU BACK
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bd.negatives.map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--warning)', fontSize: 10, lineHeight: 1.5, flexShrink: 0 }}>✗</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {bd.suggestions.length > 0 && (
              <div style={{ marginBottom: bd.dataNote ? 10 : 0 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--ink-3)', display: 'block', marginBottom: 6,
                }}>
                  HOW TO IMPROVE
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bd.suggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ink-3)', fontSize: 10, lineHeight: 1.5, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data note */}
            {bd.dataNote && (
              <p style={{
                margin: bd.suggestions.length > 0 ? '8px 0 0' : '0',
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--ink-4)', lineHeight: 1.5,
                borderTop: '1px solid var(--hair)', paddingTop: 8,
              }}>
                {bd.dataNote}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category icon ─────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: InsightCategory }) {
  const s = { width: 14, height: 14, flexShrink: 0 as const };
  if (category === 'pr') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
  if (category === 'progression') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  );
  if (category === 'consistency') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  if (category === 'volume') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
  if (category === 'recovery') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 18a5 5 0 0 0-10 0"/>
      <line x1="12" y1="2" x2="12" y2="9"/>
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
      <line x1="1" y1="18" x2="3" y2="18"/>
      <line x1="21" y1="18" x2="23" y2="18"/>
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
    </svg>
  );
  if (category === 'balance') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21"/>
      <path d="M3 6h9l-3 6H3z"/>
      <path d="M21 18h-9l3-6h9z"/>
    </svg>
  );
  return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

// ─── Trend arrow ───────────────────────────────────────────────────────────────

function TrendArrow({ trend, color }: { trend: Insight['trend']; color: string }) {
  const s = { width: 12, height: 12, color, flexShrink: 0 as const };
  if (trend === 'up') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/>
      <polyline points="7 7 17 7 17 17"/>
    </svg>
  );
  if (trend === 'down') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="7" x2="17" y2="17"/>
      <polyline points="17 7 17 17 7 17"/>
    </svg>
  );
  return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

// ─── Insight colour tokens ─────────────────────────────────────────────────────

function insightColors(type: Insight['type']) {
  switch (type) {
    case 'pr':
      return {
        accent:     'var(--lime)',
        // lime-soft-text flips: dark in light mode, bright in dark mode
        accentText: 'var(--lime-soft-text)',
        accentBg:   'var(--lime-soft)',
        border:     'var(--lime)',
      };
    case 'positive':
      return {
        accent:     'var(--positive)',
        accentText: 'var(--positive)',
        accentBg:   'var(--positive-bg)',
        border:     'var(--positive)',
      };
    case 'warning':
      return {
        accent:     'var(--warning)',
        accentText: 'var(--warning)',
        accentBg:   'var(--warning-soft)',
        border:     'var(--warning)',
      };
    default:
      return {
        accent:     'var(--ink-3)',
        accentText: 'var(--ink-2)',
        // paper-3 is lighter than paper-2 in dark mode (0.27 vs 0.11)
        accentBg:   'var(--paper-3)',
        border:     'var(--hair-dark)',
      };
  }
}

// ─── Confidence dots ───────────────────────────────────────────────────────────

function ConfidenceDots({ level }: { level: Insight['confidence'] }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i < filled ? 'var(--ink-3)' : 'var(--paper-3)',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );
}

// ─── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ insight, onNavigate }: { insight: Insight; onNavigate: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cols = insightColors(insight.type);

  const hasDetails = !!(
    insight.signals?.length ||
    insight.causes?.length ||
    insight.suggestions?.length ||
    insight.confidenceReason
  );

  return (
    <div
      className="card"
      style={{
        borderRadius: 'var(--r-2)',
        overflow: 'hidden',
        borderLeft: `3px solid ${cols.border}`,
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(v => !v)}
    >
      {/* ── Header row ── */}
      <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 'var(--r-xs)',
          background: cols.accentBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: cols.accentText,
        }}>
          <CategoryIcon category={insight.category} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: cols.accentText,
            }}>
              <TrendArrow trend={insight.trend} color={cols.accent} />
              {insight.type === 'pr' ? 'NEW PR' :
               insight.type === 'positive' ? 'PROGRESS' :
               insight.type === 'warning'  ? 'NOTICE'   : 'INFO'}
            </span>
            {insight.timeframe && (
              <span className="mono-tag" style={{ color: 'var(--ink-4)', fontSize: 9 }}>
                {insight.timeframe}
              </span>
            )}
            {hasDetails && (
              <div style={{ marginLeft: 'auto' }}>
                <svg
                  width={14} height={14} viewBox="0 0 24 24"
                  fill="none" stroke="var(--ink-4)" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s var(--ease)',
                  }}
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            )}
          </div>

          <div style={{
            fontSize: 13, fontWeight: 700, lineHeight: 1.3,
            letterSpacing: '-0.01em', color: 'var(--ink)',
          }}>
            {insight.title}
          </div>
        </div>
      </div>

      {/* ── Metric chip ── */}
      {insight.metric && (
        <div style={{ padding: '8px 14px 0', paddingLeft: 58 }}>
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '-0.01em',
            color: cols.accentText,
            background: cols.accentBg,
            padding: '3px 8px', borderRadius: 'var(--r-xs)',
          }}>
            {insight.metric}
          </span>
        </div>
      )}

      {/* ── Expanded body ── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: expanded ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.22s var(--ease)',
        overflow: 'hidden',
      }}>
        <div style={{ minHeight: 0 }}>
          <div
            style={{ padding: '10px 14px 14px', paddingLeft: 58 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Body text */}
            <p style={{
              margin: '0 0 10px', fontSize: 13, lineHeight: 1.55,
              color: 'var(--ink-2)', letterSpacing: '-0.005em',
            }}>
              {insight.body}
            </p>

            {/* Signals */}
            {insight.signals && insight.signals.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--ink-3)', display: 'block', marginBottom: 5,
                }}>
                  DETECTED BECAUSE
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {insight.signals.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: cols.accent, fontSize: 9, lineHeight: 1.6, flexShrink: 0 }}>◆</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Causes */}
            {insight.causes && insight.causes.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--warning)', display: 'block', marginBottom: 5,
                }}>
                  POSSIBLE REASONS
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {insight.causes.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--warning)', fontSize: 9, lineHeight: 1.6, flexShrink: 0 }}>?</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {insight.suggestions && insight.suggestions.length > 0 && (
              <div style={{ marginBottom: insight.confidenceReason ? 10 : 0 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--ink-3)', display: 'block', marginBottom: 5,
                }}>
                  NEXT STEPS
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {insight.suggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ink-3)', fontSize: 9, lineHeight: 1.6, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence reason */}
            {insight.confidenceReason && (
              <p style={{
                margin: 0, fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--ink-4)', lineHeight: 1.5,
                borderTop: '1px solid var(--hair)', paddingTop: 8,
                marginTop: 8,
              }}>
                Confidence: {insight.confidenceReason}
              </p>
            )}

            {/* Exercise link */}
            {insight.exerciseId && (
              <button
                onClick={() => onNavigate(insight.exerciseId!)}
                style={{
                  marginTop: 10,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: 'var(--mono)', fontSize: 9,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: cols.accentText, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}
              >
                View exercise →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom padding when collapsed */}
      {!expanded && <div style={{ height: 14 }} />}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ isInsufficient }: { isInsufficient: boolean }) {
  const { t } = useTranslation();
  return (
    <div style={{
      margin: '0 20px',
      padding: '40px 24px', textAlign: 'center',
      borderRadius: 'var(--r-2)', border: '1px dashed var(--border)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--paper-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)"
          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <p style={{
        margin: '0 0 6px', fontSize: 14, fontWeight: 700,
        letterSpacing: '-0.01em', color: 'var(--ink)',
      }}>
        {isInsufficient ? t('coach.notEnoughData') : t('coach.noInsights')}
      </p>
      <p style={{
        margin: 0, fontFamily: 'var(--mono)', fontSize: 10,
        letterSpacing: '0.04em', color: 'var(--ink-4)', lineHeight: 1.6,
      }}>
        {isInsufficient ? t('coach.notEnoughDataDesc') : t('coach.noInsightsDesc')}
      </p>
    </div>
  );
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────

const FILTER_CATS = [
  'all', 'pr', 'progression', 'consistency', 'volume', 'balance', 'recovery',
] as const;
type FilterCat = typeof FILTER_CATS[number];

// ─── Weekly bar chart ──────────────────────────────────────────────────────────

function WeeklyBars({ weeklyData }: { weeklyData: { week: string; count: number }[] }) {
  const last8 = weeklyData.slice(-8);
  if (last8.length < 2) return null;
  const maxCount = Math.max(...last8.map(d => d.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 36, padding: '0 2px' }}>
      {last8.map((d, i) => {
        const pct = d.count / maxCount;
        const isLast = i === last8.length - 1;
        return (
          <div key={d.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '100%', height: Math.round(pct * 28) + 4,
              borderRadius: 3,
              background: isLast ? 'var(--ink)' : 'var(--paper-3)',
              transition: 'height 0.5s var(--ease-spring)',
              minHeight: 4,
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Data quality badge ────────────────────────────────────────────────────────

function QualityBadge({ quality }: { quality: AnalyticsResult['dataQuality'] }) {
  const { t } = useTranslation();
  const map = {
    insufficient: { label: t('coach.qualityInsufficient'), color: 'var(--ink-4)' },
    limited:      { label: t('coach.qualityLimited'),      color: 'var(--warning)'  },
    good:         { label: t('coach.qualityGood'),         color: 'var(--positive)' },
    excellent:    { label: t('coach.qualityExcellent'),    color: 'var(--lime)'     },
  };
  const { label, color } = map[quality];
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', color,
    }}>
      {label}
    </span>
  );
}

// ─── Score section icons ───────────────────────────────────────────────────────

const ConsistencyIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const VolumeIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const BalanceIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21"/>
    <path d="M3 6h9l-3 6H3z"/>
    <path d="M21 18h-9l3-6h9z"/>
  </svg>
);

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const navigate   = useNavigate();
  const { t }      = useTranslation();
  const { locale } = useUIStore();

  const [result,     setResult]     = useState<AnalyticsResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [filter,     setFilter]     = useState<FilterCat>('all');
  const [weeklyData, setWeeklyData] = useState<{ week: string; count: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [coachData, lifts, stats] = await Promise.all([
        exercisesApi.getCoachData(),
        exercisesApi.getLiftProgression(),
        sessionsApi.getStats(),
      ]);
      setWeeklyData(stats?.weeklyData ?? []);
      const analytics = computeAnalytics({ coachData, liftProgression: lifts, stats, locale });
      setResult(analytics);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { load(); }, [load]);

  const filteredInsights = result?.insights.filter(ins =>
    filter === 'all' || ins.category === filter || (filter === 'pr' && ins.type === 'pr')
  ) ?? [];

  const insightCountByFilter: Record<FilterCat, number> = {
    all:         result?.insights.length ?? 0,
    pr:          result?.insights.filter(i => i.type === 'pr').length ?? 0,
    progression: result?.insights.filter(i => i.category === 'progression').length ?? 0,
    consistency: result?.insights.filter(i => i.category === 'consistency').length ?? 0,
    volume:      result?.insights.filter(i => i.category === 'volume').length ?? 0,
    balance:     result?.insights.filter(i => i.category === 'balance').length ?? 0,
    recovery:    result?.insights.filter(i => i.category === 'recovery').length ?? 0,
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="ft-loader">
        <div className="ft-loader-dot" />
        <span className="mono-tag">{t('common.loading')}</span>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="ft-screen" style={{ paddingBottom: 'var(--nav-safe)' }}>
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
            {t('errors.somethingWrong')}
          </p>
          <button
            onClick={load}
            style={{
              padding: '10px 20px', borderRadius: 'var(--r-1)',
              background: 'var(--ink)', color: 'var(--paper)',
              fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              border: 'none', cursor: 'pointer',
            }}
          >
            {t('coach.retry')}
          </button>
        </div>
      </div>
    );
  }

  const quality      = result?.dataQuality ?? 'insufficient';
  const isInsufficient = quality === 'insufficient';
  const lastUpdated  = result?.lastUpdated;
  const breakdowns   = result?.breakdowns;

  return (
    <div className="ft-screen" style={{ paddingBottom: 'var(--nav-safe)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 8px' }}>
        <span className="eyebrow">{t('coach.pageLabel')}</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 className="page-title">{t('coach.heading')}</h1>
          <button
            onClick={load}
            className="icon-btn"
            aria-label={t('coach.refresh')}
            style={{ marginBottom: 4 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <QualityBadge quality={quality} />
          {lastUpdated && (
            <span className="mono-tag" style={{ color: 'var(--ink-4)', fontSize: 9 }}>
              · {t('coach.updated')} {lastUpdated.toLocaleTimeString(
                locale === 'de' ? 'de-DE' : 'en-US',
                { hour: '2-digit', minute: '2-digit' }
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── Score cards ── */}
      {!isInsufficient && breakdowns && (
        <div style={{ padding: '12px 20px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ScoreCard
            bd={breakdowns.consistency}
            label={t('coach.scoreConsistency')}
            color="var(--positive)"
            icon={<ConsistencyIcon />}
          />
          <ScoreCard
            bd={breakdowns.volume}
            label={t('coach.scoreVolume')}
            color="var(--lime)"
            icon={<VolumeIcon />}
          />
          <ScoreCard
            bd={breakdowns.balance}
            label={t('coach.scoreBalance')}
            color="var(--clay)"
            icon={<BalanceIcon />}
          />

          {/* Weekly bars */}
          {weeklyData.length >= 3 && (
            <div className="surface" style={{ padding: '14px 14px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 8,
              }}>
                <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
                  {t('coach.weeklyActivity')}
                </span>
                <span className="mono-tag" style={{ color: 'var(--ink-3)', fontSize: 9 }}>
                  {t('coach.last8Weeks')}
                </span>
              </div>
              <WeeklyBars weeklyData={weeklyData} />
            </div>
          )}
        </div>
      )}

      {/* ── Insights section ── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12,
        }}>
          <h3 className="section-title">{t('coach.insights')}</h3>
          {result && (
            <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
              {t('coach.insightCount', { count: insightCountByFilter.all })}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        {!isInsufficient && insightCountByFilter.all > 0 && (
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'none', marginBottom: 14,
          }}>
            {FILTER_CATS.map(cat => {
              const count = insightCountByFilter[cat];
              if (cat !== 'all' && count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 'var(--r-full)',
                    border: '1px solid',
                    borderColor: filter === cat ? 'var(--ink)' : 'var(--border)',
                    background: filter === cat ? 'var(--ink)' : 'transparent',
                    color: filter === cat ? 'var(--paper)' : 'var(--ink-3)',
                    fontFamily: 'var(--mono)', fontSize: 9,
                    fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', cursor: 'pointer',
                    transition: 'all 0.15s var(--ease)',
                  }}
                >
                  {t(`coach.filter.${cat}`)}
                  {count > 0 && cat !== 'all' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 14, height: 14, borderRadius: '50%',
                      background: filter === cat ? 'oklch(from var(--paper) l c h / 0.25)' : 'var(--paper-3)',
                      fontSize: 8, fontWeight: 700, lineHeight: 1,
                      color: filter === cat ? 'var(--paper)' : 'var(--ink-3)',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Insight list ── */}
      {isInsufficient || insightCountByFilter.all === 0 ? (
        <EmptyState isInsufficient={isInsufficient} />
      ) : filteredInsights.length === 0 ? (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
            {t('coach.noInsightsInCategory')}
          </span>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredInsights.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onNavigate={(id) => navigate(`/exercise/${id}`)}
            />
          ))}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

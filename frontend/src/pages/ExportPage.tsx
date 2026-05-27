import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/store';
import { exportApi } from '../api/client';
import { buildExport, buildCsv, buildTextSummary, buildAiPrompt } from '../lib/exportEngine';
import type { FitTrackExport } from '../types';

// ─── Icons ─────────────────────────────────────────────────────────────────────

function IconDownload({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconCopy({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function IconCheck({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}

function IconSparkle({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.9 5.7 5.7 1.9-5.7 1.9L12 18.3l-1.9-5.8L4.4 10.6l5.7-1.9z"/>
      <path d="M5 3l.7 2.1 2.1.7-2.1.7L5 8.5 4.3 6.4 2.2 5.7l2.1-.7z"/>
      <path d="M19 14l.7 2.1 2.1.7-2.1.7L19 19.5l-.7-2.1-2.1-.7 2.1-.7z"/>
    </svg>
  );
}

function IconShield({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  );
}

function IconArrowRight({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 14px',
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 600,
    }}>
      {children}
    </p>
  );
}

// ─── Data quality badge ────────────────────────────────────────────────────────

function QualityBadge({ quality }: { quality: string }) {
  const cfg: Record<string, { label: string; bg: string; fg: string }> = {
    insufficient: { label: 'Insufficient', bg: 'var(--danger-soft)',  fg: 'var(--danger)'  },
    limited:      { label: 'Limited',      bg: 'var(--warning-soft)', fg: 'var(--warning)' },
    good:         { label: 'Good',         bg: 'oklch(0.3 0.12 140 / 0.15)', fg: 'var(--success)' },
    excellent:    { label: 'Excellent',    bg: 'oklch(0.55 0.2 130 / 0.15)', fg: 'var(--lime)'    },
  };
  const c = cfg[quality] ?? cfg.limited;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 'var(--r-xs)',
      background: c.bg, color: c.fg,
      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {c.label}
    </span>
  );
}

// ─── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? 'var(--lime)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '-0.01em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>
          {pct}/100
        </span>
      </div>
      <div style={{
        height: 5, borderRadius: 3,
        background: 'var(--paper-2)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>
    </div>
  );
}

// ─── Download helper ───────────────────────────────────────────────────────────

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'ready' | 'error';
type CopiedKey = 'prompt' | 'json' | null;

export default function ExportPage() {
  const navigate    = useNavigate();
  const { t }       = useTranslation();
  const { user }    = useAuthStore();

  const [status,      setStatus]      = useState<Status>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [exportData,  setExportData]  = useState<FitTrackExport | null>(null);
  const [copiedKey,   setCopiedKey]   = useState<CopiedKey>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const raw    = await exportApi.getAllData();
      const result = buildExport(raw, user?.name ?? 'Athlete');
      setExportData(result);
      setStatus('ready');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Unknown error');
      setStatus('error');
    }
  }, [user?.name]);

  async function copyToClipboard(text: string, key: CopiedKey) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleDownload(type: 'json' | 'csv' | 'txt') {
    if (!exportData) return;
    setDownloading(type);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (type === 'json') {
        const json = JSON.stringify(exportData, null, 2);
        downloadFile(`fittrack-export-${date}.json`, json, 'application/json');
      } else if (type === 'csv') {
        const csv = buildCsv(exportData);
        downloadFile(`fittrack-export-${date}.csv`, csv, 'text/csv');
      } else {
        const txt = buildTextSummary(exportData);
        downloadFile(`fittrack-export-${date}.txt`, txt, 'text/plain');
      }
    } finally {
      setTimeout(() => setDownloading(null), 600);
    }
  }

  const stats = exportData?.statistics;
  const fmt   = (iso: string | null) => iso ? iso.slice(0, 10) : '—';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ft-screen animate-fade-in" style={{ paddingBottom: 'calc(var(--nav-safe) + 24px)' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button
          onClick={() => navigate('/settings')}
          aria-label={t('common.back')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--r-2)',
            background: 'var(--paper-2)', border: '1px solid var(--border)',
            color: 'var(--ink-3)', cursor: 'pointer', flexShrink: 0, marginTop: 2,
          }}
        >
          <IconChevronLeft />
        </button>
        <div>
          <p style={{
            margin: '0 0 3px', fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)',
          }}>
            {t('export.pageLabel')}
          </p>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
            lineHeight: 1.1, color: 'var(--ink)',
          }}>
            {t('export.heading')}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.45 }}>
            {t('export.subtitle')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px' }}>

        {/* ── Generate section ── */}
        {status !== 'ready' && (
          <div className="surface" style={{ padding: '18px 18px' }}>
            <SectionLabel>{t('export.sectionGenerate')}</SectionLabel>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {(t('export.featureList', { returnObjects: true }) as string[]).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: 'var(--lime)', fontSize: 11, marginTop: 2, flexShrink: 0 }}>▸</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>

            {status === 'error' && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--r-1)',
                background: 'var(--danger-soft)', color: 'var(--danger)',
                fontSize: 12, marginBottom: 12,
              }}>
                {t('export.errorPrefix')}: {errorMsg}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={status === 'loading'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', height: 48,
                background: status === 'loading' ? 'var(--paper-2)' : 'var(--lime)',
                color: status === 'loading' ? 'var(--ink-4)' : 'var(--surface-hi-text)',
                border: 'none', borderRadius: 'var(--r-2)',
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700,
                letterSpacing: '-0.01em', cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'background var(--duration-fast) var(--ease)',
              }}
            >
              {status === 'loading' ? (
                <>
                  <div style={{
                    width: 14, height: 14, border: '2px solid var(--ink-4)',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  {t('export.generating')}
                </>
              ) : (
                <>
                  <IconSparkle />
                  {t('export.generate')}
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Data overview (once ready) ── */}
        {status === 'ready' && exportData && stats && (
          <>
            {/* Stats card */}
            <div className="surface" style={{ padding: '18px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 600,
                }}>
                  {t('export.sectionOverview')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <QualityBadge quality={stats.data_quality} />
                  <button
                    onClick={() => { setExportData(null); setStatus('idle'); }}
                    title={t('export.regenerate')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 'var(--r-1)',
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--ink-4)', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    ↺
                  </button>
                </div>
              </div>

              {/* Key stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 16 }}>
                {[
                  { label: t('export.statWorkouts'),  value: stats.total_workouts },
                  { label: t('export.statSets'),       value: stats.total_sets.toLocaleString() },
                  { label: t('export.statVolume'),     value: `${stats.total_volume_kg.toLocaleString()} kg` },
                  { label: t('export.statAvgFreq'),    value: `${stats.avg_workouts_per_week}×/wk` },
                  { label: t('export.statFirstDate'),  value: fmt(stats.first_workout) },
                  { label: t('export.statLastDate'),   value: fmt(stats.last_workout) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.06em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 2 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Score bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ScoreBar label={t('export.scoreConsistency')} score={stats.consistency_score} />
                <ScoreBar label={t('export.scoreVolume')}      score={stats.volume_score} />
                <ScoreBar label={t('export.scoreBalance')}     score={stats.balance_score} />
              </div>
            </div>

            {/* Highlights card (plateaus + imbalances) */}
            {(exportData.analytics.plateaus_detected.length > 0 ||
              exportData.analytics.muscle_imbalances.length > 0 ||
              exportData.analytics.strongest_progressions.length > 0) && (
              <div className="surface" style={{ padding: '18px 18px' }}>
                <SectionLabel>{t('export.sectionHighlights')}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {exportData.analytics.strongest_progressions.slice(0, 3).map(p => (
                    <div key={p.exercise_name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>✦</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.exercise_name}</span>
                        {` +${p.total_gain_kg} kg (+${p.pct_change}%)`}
                      </span>
                    </div>
                  ))}
                  {exportData.analytics.plateaus_detected.map(p => (
                    <div key={p.exercise_name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, flexShrink: 0, color: 'var(--warning)' }}>⚠</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.exercise_name}</span>
                        {` plateau — ${p.stuck_at_kg} kg × ${p.session_count} sessions`}
                      </span>
                    </div>
                  ))}
                  {exportData.analytics.muscle_imbalances.map((im, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 13, flexShrink: 0, color: 'var(--danger)', marginTop: 1 }}>⊘</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>{im}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download section */}
            <div className="surface" style={{ padding: '18px 18px' }}>
              <SectionLabel>{t('export.sectionDownload')}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* JSON */}
                <DownloadRow
                  icon="{ }"
                  title={t('export.downloadJson')}
                  subtitle={t('export.downloadJsonDesc')}
                  loading={downloading === 'json'}
                  onClick={() => handleDownload('json')}
                />

                {/* CSV */}
                <DownloadRow
                  icon="⊞"
                  title={t('export.downloadCsv')}
                  subtitle={t('export.downloadCsvDesc')}
                  loading={downloading === 'csv'}
                  onClick={() => handleDownload('csv')}
                />

                {/* TXT */}
                <DownloadRow
                  icon="≡"
                  title={t('export.downloadTxt')}
                  subtitle={t('export.downloadTxtDesc')}
                  loading={downloading === 'txt'}
                  onClick={() => handleDownload('txt')}
                />
              </div>
            </div>

            {/* AI Prompt section */}
            <div className="surface" style={{ padding: '18px 18px' }}>
              <SectionLabel>{t('export.sectionAiPrompt')}</SectionLabel>

              {/* Prompt preview */}
              <div style={{
                background: 'var(--paper-2)', borderRadius: 'var(--r-1)',
                padding: '12px 14px', marginBottom: 12,
                border: '1px solid var(--border)',
              }}>
                <p style={{
                  margin: 0, fontSize: 11.5, color: 'var(--ink-3)',
                  lineHeight: 1.55, fontFamily: 'var(--mono)',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 6,
                  WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}>
                  {buildAiPrompt(exportData).slice(0, 340)}…
                </p>
              </div>

              {/* Copy prompt button */}
              <button
                onClick={() => copyToClipboard(buildAiPrompt(exportData), 'prompt')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', height: 48,
                  background: copiedKey === 'prompt' ? 'oklch(0.55 0.2 130 / 0.12)' : 'var(--lime)',
                  color: copiedKey === 'prompt' ? 'var(--lime)' : 'var(--surface-hi-text)',
                  border: copiedKey === 'prompt' ? '1px solid oklch(0.55 0.2 130 / 0.3)' : 'none',
                  borderRadius: 'var(--r-2)',
                  fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700,
                  letterSpacing: '-0.01em', cursor: 'pointer',
                  transition: 'all var(--duration-fast) var(--ease)',
                }}
              >
                {copiedKey === 'prompt' ? <IconCheck /> : <IconSparkle />}
                {copiedKey === 'prompt' ? t('export.promptCopied') : t('export.copyPrompt')}
              </button>

              <p style={{
                margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.45,
                fontFamily: 'var(--mono)',
              }}>
                {t('export.promptHint')}
              </p>
            </div>

            {/* Copy full JSON shortcut */}
            <button
              onClick={() => copyToClipboard(JSON.stringify(exportData, null, 2), 'json')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', height: 44,
                background: 'transparent',
                color: copiedKey === 'json' ? 'var(--lime)' : 'var(--ink-4)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-2)',
                fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                letterSpacing: '-0.01em', cursor: 'pointer',
                transition: 'color var(--duration-fast) var(--ease)',
              }}
            >
              {copiedKey === 'json' ? <IconCheck size={13} /> : <IconCopy size={13} />}
              {copiedKey === 'json' ? t('export.jsonCopied') : t('export.copyJson')}
            </button>

            {/* Privacy note */}
            <PrivacyNote />
          </>
        )}

        {/* Privacy note (idle/error state too) */}
        {status !== 'ready' && <PrivacyNote />}

      </div>
    </div>
  );
}

// ─── Download row ─────────────────────────────────────────────────────────────

function DownloadRow({
  icon, title, subtitle, onClick, loading,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '11px 14px',
        background: 'var(--paper-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-1)', cursor: loading ? 'wait' : 'pointer',
        textAlign: 'left',
        transition: 'background var(--duration-fast) var(--ease)',
      }}
      className="active:scale-[0.98]"
    >
      {/* Icon box */}
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-1)',
        background: 'var(--paper-3)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)',
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>
          {subtitle}
        </div>
      </div>

      {/* Download arrow */}
      <div style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
        {loading
          ? <div style={{ width: 14, height: 14, border: '2px solid var(--ink-4)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <IconDownload size={14} />
        }
      </div>
    </button>
  );
}

// ─── Privacy note ─────────────────────────────────────────────────────────────

function PrivacyNote() {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '12px 14px',
      background: 'var(--paper-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-1)',
    }}>
      <IconShield />
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.5 }}>
        {t('export.privacyNote')}
      </p>
    </div>
  );
}

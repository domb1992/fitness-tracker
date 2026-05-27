/**
 * FitTrack AI Export Engine
 *
 * Pure TypeScript — no side-effects, no network calls.
 * Computes a full FitTrackExport from raw Supabase data.
 * Also provides CSV, TXT summary, and AI prompt generators.
 */

import {
  FitTrackExport, ExportWorkout, ExportExercise, ExportSetLog,
  ExportExerciseProgression, ExportAnalytics, ExportStatistics,
  DataQuality,
} from '../types';
import { RawExportData, RawExportSession, RawExportSetLog } from '../api/client';
import { LiftProgressionEntry, CoachData } from '../types';

// ─── Movement classification (mirrors analyticsEngine) ───────────────────────

const PUSH_PATTERNS = new Set([
  'horizontal_push', 'incline_push', 'vertical_push', 'decline_push', 'push',
]);
const PULL_PATTERNS = new Set([
  'horizontal_pull', 'vertical_pull', 'pull', 'shrug', 'curl', 'row',
]);
const LEG_PATTERNS = new Set([
  'squat', 'hinge', 'lunge', 'leg_press', 'calf_raise',
  'leg_extension', 'leg_curl', 'hip_thrust',
]);
const PUSH_MUSCLES = new Set(['Chest', 'Upper Chest', 'Front Delts', 'Triceps']);
const PULL_MUSCLES = new Set(['Back', 'Latissimus', 'Trapezius', 'Rhomboids', 'Rear Delts', 'Biceps', 'Forearms']);
const LEG_MUSCLES  = new Set(['Glutes', 'Quadriceps', 'Hamstrings', 'Calves']);

type MovementCat = 'push' | 'pull' | 'legs' | 'other';

function classifyMovement(pattern: string, primaryMuscles: string[]): MovementCat {
  if (PUSH_PATTERNS.has(pattern)) return 'push';
  if (PULL_PATTERNS.has(pattern)) return 'pull';
  if (LEG_PATTERNS.has(pattern))  return 'legs';
  const hasPush = primaryMuscles.some(m => PUSH_MUSCLES.has(m));
  const hasPull = primaryMuscles.some(m => PULL_MUSCLES.has(m));
  const hasLeg  = primaryMuscles.some(m => LEG_MUSCLES.has(m));
  if (hasPush && !hasPull) return 'push';
  if (hasPull && !hasPush) return 'pull';
  if (hasLeg)  return 'legs';
  return 'other';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Epley 1RM estimate — valid for reps 1–20. Returns null outside that range. */
function estimateOneRM(weight: number | null, reps: string | null): number | null {
  if (weight === null || weight <= 0) return null;
  if (reps === null) return null;
  const r = parseInt(reps, 10);
  if (isNaN(r) || r < 1 || r > 20) return null;
  if (r === 1) return weight;
  return Math.round(weight * (1 + r / 30) * 10) / 10;
}

/** Week start (Monday) as ISO date string from any date. */
function weekKey(d: Date): string {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((b.getTime() - a.getTime()) / 86_400_000);
}

function roundOne(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Set-level enrichment ─────────────────────────────────────────────────────

function enrichSet(sl: RawExportSetLog): ExportSetLog {
  const w = sl.weight_kg;
  const rStr = sl.reps_completed;
  let volume: number | null = null;
  if (w !== null && rStr !== null) {
    const r = parseFloat(rStr);
    if (!isNaN(r) && r > 0) volume = roundOne(w * r);
  }
  return {
    set_number:    sl.set_number,
    weight_kg:     w,
    reps:          rStr,
    volume_kg:     volume,
    estimated_1rm: estimateOneRM(w, rStr),
    notes:         sl.notes || '',
  };
}

// ─── Session → ExportWorkout ──────────────────────────────────────────────────

function buildExportWorkout(s: RawExportSession): ExportWorkout {
  const exercises: ExportExercise[] = s.exercises.map(ex => {
    const sets = ex.sets.map(enrichSet);
    const strengthSets = ex.exercise_type === 'strength' ? sets : [];

    // Aggregate totals (only for strength sets)
    let totalVolumeKg: number | null = null;
    let bestWeightKg: number | null  = null;
    let bestEst1rm: number | null    = null;

    for (const sl of strengthSets) {
      if (sl.volume_kg !== null) {
        totalVolumeKg = (totalVolumeKg ?? 0) + sl.volume_kg;
      }
      if (sl.weight_kg !== null) {
        bestWeightKg = Math.max(bestWeightKg ?? 0, sl.weight_kg);
      }
      if (sl.estimated_1rm !== null) {
        bestEst1rm = Math.max(bestEst1rm ?? 0, sl.estimated_1rm);
      }
    }

    return {
      name:               ex.exercise_name,
      exercise_type:      (ex.exercise_type as 'strength' | 'warmup') || 'strength',
      primary_muscles:    ex.primary_muscles  ?? [],
      secondary_muscles:  ex.secondary_muscles ?? [],
      movement_pattern:   ex.movement_pattern ?? '',
      equipment:          ex.equipment ?? '',
      sets,
      total_sets:         sets.length,
      total_volume_kg:    totalVolumeKg !== null ? roundOne(totalVolumeKg) : null,
      best_weight_kg:     bestWeightKg,
      best_estimated_1rm: bestEst1rm,
    };
  });

  const strengthEx     = exercises.filter(e => e.exercise_type === 'strength');
  const totalStrSets   = strengthEx.reduce((sum, e) => sum + e.total_sets, 0);
  let   sessionVolume: number | null = null;
  for (const e of strengthEx) {
    if (e.total_volume_kg !== null) {
      sessionVolume = (sessionVolume ?? 0) + e.total_volume_kg;
    }
  }

  return {
    date:                s.completed_at,
    workout_name:        s.plan_name,
    duration_minutes:    s.duration_seconds !== null ? Math.round(s.duration_seconds / 60) : null,
    total_strength_sets: totalStrSets,
    total_volume_kg:     sessionVolume !== null ? roundOne(sessionVolume) : null,
    notes:               s.notes || '',
    exercises,
  };
}

// ─── Lift progression → ExportExerciseProgression ────────────────────────────

function buildProgression(lift: LiftProgressionEntry): ExportExerciseProgression {
  const sp: number[] = Array.isArray(lift.sparkline)
    ? lift.sparkline.filter((v): v is number => typeof v === 'number' && isFinite(v))
    : [];

  const plateau = sp.length >= 4 &&
    (Math.max(...sp.slice(-4)) - Math.min(...sp.slice(-4))) <= 1.25;

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (sp.length >= 3) {
    const s = sp.slice(-3);
    const goesUp   = s.every((v, i) => i === 0 || v >= s[i - 1] - 0.5);
    const goesDown = s.every((v, i) => i === 0 || v <= s[i - 1] + 0.5);
    if (goesUp && !goesDown) trend = 'up';
    else if (goesDown && !goesUp) trend = 'down';
  }

  return {
    exercise_name:    lift.exercise_name,
    plan_name:        lift.plan_name,
    start_weight_kg:  lift.start_weight,
    current_weight_kg:lift.last_weight,
    best_weight_kg:   lift.best_weight,
    total_gain_kg:    lift.diff,
    pct_change:       lift.pct_change,
    session_count:    lift.session_count,
    first_logged:     lift.first_logged_at,
    last_logged:      lift.last_logged_at,
    weight_history:   sp,
    plateau_detected: plateau,
    trend,
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function computeAnalytics(
  workouts:    ExportWorkout[],
  progression: ExportExerciseProgression[],
  coachData:   CoachData,
): ExportAnalytics {
  const now = new Date();

  // ── Weekly volumes ─────────────────────────────────────────────────────────
  const weekly_volume_sets: Record<string, number> = {};
  const weekly_workouts:    Record<string, number> = {};
  for (const w of workouts) {
    const k = weekKey(new Date(w.date));
    weekly_volume_sets[k] = (weekly_volume_sets[k] ?? 0) + w.total_strength_sets;
    weekly_workouts[k]    = (weekly_workouts[k]    ?? 0) + 1;
  }

  // ── Muscle group volumes (all-time, from coach exercise_sessions) ──────────
  const muscle_group_volume_sets: Record<string, number> = {};
  for (const es of coachData.exercise_sessions) {
    for (const m of (es.primary_muscles ?? [])) {
      if (m) muscle_group_volume_sets[m] = (muscle_group_volume_sets[m] ?? 0) + es.total_sets;
    }
    for (const m of (es.secondary_muscles ?? [])) {
      if (m) muscle_group_volume_sets[m] = (muscle_group_volume_sets[m] ?? 0) + es.total_sets * 0.5;
    }
  }
  for (const k of Object.keys(muscle_group_volume_sets)) {
    muscle_group_volume_sets[k] = roundOne(muscle_group_volume_sets[k]);
  }

  // ── Frequency ─────────────────────────────────────────────────────────────
  const allWeeks          = Object.keys(weekly_workouts).sort();
  const avgPerWeekAllTime = allWeeks.length > 0 ? roundOne(workouts.length / allWeeks.length) : 0;

  const fourWeeksAgo     = new Date(now.getTime() - 28 * 86_400_000);
  const recentSessions   = coachData.sessions.filter(s => new Date(s.completed_at) >= fourWeeksAgo);
  const avgPerWeekLast4w = roundOne(recentSessions.length / 4);

  // ── Push / pull / legs (last 30 days) ─────────────────────────────────────
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);
  let pushSets30d = 0, pullSets30d = 0, legSets30d = 0;

  for (const es of coachData.exercise_sessions) {
    if (new Date(es.completed_at) < thirtyAgo) continue;
    const cat = classifyMovement(es.movement_pattern ?? '', es.primary_muscles ?? []);
    if      (cat === 'push') pushSets30d += es.total_sets;
    else if (cat === 'pull') pullSets30d += es.total_sets;
    else if (cat === 'legs') legSets30d  += es.total_sets;
  }
  const total30d        = pushSets30d + pullSets30d + legSets30d;
  const pushPct30d      = total30d > 0 ? Math.round(pushSets30d / total30d * 100) : 0;
  const pullPct30d      = total30d > 0 ? Math.round(pullSets30d / total30d * 100) : 0;
  const legPct30d       = total30d > 0 ? Math.round(legSets30d  / total30d * 100) : 0;
  const pushPullRatio30d = pullSets30d > 0 ? roundOne(pushSets30d / pullSets30d) : 0;

  // ── Plateaus ───────────────────────────────────────────────────────────────
  const plateaus_detected = progression
    .filter(e => e.plateau_detected && e.session_count >= 4)
    .map(e => ({
      exercise_name: e.exercise_name,
      stuck_at_kg:   e.current_weight_kg,
      session_count: e.session_count,
      last_logged:   e.last_logged,
    }));

  // ── Progression quality ────────────────────────────────────────────────────
  const strongest_progressions = [...progression]
    .filter(e => e.pct_change > 0 && e.session_count >= 3)
    .sort((a, b) => b.pct_change - a.pct_change)
    .slice(0, 5)
    .map(e => ({
      exercise_name: e.exercise_name,
      total_gain_kg: e.total_gain_kg,
      pct_change:    e.pct_change,
      session_count: e.session_count,
    }));

  const weakest_progressions = [...progression]
    .filter(e => e.session_count >= 3 && (e.pct_change < 5 || e.plateau_detected || e.trend === 'down'))
    .sort((a, b) => a.pct_change - b.pct_change)
    .slice(0, 5)
    .map(e => ({
      exercise_name: e.exercise_name,
      pct_change:    e.pct_change,
      trend:         e.trend,
      note:          e.plateau_detected
        ? 'Plateau detected'
        : e.trend === 'down'
          ? 'Regression'
          : 'Minimal progress',
    }));

  // ── Recovery indicators ────────────────────────────────────────────────────
  const sorted = [...workouts].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let totalGap = 0, gapCount = 0, maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(new Date(sorted[i - 1].date), new Date(sorted[i].date));
    totalGap += gap;
    gapCount++;
    if (gap > maxGap) maxGap = gap;
  }
  const avgDaysBetween = gapCount > 0 ? roundOne(totalGap / gapCount) : 0;

  // ── Streak (active days with up to 2 rest-day tolerance) ──────────────────
  let streak = 0, misses = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (workouts.some(w => new Date(w.date).toDateString() === d.toDateString())) {
      streak++; misses = 0;
    } else if (++misses > 2) break;
  }

  // ── Muscle imbalances ──────────────────────────────────────────────────────
  const muscle_imbalances: string[] = [];
  if (total30d >= 15) {
    if (pushPullRatio30d > 1.65 && pushSets30d > 0 && pullSets30d > 0) {
      muscle_imbalances.push(
        `Push-heavy imbalance: ${pushPct30d}% push vs ${pullPct30d}% pull (ideal: ~50/50)`
      );
    } else if (pushSets30d > 0 && pullSets30d === 0) {
      muscle_imbalances.push('No pulling movements in last 30 days');
    }
    if (legPct30d === 0 && total30d >= 20) {
      muscle_imbalances.push('No leg training in last 30 days');
    } else if (legPct30d > 0 && legPct30d < 10) {
      muscle_imbalances.push(
        `Low leg volume: only ${legPct30d}% of total sets (legs = ~50% of muscle mass)`
      );
    }
  }

  // ── Simplified scores (consistent with analyticsEngine logic) ─────────────
  const freqScore       = avgPerWeekLast4w >= 4 ? 40 : avgPerWeekLast4w >= 3 ? 30 : avgPerWeekLast4w >= 2 ? 20 : avgPerWeekLast4w >= 1 ? 10 : 0;
  const consistencyScore = Math.min(100, Math.round((freqScore / 40) * 100));

  const currWeekKey   = weekKey(now);
  const currWeekSets  = weekly_volume_sets[currWeekKey] ?? 0;
  const pastWeekKeys  = Object.keys(weekly_volume_sets).filter(k => k < currWeekKey).sort().slice(-4);
  const avgSets4w     = pastWeekKeys.length > 0
    ? pastWeekKeys.reduce((s, k) => s + weekly_volume_sets[k], 0) / pastWeekKeys.length
    : 0;
  const absVolumeScore = Math.min(30, Math.round((Math.min(currWeekSets, 20) / 20) * 30));
  const baselineScore  = avgSets4w > 0 ? Math.min(45, Math.round((Math.min(currWeekSets / avgSets4w, 1)) * 45)) : 22;
  const volumeScore    = Math.min(100, absVolumeScore + baselineScore);

  const ppScore      = total30d >= 5 && pushSets30d > 0 && pullSets30d > 0
    ? (pushPullRatio30d >= 0.85 && pushPullRatio30d <= 1.15 ? 40 : pushPullRatio30d >= 0.75 && pushPullRatio30d <= 1.25 ? 32 : 20)
    : 0;
  const legScore     = legPct30d >= 30 ? 35 : legPct30d >= 20 ? 28 : legPct30d >= 10 ? 18 : legPct30d >= 5 ? 10 : 0;
  const distinctMuscles = new Set(
    coachData.exercise_sessions
      .filter(es => new Date(es.completed_at) >= new Date(now.getTime() - 14 * 86_400_000))
      .flatMap(es => es.primary_muscles ?? [])
      .filter(Boolean)
  ).size;
  const coverageScore = distinctMuscles >= 9 ? 25 : distinctMuscles >= 7 ? 20 : distinctMuscles >= 5 ? 15 : distinctMuscles >= 3 ? 8 : 4;
  const balanceScore  = Math.min(100, ppScore + legScore + coverageScore);

  return {
    weekly_volume_sets,
    weekly_workouts,
    muscle_group_volume_sets,
    avg_workouts_per_week_all_time: avgPerWeekAllTime,
    avg_workouts_per_week_last_4w:  avgPerWeekLast4w,
    consistency_score:   consistencyScore,
    volume_score:        volumeScore,
    balance_score:       balanceScore,
    push_sets_30d:       pushSets30d,
    pull_sets_30d:       pullSets30d,
    leg_sets_30d:        legSets30d,
    push_pct_30d:        pushPct30d,
    pull_pct_30d:        pullPct30d,
    leg_pct_30d:         legPct30d,
    push_pull_ratio_30d: pushPullRatio30d,
    plateaus_detected,
    strongest_progressions,
    weakest_progressions,
    avg_days_between_workouts: avgDaysBetween,
    max_gap_days:              roundOne(maxGap),
    longest_streak_days:       streak,
    muscle_imbalances,
  };
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function computeStatistics(
  workouts:  ExportWorkout[],
  analytics: ExportAnalytics,
  lifts:     LiftProgressionEntry[],
): ExportStatistics {
  const sorted = [...workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalSets   = workouts.reduce((sum, w) => sum + w.total_strength_sets, 0);
  const totalVolume = workouts.reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0);

  const durations = workouts.filter(w => w.duration_minutes !== null).map(w => w.duration_minutes!);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const uniqueDays      = new Set(workouts.map(w => w.date.slice(0, 10))).size;
  const allWeeks        = Object.keys(analytics.weekly_workouts).sort();
  const avgPerWeek      = allWeeks.length > 0 ? roundOne(workouts.length / allWeeks.length) : 0;

  const dataQuality: DataQuality =
    workouts.length < 3  ? 'insufficient' :
    workouts.length < 8  ? 'limited' :
    workouts.length < 20 || lifts.length < 3 ? 'good' : 'excellent';

  return {
    total_workouts:              workouts.length,
    total_volume_kg:             Math.round(totalVolume),
    total_sets:                  totalSets,
    avg_workout_duration_minutes:avgDuration,
    avg_workouts_per_week:       avgPerWeek,
    training_days_total:         uniqueDays,
    first_workout:               sorted[0]?.date ?? null,
    last_workout:                sorted[sorted.length - 1]?.date ?? null,
    consistency_score:           analytics.consistency_score,
    volume_score:                analytics.volume_score,
    balance_score:               analytics.balance_score,
    data_quality:                dataQuality,
  };
}

// ─── Public: build full export ────────────────────────────────────────────────

export function buildExport(raw: RawExportData, profileName: string): FitTrackExport {
  const workouts    = raw.sessions.map(buildExportWorkout);
  const progression = raw.lifts.map(buildProgression);
  const analytics   = computeAnalytics(workouts, progression, raw.coachData);
  const statistics  = computeStatistics(workouts, analytics, raw.lifts);

  const now = new Date();

  return {
    export_version:    '1.0',
    export_created_at: now.toISOString(),
    date_range: {
      from: statistics.first_workout,
      to:   statistics.last_workout,
    },
    profile:            { name: profileName },
    statistics,
    workouts,
    exercise_progression: progression,
    analytics,
  };
}

// ─── Public: CSV export ───────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(data: FitTrackExport): string {
  const rows: string[] = [
    'date,workout_name,duration_min,exercise_name,exercise_type,' +
    'primary_muscles,secondary_muscles,movement_pattern,equipment,' +
    'set_number,weight_kg,reps,volume_kg,est_1rm_kg,set_notes',
  ];

  for (const w of data.workouts) {
    for (const ex of w.exercises) {
      if (ex.sets.length === 0) {
        // Warmup exercises with no logged sets — still show row
        rows.push([
          w.date.slice(0, 10),
          csvCell(w.workout_name),
          w.duration_minutes ?? '',
          csvCell(ex.name),
          ex.exercise_type,
          csvCell(ex.primary_muscles.join(';')),
          csvCell(ex.secondary_muscles.join(';')),
          ex.movement_pattern,
          ex.equipment,
          '', '', '', '', '', '',
        ].join(','));
        continue;
      }
      for (const s of ex.sets) {
        rows.push([
          w.date.slice(0, 10),
          csvCell(w.workout_name),
          w.duration_minutes ?? '',
          csvCell(ex.name),
          ex.exercise_type,
          csvCell(ex.primary_muscles.join(';')),
          csvCell(ex.secondary_muscles.join(';')),
          ex.movement_pattern,
          ex.equipment,
          s.set_number,
          s.weight_kg ?? '',
          s.reps      ?? '',
          s.volume_kg ?? '',
          s.estimated_1rm ?? '',
          csvCell(s.notes),
        ].join(','));
      }
    }
  }

  return rows.join('\n');
}

// ─── Public: text summary ─────────────────────────────────────────────────────

export function buildTextSummary(data: FitTrackExport): string {
  const { statistics: s, analytics: a } = data;
  const lines: string[] = [];
  const divider = '─'.repeat(56);

  lines.push('═'.repeat(56));
  lines.push('  FITTRACK AI EXPORT  ·  FITNESS ANALYSIS REPORT');
  lines.push('═'.repeat(56));
  lines.push(`  Generated : ${new Date(data.export_created_at).toLocaleDateString()}`);
  lines.push(`  Athlete   : ${data.profile.name}`);
  lines.push(`  Period    : ${s.first_workout ? s.first_workout.slice(0, 10) : 'n/a'} → ${s.last_workout ? s.last_workout.slice(0, 10) : 'n/a'}`);
  lines.push(`  Version   : FitTrack export v${data.export_version}`);
  lines.push('');

  lines.push('▸ OVERVIEW');
  lines.push(divider);
  lines.push(`  Total workouts        : ${s.total_workouts}`);
  lines.push(`  Total training days   : ${s.training_days_total}`);
  lines.push(`  Avg sessions / week   : ${s.avg_workouts_per_week}`);
  lines.push(`  Total volume          : ${s.total_volume_kg.toLocaleString()} kg`);
  lines.push(`  Total sets            : ${s.total_sets.toLocaleString()}`);
  lines.push(`  Avg workout duration  : ${s.avg_workout_duration_minutes != null ? s.avg_workout_duration_minutes + ' min' : 'n/a'}`);
  lines.push(`  Data quality          : ${s.data_quality.toUpperCase()}`);
  lines.push('');

  lines.push('▸ PERFORMANCE SCORES (0–100)');
  lines.push(divider);
  lines.push(`  Consistency  : ${s.consistency_score}/100`);
  lines.push(`  Volume       : ${s.volume_score}/100`);
  lines.push(`  Balance      : ${s.balance_score}/100`);
  lines.push('');

  lines.push('▸ MUSCLE BALANCE (last 30 days)');
  lines.push(divider);
  lines.push(`  Push : ${a.push_pct_30d}%  (${a.push_sets_30d} sets)`);
  lines.push(`  Pull : ${a.pull_pct_30d}%  (${a.pull_sets_30d} sets)`);
  lines.push(`  Legs : ${a.leg_pct_30d}%   (${a.leg_sets_30d} sets)`);
  lines.push(`  Push / pull ratio : ${a.push_pull_ratio_30d}:1  (ideal ≈ 1.0:1)`);
  lines.push('');

  if (a.strongest_progressions.length > 0) {
    lines.push('▸ TOP EXERCISE PROGRESSIONS');
    lines.push(divider);
    for (const p of a.strongest_progressions) {
      lines.push(`  ${p.exercise_name} : +${p.total_gain_kg} kg  (+${p.pct_change}%)  ·  ${p.session_count} sessions`);
    }
    lines.push('');
  }

  if (a.weakest_progressions.length > 0) {
    lines.push('▸ WEAKEST / STAGNATING LIFTS');
    lines.push(divider);
    for (const p of a.weakest_progressions) {
      lines.push(`  ${p.exercise_name} : ${p.pct_change > 0 ? '+' : ''}${p.pct_change}%  ·  ${p.note}`);
    }
    lines.push('');
  }

  if (a.plateaus_detected.length > 0) {
    lines.push('▸ PLATEAUS DETECTED');
    lines.push(divider);
    for (const p of a.plateaus_detected) {
      lines.push(`  ${p.exercise_name} : stuck at ${p.stuck_at_kg} kg for ${p.session_count} sessions`);
    }
    lines.push('');
  }

  if (a.muscle_imbalances.length > 0) {
    lines.push('▸ MUSCLE IMBALANCES');
    lines.push(divider);
    for (const im of a.muscle_imbalances) {
      lines.push(`  ⚠  ${im}`);
    }
    lines.push('');
  }

  lines.push('▸ RECOVERY INDICATORS');
  lines.push(divider);
  lines.push(`  Avg days between workouts : ${a.avg_days_between_workouts}`);
  lines.push(`  Longest gap               : ${Math.round(a.max_gap_days)} days`);
  lines.push(`  Longest streak            : ${a.longest_streak_days} days`);
  lines.push(`  Recent frequency (4 wk)   : ${a.avg_workouts_per_week_last_4w} sessions / week`);
  lines.push('');

  const topMuscles = Object.entries(a.muscle_group_volume_sets)
    .sort(([, av], [, bv]) => bv - av)
    .slice(0, 10);
  if (topMuscles.length > 0) {
    lines.push('▸ TOP MUSCLE GROUPS (all-time weighted sets)');
    lines.push(divider);
    for (const [muscle, sets] of topMuscles) {
      lines.push(`  ${muscle.padEnd(18)}: ${sets}`);
    }
    lines.push('');
  }

  lines.push('▸ EXERCISE PROGRESSION LIST');
  lines.push(divider);
  for (const e of data.exercise_progression.slice(0, 20)) {
    const gain = e.total_gain_kg >= 0 ? `+${e.total_gain_kg}` : `${e.total_gain_kg}`;
    const flag = e.plateau_detected ? '  ⚠ PLATEAU' : '';
    lines.push(`  ${e.exercise_name.padEnd(28)}: ${e.start_weight_kg} → ${e.current_weight_kg} kg  (${gain} kg, ${e.pct_change}%)${flag}`);
  }
  lines.push('');

  lines.push('═'.repeat(56));
  lines.push('  End of report  ·  FitTrack AI Export v1.0');
  lines.push('═'.repeat(56));

  return lines.join('\n');
}

// ─── Public: AI analysis prompt ───────────────────────────────────────────────

export function buildAiPrompt(data: FitTrackExport): string {
  const { statistics: s, analytics: a } = data;

  const fmt = (arr: string[]) =>
    arr.length > 0 ? arr.map(x => `  • ${x}`).join('\n') : '  • None detected';

  const progressionLines = a.strongest_progressions.length > 0
    ? a.strongest_progressions.map(p => `  • ${p.exercise_name}: +${p.total_gain_kg} kg (+${p.pct_change}%) over ${p.session_count} sessions`)
    : ['  • Insufficient progression data'];

  const plateauLines = a.plateaus_detected.length > 0
    ? a.plateaus_detected.map(p => `  • ${p.exercise_name}: stuck at ${p.stuck_at_kg} kg for ${p.session_count} sessions`)
    : ['  • None detected'];

  const weakLines = a.weakest_progressions.length > 0
    ? a.weakest_progressions.map(p => `  • ${p.exercise_name}: ${p.pct_change > 0 ? '+' : ''}${p.pct_change}% — ${p.note}`)
    : ['  • None detected'];

  const topMuscleLines = Object.entries(a.muscle_group_volume_sets)
    .sort(([, av], [, bv]) => bv - av)
    .slice(0, 10)
    .map(([m, v]) => `  • ${m}: ${v} weighted sets`);

  return `You are an expert strength and conditioning coach with deep expertise in progressive overload, periodisation, muscle balance, and injury prevention.

Please perform a comprehensive evidence-based analysis of the following fitness tracking export.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ATHLETE PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:                 ${data.profile.name}
Training period:      ${s.first_workout ? s.first_workout.slice(0, 10) : 'n/a'} → ${s.last_workout ? s.last_workout.slice(0, 10) : 'n/a'}
Total workouts:       ${s.total_workouts}
Total training days:  ${s.training_days_total}
Avg sessions / week:  ${s.avg_workouts_per_week}
Avg duration:         ${s.avg_workout_duration_minutes != null ? s.avg_workout_duration_minutes + ' min' : 'n/a'}
Total volume lifted:  ${s.total_volume_kg.toLocaleString()} kg
Total sets logged:    ${s.total_sets.toLocaleString()}
Data quality:         ${s.data_quality.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFORMANCE SCORES (0–100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Consistency : ${s.consistency_score}/100  (training frequency & regularity)
Volume      : ${s.volume_score}/100  (weekly training load vs. baseline)
Balance     : ${s.balance_score}/100  (push/pull/leg ratio & muscle coverage)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MUSCLE BALANCE (last 30 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Push : ${a.push_pct_30d}%  (${a.push_sets_30d} sets)
Pull : ${a.pull_pct_30d}%  (${a.pull_sets_30d} sets)
Legs : ${a.leg_pct_30d}%   (${a.leg_sets_30d} sets)
Push / pull ratio : ${a.push_pull_ratio_30d}:1  (ideal ≈ 1.0:1)

Imbalances detected:
${fmt(a.muscle_imbalances)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXERCISE PROGRESSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Top progressions:
${progressionLines.join('\n')}

Weakest / stagnating lifts:
${weakLines.join('\n')}

Plateaus detected:
${plateauLines.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOVERY INDICATORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Avg days between workouts : ${a.avg_days_between_workouts}
Longest gap               : ${Math.round(a.max_gap_days)} days
Longest streak            : ${a.longest_streak_days} days
Recent frequency (4 wk)   : ${a.avg_workouts_per_week_last_4w} sessions / week

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MUSCLE VOLUME DISTRIBUTION (all-time)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${topMuscleLines.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS REQUESTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please analyse this data and provide:

1. OVERALL PROGRESSION RATING
   Rate as: Poor / Average / Good / Excellent
   Explain specifically WHY based on the data points above.

2. TOP 5 ACTIONABLE IMPROVEMENTS
   Be specific. Name the exercises, rep ranges, or structural changes.

3. MUSCLE BALANCE ASSESSMENT
   Are there imbalances that risk injury? Which muscle groups are neglected?

4. CONSISTENCY & RECOVERY ANALYSIS
   Is the frequency optimal? Are there signs of overtraining or underrecovery?

5. PLATEAU DIAGNOSIS
   What is likely causing each plateau? Give specific solutions.

6. 3-MONTH TRAJECTORY
   At the current trajectory, what is realistic progress in the next 3 months?

7. PROGRAM STRUCTURE OPTIMISATION
   What structural changes would produce the best long-term results for this athlete?

Note: The full detailed workout log (JSON format with per-set data) is available separately. This summary contains pre-computed analytics. Use all data points for the most accurate analysis.`;
}

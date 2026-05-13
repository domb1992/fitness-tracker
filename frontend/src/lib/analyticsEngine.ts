import {
  CoachData, CoachSession, CoachExerciseSession,
  Insight, AnalyticsResult, AnalyticsScores, AnalyticsBreakdowns,
  ScoreBreakdown, ScoreFactor, DataQuality,
  LiftProgressionEntry, Stats,
} from '../types';

// ─── Movement classification ──────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.abs((b.getTime() - a.getTime()) / 86_400_000);
}
function hoursBetween(a: Date, b: Date): number {
  return Math.abs((b.getTime() - a.getTime()) / 3_600_000);
}

function fmtKg(v: number): string {
  return v % 1 === 0 ? `${v}` : `${v.toFixed(1)}`;
}

function fmtTimeframe(firstIso: string, lastIso: string, isEn: boolean): string {
  const days = Math.round(daysBetween(new Date(firstIso), new Date(lastIso)));
  if (days < 7)  return isEn ? `${days}d`                     : `${days} T`;
  if (days < 30) return isEn ? `${Math.round(days / 7)}w`     : `${Math.round(days / 7)} Wo`;
  return isEn ? `${Math.round(days / 30)} mo` : `${Math.round(days / 30)} Mo`;
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}

function weekKey(d: Date): string {
  return mondayOf(d).toISOString().slice(0, 10);
}

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

function cleanSparkline(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === 'number' && isFinite(v));
}

function isFlat(sp: number[], window = 4, threshold = 1.25): boolean {
  if (sp.length < window) return false;
  const slice = sp.slice(-window);
  return (Math.max(...slice) - Math.min(...slice)) <= threshold;
}

function isTrendingUp(sp: number[], window = 3): boolean {
  if (sp.length < window) return false;
  const slice = sp.slice(-window);
  return slice.every((v, i) => i === 0 || v >= slice[i - 1] - 0.5);
}

function isTrendingDown(sp: number[], window = 3): boolean {
  if (sp.length < window) return false;
  const slice = sp.slice(-window);
  return slice.every((v, i) => i === 0 || v <= slice[i - 1] + 0.5);
}

function dataQuality(sessions: CoachSession[], lifts: LiftProgressionEntry[]): DataQuality {
  const n = sessions.length;
  if (n < 3)  return 'insufficient';
  if (n < 8)  return 'limited';
  if (n < 20 || lifts.length < 3) return 'good';
  return 'excellent';
}

// ─── Score breakdowns ─────────────────────────────────────────────────────────

function computeConsistencyBreakdown(sessions: CoachSession[], isEn: boolean): ScoreBreakdown {
  const now    = new Date();
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );

  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);
  const recentSessions = sorted.filter(s => new Date(s.completed_at) >= fourWeeksAgo);
  const sessPerWeek = recentSessions.length / 4;

  // ── Factor 1: Frequency (max 40pts) ──
  const freqEarned =
    sessPerWeek >= 4 ? 40 :
    sessPerWeek >= 3 ? 30 :
    sessPerWeek >= 2 ? 20 :
    sessPerWeek >= 1 ? 10 : 0;

  // ── Factor 2: Gap quality (max 25pts) ──
  let maxRecentGap = 0;
  for (let i = 0; i < recentSessions.length - 1; i++) {
    const gap = daysBetween(
      new Date(recentSessions[i + 1].completed_at),
      new Date(recentSessions[i].completed_at)
    );
    if (gap > maxRecentGap) maxRecentGap = gap;
  }
  // Also count days since last session
  if (sorted.length > 0) {
    const daysSinceLast = daysBetween(new Date(sorted[0].completed_at), now);
    if (daysSinceLast > maxRecentGap) maxRecentGap = daysSinceLast;
  }

  const gapEarned =
    maxRecentGap <= 3  ? 25 :
    maxRecentGap <= 5  ? 20 :
    maxRecentGap <= 7  ? 14 :
    maxRecentGap <= 10 ? 7  : 0;

  // ── Factor 3: Streak (max 20pts) ──
  let streak = 0, misses = 0;
  for (let i = 0; ; i++) {
    const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toDateString();
    if (sorted.some(s => new Date(s.completed_at).toDateString() === key)) {
      streak++; misses = 0;
    } else if (++misses > 2) break;
  }

  const streakEarned =
    streak >= 7 ? 20 :
    streak >= 5 ? 16 :
    streak >= 3 ? 12 :
    streak >= 1 ? 6  : 0;

  // ── Factor 4: Trend (max 15pts) ──
  const thisMon        = mondayOf(now);
  const lastMon        = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const twoWeeksAgoMon = new Date(lastMon); twoWeeksAgoMon.setDate(lastMon.getDate() - 7);

  const thisWeek = sorted.filter(s => new Date(s.completed_at) >= thisMon).length;
  const lastWeek = sorted.filter(s => {
    const d = new Date(s.completed_at); return d >= lastMon && d < thisMon;
  }).length;
  const week2Ago = sorted.filter(s => {
    const d = new Date(s.completed_at); return d >= twoWeeksAgoMon && d < lastMon;
  }).length;

  const overallTrend: 'up' | 'down' | 'neutral' =
    thisWeek > lastWeek ? 'up' :
    thisWeek < lastWeek ? 'down' : 'neutral';

  const trendEarned =
    overallTrend === 'up'    ? 15 :
    overallTrend === 'neutral' ? 11 :
    (lastWeek - thisWeek === 1) ? 7 : 3;

  const score = freqEarned + gapEarned + streakEarned + trendEarned;

  // ── Positives / Negatives / Suggestions ──
  const positives: string[] = [];
  const negatives: string[] = [];
  const suggestions: string[] = [];

  if (thisWeek >= 3)           positives.push(isEn ? `Trained ${thisWeek}× this week` : `${thisWeek}× diese Woche trainiert`);
  if (streak >= 3)             positives.push(isEn ? `Active ${streak}-day streak` : `Aktiver ${streak}-Tage-Streak`);
  if (maxRecentGap <= 3 && recentSessions.length >= 3)
                               positives.push(isEn ? 'No long gaps in last 4 weeks' : 'Keine langen Pausen in 4 Wochen');
  if (sessPerWeek >= 3.5)      positives.push(isEn ? `High frequency: ${sessPerWeek.toFixed(1)} sess/week` : `Hohe Frequenz: ${sessPerWeek.toFixed(1)} Einh./Woche`);
  if (overallTrend === 'up')   positives.push(isEn ? `Frequency ↑ vs last week (+${thisWeek - lastWeek})` : `Frequenz ↑ vs. letzte Woche (+${thisWeek - lastWeek})`);

  if (maxRecentGap > 5)        negatives.push(isEn ? `${Math.round(maxRecentGap)}-day gap detected (last 4 weeks)` : `${Math.round(maxRecentGap)}-Tage-Pause erkannt (letzte 4 Wochen)`);
  if (sessPerWeek < 2)         negatives.push(isEn ? `Only ${sessPerWeek.toFixed(1)} sessions/week on average` : `Nur ${sessPerWeek.toFixed(1)} Einheiten/Woche im Schnitt`);
  if (thisWeek === 0)          negatives.push(isEn ? 'No sessions logged this week' : 'Keine Einheiten diese Woche');
  if (overallTrend === 'down' && lastWeek - thisWeek >= 2)
                               negatives.push(isEn ? `Frequency dropped: ${lastWeek} → ${thisWeek} sessions vs last week` : `Frequenz gesunken: ${lastWeek} → ${thisWeek} Einheiten vs. letzte Woche`);
  if (streak === 0)            negatives.push(isEn ? 'No active training streak' : 'Kein aktiver Trainings-Streak');

  if (sessPerWeek < 3)         suggestions.push(isEn ? 'Target at least 3 sessions per week' : 'Mindestens 3 Einheiten pro Woche anstreben');
  if (maxRecentGap > 5)        suggestions.push(isEn ? 'Avoid training gaps longer than 4 days' : 'Trainingspausen über 4 Tage vermeiden');
  if (streak <= 1)             suggestions.push(isEn ? 'Schedule fixed training days to build routine' : 'Feste Trainingstage für eine Routine einplanen');
  if (thisWeek === 0 && lastWeek >= 2)
                               suggestions.push(isEn ? 'Return to the gym today — momentum is everything' : 'Heute zurück ins Gym — Schwung ist alles');
  if (negatives.length === 0)  suggestions.push(isEn ? 'Keep this pace — your consistency is excellent' : 'Dieses Tempo halten — deine Konsistenz ist ausgezeichnet');

  const trendText = overallTrend === 'up'
    ? (isEn ? `↑ +${thisWeek - lastWeek} vs last week` : `↑ +${thisWeek - lastWeek} vs. letzte Woche`)
    : overallTrend === 'down'
      ? (isEn ? `↓ −${lastWeek - thisWeek} vs last week` : `↓ −${lastWeek - thisWeek} vs. letzte Woche`)
      : (isEn ? `→ Stable (${thisWeek}/${lastWeek} this/last week)` : `→ Stabil (${thisWeek}/${lastWeek} diese/letzte Woche)`);

  const summary = isEn
    ? `${sessPerWeek.toFixed(1)} sess/wk · ${maxRecentGap <= 3 ? 'no long gaps' : `max gap ${Math.round(maxRecentGap)}d`}${streak >= 3 ? ` · 🔥${streak}d streak` : ''}`
    : `${sessPerWeek.toFixed(1)} Einh./Woche · ${maxRecentGap <= 3 ? 'keine langen Pausen' : `max Pause ${Math.round(maxRecentGap)}T`}${streak >= 3 ? ` · 🔥${streak}T Streak` : ''}`;

  return {
    score,
    summary,
    factors: [
      {
        label:       isEn ? 'Frequency' : 'Frequenz',
        description: isEn
          ? `${sessPerWeek.toFixed(1)} sessions/week avg (last 4 weeks, target: 4/week)`
          : `${sessPerWeek.toFixed(1)} Einheiten/Woche (letzte 4 Wochen, Ziel: 4/Woche)`,
        earned: freqEarned, max: 40,
        positive: freqEarned >= 20,
      },
      {
        label:       isEn ? 'Gap quality' : 'Pausenqualität',
        description: isEn
          ? maxRecentGap <= 3
            ? 'No gaps over 3 days — excellent continuity'
            : `Longest gap: ${Math.round(maxRecentGap)} days (ideal: ≤4 days)`
          : maxRecentGap <= 3
            ? 'Keine Pausen über 3 Tage — ausgezeichnete Kontinuität'
            : `Längste Pause: ${Math.round(maxRecentGap)} Tage (ideal: ≤4 Tage)`,
        earned: gapEarned, max: 25,
        positive: gapEarned >= 14,
      },
      {
        label:       isEn ? 'Streak' : 'Streak',
        description: isEn
          ? streak > 0 ? `${streak}-day active streak (7 days = full points)` : 'No active streak (start one to earn points)'
          : streak > 0 ? `${streak}-Tage-Streak (7 Tage = volle Punkte)` : 'Kein aktiver Streak (starte einen für Punkte)',
        earned: streakEarned, max: 20,
        positive: streakEarned >= 12,
      },
      {
        label:       isEn ? 'Trend' : 'Trend',
        description: isEn
          ? overallTrend === 'up'
            ? `↑ Frequency improving: ${lastWeek} → ${thisWeek} sessions this week`
            : overallTrend === 'down'
              ? `↓ Frequency dropped: ${lastWeek} → ${thisWeek} sessions this week`
              : `→ Stable: ${thisWeek} sessions this week, ${lastWeek} last week`
          : overallTrend === 'up'
            ? `↑ Frequenz steigt: ${lastWeek} → ${thisWeek} Einheiten diese Woche`
            : overallTrend === 'down'
              ? `↓ Frequenz gefallen: ${lastWeek} → ${thisWeek} Einheiten diese Woche`
              : `→ Stabil: ${thisWeek} Einheiten diese Woche, ${lastWeek} letzte Woche`,
        earned: trendEarned, max: 15,
        positive: trendEarned >= 11,
      },
    ],
    positives,
    negatives,
    suggestions,
    trendDirection: overallTrend,
    trendText,
    dataNote: isEn
      ? `Based on ${recentSessions.length} sessions in the last 4 weeks`
      : `Basierend auf ${recentSessions.length} Einheiten in den letzten 4 Wochen`,
  };
}

function computeVolumeBreakdown(exSessions: CoachExerciseSession[], isEn: boolean): ScoreBreakdown {
  const now = new Date();

  const weeklySetMap: Record<string, number> = {};
  for (const es of exSessions) {
    const k = weekKey(new Date(es.completed_at));
    weeklySetMap[k] = (weeklySetMap[k] ?? 0) + es.total_sets;
  }

  const currKey   = weekKey(now);
  const currSets  = weeklySetMap[currKey] ?? 0;
  const pastKeys  = Object.keys(weeklySetMap).filter(k => k < currKey).sort().slice(-4);
  const avgSets   = pastKeys.length > 0
    ? pastKeys.reduce((s, k) => s + weeklySetMap[k], 0) / pastKeys.length : 0;
  const maxAllTime = Math.max(...Object.values(weeklySetMap), 0);

  // ── Factor 1: vs baseline (max 45pts) ──
  let baselineEarned = 0;
  if (avgSets > 0) {
    const ratio = currSets / avgSets;
    baselineEarned =
      ratio >= 1.0  ? 45 :
      ratio >= 0.85 ? 36 :
      ratio >= 0.7  ? 27 :
      ratio >= 0.5  ? 18 :
      ratio >= 0.25 ? 9  : 0;
  } else if (currSets > 0) {
    baselineEarned = 22; // first week, can't compare
  }

  // ── Factor 2: absolute weekly sets (max 30pts) ──
  const absEarned =
    currSets >= 20 ? 30 :
    currSets >= 14 ? 24 :
    currSets >= 9  ? 18 :
    currSets >= 5  ? 12 :
    currSets >= 1  ? 6  : 0;

  // ── Factor 3: trend (max 25pts) ──
  let volumeTrend: 'up' | 'down' | 'neutral' = 'neutral';
  if (pastKeys.length >= 2) {
    const last2  = pastKeys.slice(-2).map(k => weeklySetMap[k]);
    const last4  = pastKeys.map(k => weeklySetMap[k]);
    const avg2   = last2.reduce((a, b) => a + b, 0) / last2.length;
    const firstHalf = last4.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    if (avg2 > firstHalf * 1.1) volumeTrend = 'up';
    else if (avg2 < firstHalf * 0.9) volumeTrend = 'down';
  }

  const trendEarned =
    volumeTrend === 'up'   ? 25 :
    volumeTrend === 'neutral' ? 18 : 10;

  const score = baselineEarned + absEarned + trendEarned;

  // ── Positives / Negatives / Suggestions ──
  const positives: string[] = [];
  const negatives: string[] = [];
  const suggestions: string[] = [];

  if (avgSets > 0 && currSets >= avgSets * 0.9)
    positives.push(isEn
      ? `At or above your average (${currSets} vs avg ${Math.round(avgSets)} sets)`
      : `Bei oder über deinem Durchschnitt (${currSets} vs. Ø ${Math.round(avgSets)} Sätze)`);
  if (currSets === maxAllTime && currSets > 0)
    positives.push(isEn ? 'Personal best weekly volume this week!' : 'Persönlicher Wochenrekord dieses Volume!');
  if (volumeTrend === 'up')
    positives.push(isEn ? 'Volume trending upward over recent weeks' : 'Volumen steigt in den letzten Wochen');
  if (currSets >= 20)
    positives.push(isEn ? `Strong week: ${currSets} total strength sets` : `Starke Woche: ${currSets} Kraftsätze gesamt`);

  if (currSets === 0)
    negatives.push(isEn ? 'No training sets logged this week' : 'Diese Woche keine Sätze protokolliert');
  if (avgSets > 0 && currSets < avgSets * 0.6 && currSets < avgSets)
    negatives.push(isEn
      ? `${Math.round((1 - currSets / avgSets) * 100)}% below your recent average (${currSets} vs avg ${Math.round(avgSets)})`
      : `${Math.round((1 - currSets / avgSets) * 100)}% unter deinem Durchschnitt (${currSets} vs. Ø ${Math.round(avgSets)})`);
  if (volumeTrend === 'down')
    negatives.push(isEn ? 'Volume declining over recent weeks' : 'Volumen sinkt in den letzten Wochen');
  if (currSets > avgSets * 1.5 && avgSets > 5)
    negatives.push(isEn
      ? `Volume spike: +${Math.round((currSets / avgSets - 1) * 100)}% above average — monitor recovery`
      : `Volumen-Spike: +${Math.round((currSets / avgSets - 1) * 100)}% über Durchschnitt — Erholung beobachten`);

  if (currSets < avgSets * 0.7 && avgSets > 8)
    suggestions.push(isEn
      ? `Add ${Math.round(avgSets - currSets)} more sets this week to match your average`
      : `${Math.round(avgSets - currSets)} weitere Sätze diese Woche für deinen Durchschnitt`);
  if (avgSets > 0 && currSets >= avgSets * 0.9 && currSets <= avgSets * 1.2)
    suggestions.push(isEn ? 'Consistent volume — maintain this level for continued progress' : 'Konsistentes Volumen — dieses Level für weiteren Fortschritt halten');
  if (volumeTrend === 'down' && currSets > 0)
    suggestions.push(isEn ? 'Gradual volume reduction may indicate fatigue — consider a planned deload' : 'Graduelle Volumenreduktion kann Erschöpfung signalisieren — Deload einplanen');
  if (currSets > avgSets * 1.5)
    suggestions.push(isEn ? 'Ensure adequate sleep and nutrition to match this training load' : 'Ausreichend Schlaf und Ernährung für diese Trainingsbelastung sicherstellen');

  const ratioTxt = avgSets > 0
    ? `${currSets} sets (${currSets >= avgSets ? '+' : ''}${Math.round(((currSets / Math.max(avgSets, 1)) - 1) * 100)}% vs avg)`
    : `${currSets} sets`;

  return {
    score,
    summary: isEn
      ? `${currSets} sets this week · avg ${Math.round(avgSets)}/week`
      : `${currSets} Sätze diese Woche · Ø ${Math.round(avgSets)}/Woche`,
    factors: [
      {
        label:       isEn ? 'vs. Baseline' : 'vs. Grundlinie',
        description: isEn
          ? avgSets > 0
            ? `${currSets} sets this week vs ${Math.round(avgSets)}-set 4-week average (${currSets >= avgSets * 0.9 ? 'on target' : Math.round((1 - currSets / avgSets) * 100) + '% below'})`
            : `${currSets} sets (no baseline yet — keep training)`
          : avgSets > 0
            ? `${currSets} Sätze vs. Ø ${Math.round(avgSets)} Sätze (4-Wochen-Schnitt)`
            : `${currSets} Sätze (noch kein Vergleichswert)`,
        earned: baselineEarned, max: 45,
        positive: baselineEarned >= 27,
      },
      {
        label:       isEn ? 'Absolute volume' : 'Absolutes Volumen',
        description: isEn
          ? `${currSets} strength sets this week (20+ sets = full points)`
          : `${currSets} Kraftsätze diese Woche (20+ Sätze = volle Punkte)`,
        earned: absEarned, max: 30,
        positive: absEarned >= 18,
      },
      {
        label:       isEn ? 'Trend' : 'Trend',
        description: isEn
          ? volumeTrend === 'up'   ? '↑ Volume increasing over recent weeks'
          : volumeTrend === 'down' ? '↓ Volume declining over recent weeks'
          :                          '→ Volume stable across recent weeks'
          : volumeTrend === 'up'   ? '↑ Volumen steigt in den letzten Wochen'
          : volumeTrend === 'down' ? '↓ Volumen sinkt in den letzten Wochen'
          :                          '→ Volumen stabil in den letzten Wochen',
        earned: trendEarned, max: 25,
        positive: trendEarned >= 18,
      },
    ],
    positives,
    negatives,
    suggestions,
    trendDirection: volumeTrend,
    trendText: volumeTrend === 'up'
      ? (isEn ? `↑ ${ratioTxt}` : `↑ ${ratioTxt}`)
      : volumeTrend === 'down'
        ? (isEn ? `↓ ${ratioTxt}` : `↓ ${ratioTxt}`)
        : (isEn ? `→ ${ratioTxt}` : `→ ${ratioTxt}`),
    dataNote: isEn
      ? `Based on ${exSessions.length} exercise logs (last 6 months)`
      : `Basierend auf ${exSessions.length} Übungsprotokollen (letzte 6 Monate)`,
  };
}

function computeBalanceBreakdown(exSessions: CoachExerciseSession[], isEn: boolean): ScoreBreakdown {
  const now       = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000);

  let pushS = 0, pullS = 0, legS = 0;
  const recentMuscles = new Set<string>();
  const olderMuscles  = new Set<string>();
  const muscleCount: Record<string, number> = {};

  for (const es of exSessions) {
    const d = new Date(es.completed_at);
    if (d >= thirtyAgo) {
      const cat = classifyMovement(es.movement_pattern, es.primary_muscles);
      if (cat === 'push') pushS += es.total_sets;
      else if (cat === 'pull') pullS += es.total_sets;
      else if (cat === 'legs') legS  += es.total_sets;
      for (const m of es.primary_muscles) {
        muscleCount[m] = (muscleCount[m] ?? 0) + es.total_sets;
      }
    }
    for (const m of es.primary_muscles) {
      if (d >= fourteenAgo) recentMuscles.add(m);
      else olderMuscles.add(m);
    }
  }

  const total     = pushS + pullS + legS;
  const pushPct   = total > 0 ? Math.round((pushS / total) * 100) : 0;
  const pullPct   = total > 0 ? Math.round((pullS / total) * 100) : 0;
  const legPct    = total > 0 ? Math.round((legS / total)  * 100) : 0;
  const upperPct  = pushPct + pullPct;
  const ratio     = pullS > 0 ? pushS / pullS : (pushS > 0 ? 99 : 1);

  // ── Factor 1: Push/pull ratio (max 40pts) ──
  let ppEarned = 0;
  if (total >= 5) {
    ppEarned =
      ratio >= 0.85 && ratio <= 1.15 ? 40 :
      ratio >= 0.75 && ratio <= 1.25 ? 32 :
      ratio >= 0.60 && ratio <= 1.60 ? 22 :
      ratio >= 0.40 && ratio <= 2.50 ? 12 : 4;
    if (pushS === 0 || pullS === 0) ppEarned = 0;
  }

  // ── Factor 2: Leg training (max 35pts) ──
  const legEarned =
    legPct >= 30 ? 35 :
    legPct >= 20 ? 28 :
    legPct >= 10 ? 18 :
    legPct >= 5  ? 10 : 0;

  // ── Factor 3: Muscle coverage (max 25pts) ──
  const recentDistinct = [...recentMuscles].filter(m => m !== '').length;
  const coverageEarned =
    recentDistinct >= 9 ? 25 :
    recentDistinct >= 7 ? 20 :
    recentDistinct >= 5 ? 15 :
    recentDistinct >= 3 ? 8  :
    recentDistinct >= 1 ? 4  : 0;

  const score = ppEarned + legEarned + coverageEarned;

  // ── Positives / Negatives / Suggestions ──
  const positives: string[] = [];
  const negatives: string[] = [];
  const suggestions: string[] = [];

  if (ratio >= 0.85 && ratio <= 1.15 && total >= 10)
    positives.push(isEn
      ? `Push/pull ratio ${ratio.toFixed(2)}:1 — near-perfect balance`
      : `Push/Pull-Verhältnis ${ratio.toFixed(2)}:1 — nahezu perfekte Balance`);
  if (legPct >= 20)
    positives.push(isEn
      ? `Lower body: ${legPct}% of total volume — well-balanced`
      : `Unterkörper: ${legPct}% des Gesamtvolumens — ausgewogen`);
  if (recentDistinct >= 7)
    positives.push(isEn
      ? `${recentDistinct} distinct muscle groups trained in last 2 weeks`
      : `${recentDistinct} verschiedene Muskelgruppen in letzten 2 Wochen trainiert`);

  if (ratio > 1.6 && pushS > 0 && pullS > 0)
    negatives.push(isEn
      ? `Push-heavy: ${pushPct}% push vs ${pullPct}% pull (ideal: ~50/50)`
      : `Zu viel Drücken: ${pushPct}% Push vs ${pullPct}% Pull (ideal: ~50/50)`);
  if (pushS > 0 && pullS === 0)
    negatives.push(isEn ? 'No pulling movements in last 30 days' : 'Keine Zugübungen in den letzten 30 Tagen');
  if (legPct === 0 && total >= 20)
    negatives.push(isEn ? 'No leg training in last 30 days' : 'Kein Beintraining in den letzten 30 Tagen');
  if (legPct > 0 && legPct < 10)
    negatives.push(isEn
      ? `Low leg volume: only ${legPct}% of total (legs = ~50% of muscle mass)`
      : `Geringes Beinvolumen: nur ${legPct}% des Gesamten (Beine = ~50% der Muskelmasse)`);
  if (recentDistinct < 4)
    negatives.push(isEn
      ? `Only ${recentDistinct} muscle group${recentDistinct !== 1 ? 's' : ''} trained recently — limited coverage`
      : `Nur ${recentDistinct} Muskelgruppe${recentDistinct !== 1 ? 'n' : ''} zuletzt trainiert — geringe Abdeckung`);

  const SKIP = new Set(['Forearms', 'Abs', 'Obliques', 'Calves', 'Lower Back']);
  const neglected = [...olderMuscles].filter(
    m => !recentMuscles.has(m) && !SKIP.has(m) && (muscleCount[m] ?? 0) >= 3
  ).slice(0, 2);
  if (neglected.length > 0)
    negatives.push(isEn
      ? `Undertrained recently: ${neglected.join(', ')}`
      : `Kürzlich vernachlässigt: ${neglected.join(', ')}`);

  if (ratio > 1.5)
    suggestions.push(isEn
      ? 'Add pulling exercises: barbell rows, cable rows, face pulls, or pull-ups'
      : 'Zugübungen hinzufügen: Rudern, Kabelzüge, Face Pulls oder Klimmzüge');
  if (legPct < 15 && total >= 15)
    suggestions.push(isEn
      ? 'Add 1–2 leg sessions per week: squats, deadlifts, or leg press'
      : '1–2 Beineinheiten pro Woche einplanen: Kniebeugen, Kreuzheben oder Beinpresse');
  if (recentDistinct < 5)
    suggestions.push(isEn
      ? 'Vary your exercises to target more muscle groups across the week'
      : 'Übungen variieren, um mehr Muskelgruppen im Laufe der Woche zu trainieren');
  if (negatives.length === 0)
    suggestions.push(isEn
      ? 'Your balance is excellent — maintain this variety'
      : 'Deine Balance ist ausgezeichnet — diese Abwechslung beibehalten');

  const ppLabel =
    ratio >= 0.85 && ratio <= 1.15 ? (isEn ? 'balanced' : 'ausgeglichen') :
    ratio > 1.15  ? (isEn ? `push-heavy (${ratio.toFixed(1)}:1)` : `drücklastig (${ratio.toFixed(1)}:1)`) :
                   (isEn ? `pull-heavy (${(1/ratio).toFixed(1)}:1)` : `zuglastig (${(1/ratio).toFixed(1)}:1)`);

  return {
    score,
    summary: isEn
      ? `Push ${pushPct}% · Pull ${pullPct}% · Legs ${legPct}% · ${recentDistinct} muscles/2wk`
      : `Push ${pushPct}% · Pull ${pullPct}% · Beine ${legPct}% · ${recentDistinct} Muskeln/2Wo`,
    factors: [
      {
        label:       isEn ? 'Push/pull ratio' : 'Push/Pull-Verhältnis',
        description: isEn
          ? total >= 5
            ? `Push: ${pushPct}%, Pull: ${pullPct}% — ${ppLabel} (ideal: 50/50)`
            : 'Not enough data yet to assess push/pull balance'
          : total >= 5
            ? `Push: ${pushPct}%, Pull: ${pullPct}% — ${ppLabel} (ideal: 50/50)`
            : 'Noch nicht genug Daten für Push/Pull-Verhältnis',
        earned: ppEarned, max: 40,
        positive: ppEarned >= 22,
      },
      {
        label:       isEn ? 'Leg training' : 'Beintraining',
        description: isEn
          ? legPct >= 20
            ? `${legPct}% of total volume (${legS} sets) — good lower body coverage`
            : legPct > 0
              ? `Only ${legPct}% leg volume (${legS} sets) — legs undertrained relative to upper body`
              : 'No leg training detected (last 30 days) — legs = 50% of muscle mass'
          : legPct >= 20
            ? `${legPct}% Gesamtvolumen (${legS} Sätze) — gute Unterkörperabdeckung`
            : legPct > 0
              ? `Nur ${legPct}% Beinvolumen (${legS} Sätze) — Beine im Vergleich zum Oberkörper untertrainiert`
              : 'Kein Beintraining erkannt (30 Tage) — Beine = 50% der Muskelmasse',
        earned: legEarned, max: 35,
        positive: legEarned >= 18,
      },
      {
        label:       isEn ? 'Muscle coverage' : 'Muskelabdeckung',
        description: isEn
          ? `${recentDistinct} distinct muscle groups trained in last 14 days (9+ = full points)`
          : `${recentDistinct} verschiedene Muskelgruppen in den letzten 14 Tagen (9+ = volle Punkte)`,
        earned: coverageEarned, max: 25,
        positive: coverageEarned >= 15,
      },
    ],
    positives,
    negatives,
    suggestions,
    trendDirection: 'neutral',
    trendText: isEn
      ? `${pushPct}% push · ${pullPct}% pull · ${legPct}% legs`
      : `${pushPct}% Push · ${pullPct}% Pull · ${legPct}% Beine`,
    dataNote: isEn
      ? `Based on ${total} categorised sets in last 30 days`
      : `Basierend auf ${total} kategorisierten Sätzen in den letzten 30 Tagen`,
  };
}

// ─── Insight generators (with signals, causes, suggestions) ──────────────────

function genProgression(lifts: LiftProgressionEntry[], isEn: boolean): Insight[] {
  const out: Insight[] = [];

  for (const lift of lifts) {
    if (lift.session_count < 2) continue;
    const sp = cleanSparkline(lift.sparkline);
    const latest = sp.length > 0 ? sp[sp.length - 1] : lift.last_weight;

    const isNewPR =
      lift.best_weight !== null && latest !== null &&
      Math.abs(latest - lift.best_weight) < 0.3 &&
      lift.diff > 0 && lift.session_count >= 3;

    if (isNewPR) {
      out.push({
        id: `pr-${lift.exercise_id}`,
        type: 'pr', category: 'pr',
        title: isEn ? `New PR: ${lift.exercise_name}` : `Neuer PR: ${lift.exercise_name}`,
        body: isEn
          ? `You set a new personal record on ${lift.exercise_name} — ${fmtKg(lift.best_weight!)} kg. That's ${fmtKg(lift.diff)} kg more than when you started.`
          : `Neuer persönlicher Rekord bei ${lift.exercise_name} — ${fmtKg(lift.best_weight!)} kg. Das sind ${fmtKg(lift.diff)} kg mehr als zu Beginn.`,
        signals: isEn ? [
          `New peak weight: ${fmtKg(lift.best_weight!)} kg`,
          `Started at: ${fmtKg(lift.start_weight)} kg`,
          `Total improvement: +${fmtKg(lift.diff)} kg (+${Math.round(lift.pct_change)}%)`,
          `Based on ${lift.session_count} sessions`,
        ] : [
          `Neues Spitzengewicht: ${fmtKg(lift.best_weight!)} kg`,
          `Begonnen mit: ${fmtKg(lift.start_weight)} kg`,
          `Gesamtverbesserung: +${fmtKg(lift.diff)} kg (+${Math.round(lift.pct_change)}%)`,
          `Basierend auf ${lift.session_count} Einheiten`,
        ],
        suggestions: isEn ? [
          'Celebrate — this is the result of consistent work',
          `Next session: aim to maintain ${fmtKg(lift.best_weight!)} kg or add 1.25–2.5 kg`,
          'Continue the same training approach — it\'s clearly working',
        ] : [
          'Feiere diesen Moment — das ist das Ergebnis konsequenter Arbeit',
          `Nächste Einheit: ${fmtKg(lift.best_weight!)} kg halten oder 1,25–2,5 kg hinzufügen`,
          'Den aktuellen Trainingsansatz beibehalten — er funktioniert offensichtlich',
        ],
        confidenceReason: isEn
          ? `High confidence — ${lift.session_count} sessions with valid weight data confirm the progression`
          : `Hohe Konfidenz — ${lift.session_count} Einheiten mit validen Gewichtsdaten bestätigen den Fortschritt`,
        metric: `${fmtKg(lift.best_weight!)} kg`,
        trend: 'up', confidence: 'high',
        timeframe: fmtTimeframe(lift.first_logged_at, lift.last_logged_at, isEn),
        exerciseId: lift.exercise_id, priority: 95,
      });
      continue;
    }

    if (lift.pct_change >= 10 && lift.session_count >= 3) {
      const tf = fmtTimeframe(lift.first_logged_at, lift.last_logged_at, isEn);
      out.push({
        id: `prog-strong-${lift.exercise_id}`,
        type: 'positive', category: 'progression',
        title: isEn ? `${lift.exercise_name} — strong progress` : `${lift.exercise_name} — starker Fortschritt`,
        body: isEn
          ? `${lift.exercise_name} improved by +${fmtKg(lift.diff)} kg (+${Math.round(lift.pct_change)}%) over ${tf} — from ${fmtKg(lift.start_weight)} to ${fmtKg(lift.last_weight)} kg. Your current approach is working.`
          : `${lift.exercise_name} verbesserte sich um +${fmtKg(lift.diff)} kg (+${Math.round(lift.pct_change)}%) in ${tf} — von ${fmtKg(lift.start_weight)} auf ${fmtKg(lift.last_weight)} kg.`,
        signals: isEn ? [
          `Start weight: ${fmtKg(lift.start_weight)} kg`,
          `Current weight: ${fmtKg(lift.last_weight)} kg`,
          `Best weight ever: ${fmtKg(lift.best_weight ?? lift.last_weight)} kg`,
          `${lift.session_count} sessions analysed over ${tf}`,
        ] : [
          `Startgewicht: ${fmtKg(lift.start_weight)} kg`,
          `Aktuelles Gewicht: ${fmtKg(lift.last_weight)} kg`,
          `Bestes Gewicht: ${fmtKg(lift.best_weight ?? lift.last_weight)} kg`,
          `${lift.session_count} Einheiten analysiert über ${tf}`,
        ],
        suggestions: isEn ? [
          'Continue your current training structure',
          'Consider testing a new 1RM once progress slows',
          'Add 1.25–2.5 kg when all sets feel comfortable',
        ] : [
          'Aktuelle Trainingsstruktur beibehalten',
          'Neuen 1RM testen, wenn der Fortschritt nachlässt',
          '1,25–2,5 kg hinzufügen, wenn alle Sätze komfortabel sind',
        ],
        confidenceReason: isEn
          ? `${lift.session_count} sessions confirm the upward trend`
          : `${lift.session_count} Einheiten bestätigen den Aufwärtstrend`,
        metric: `+${fmtKg(lift.diff)} kg`, trend: 'up', confidence: 'high',
        timeframe: tf, exerciseId: lift.exercise_id, priority: 80,
      });
      continue;
    }

    if (sp.length >= 3 && isTrendingUp(sp, 3) && lift.diff > 0) {
      out.push({
        id: `prog-steady-${lift.exercise_id}`,
        type: 'positive', category: 'progression',
        title: isEn ? `Steady progress — ${lift.exercise_name}` : `Konstanter Fortschritt — ${lift.exercise_name}`,
        body: isEn
          ? `${lift.exercise_name} has shown consistent session-to-session improvements over ${lift.session_count} sessions — the gold standard of progressive overload.`
          : `${lift.exercise_name} zeigt in ${lift.session_count} Einheiten konstante Fortschritte — der goldene Standard des progressiven Überladens.`,
        signals: isEn ? [
          `Each of the last 3 sessions improved vs the previous`,
          `Current weight: ${fmtKg(lift.last_weight)} kg (+${fmtKg(lift.diff)} kg total)`,
          `${lift.session_count} sessions tracked`,
        ] : [
          `Jede der letzten 3 Einheiten verbesserte sich`,
          `Aktuelles Gewicht: ${fmtKg(lift.last_weight)} kg (+${fmtKg(lift.diff)} kg gesamt)`,
          `${lift.session_count} Einheiten verfolgt`,
        ],
        suggestions: isEn ? [
          'Keep the progression going — don\'t change what\'s working',
          'Increase by 1.25–2.5 kg when all sets feel controlled',
        ] : [
          'Fortschritt weiter vorantreiben — nichts ändern, was funktioniert',
          '1,25–2,5 kg erhöhen, wenn alle Sätze kontrolliert fühlen',
        ],
        metric: `+${fmtKg(lift.diff)} kg`, trend: 'up', confidence: 'medium',
        exerciseId: lift.exercise_id, priority: 65,
      });
    }

    if (sp.length >= 4 && isFlat(sp, 4) && lift.session_count >= 4) {
      const variance = (() => {
        const slice = sp.slice(-4);
        return (Math.max(...slice) - Math.min(...slice)).toFixed(1);
      })();
      out.push({
        id: `stag-${lift.exercise_id}`,
        type: 'warning', category: 'progression',
        title: isEn ? `${lift.exercise_name} — plateau detected` : `${lift.exercise_name} — Plateau erkannt`,
        body: isEn
          ? `${lift.exercise_name} has shown no meaningful weight increase over ${lift.session_count} sessions. Breaking the plateau requires a deliberate change to your training stimulus.`
          : `${lift.exercise_name} zeigt seit ${lift.session_count} Einheiten keine Gewichtssteigerung. Ein Durchbruch erfordert eine gezielte Änderung des Trainingsreizes.`,
        signals: isEn ? [
          `Last ${lift.session_count} sessions: ~${fmtKg(lift.last_weight)} kg (±${variance} kg variation)`,
          `No weight progression detected in this window`,
          `Plateau started after ${fmtTimeframe(lift.first_logged_at, lift.last_logged_at, isEn)} of training`,
        ] : [
          `Letzte ${lift.session_count} Einheiten: ~${fmtKg(lift.last_weight)} kg (±${variance} kg Variation)`,
          `Keine Gewichtssteigerung in diesem Zeitraum erkannt`,
          `Plateau nach ${fmtTimeframe(lift.first_logged_at, lift.last_logged_at, isEn)} Training`,
        ],
        causes: isEn ? [
          'Training stimulus may be too predictable (same reps/sets/weight)',
          'Possible accumulated fatigue suppressing strength expression',
          'Nutritional deficit may be limiting recovery and adaptation',
        ] : [
          'Trainingsreiz möglicherweise zu vorhersehbar (gleiche Wdh/Sätze/Gewicht)',
          'Mögliche angesammelte Erschöpfung hemmt Kraftausdruck',
          'Ernährungsdefizit kann Erholung und Anpassung begrenzen',
        ],
        suggestions: isEn ? [
          `Try adding 2.5 kg next session — even if the first set feels hard`,
          'Experiment with a different rep range (e.g. 5×5 or 3×12)',
          'Take one lighter "reset" session at 70% load, then push again',
          'Check that you\'re eating enough protein (1.6–2.2g/kg bodyweight)',
        ] : [
          `Nächste Einheit 2,5 kg mehr versuchen — auch wenn der erste Satz schwer ist`,
          'Anderen Wiederholungsbereich ausprobieren (z.B. 5×5 oder 3×12)',
          'Eine leichtere "Reset"-Einheit mit 70% Last, dann wieder steigern',
          'Proteinzufuhr prüfen (1,6–2,2 g/kg Körpergewicht)',
        ],
        confidenceReason: isEn
          ? `High confidence — ${lift.session_count} sessions with minimal weight variance (±${variance} kg) confirm the plateau`
          : `Hohe Konfidenz — ${lift.session_count} Einheiten mit minimaler Gewichtsabweichung (±${variance} kg) bestätigen das Plateau`,
        metric: `${fmtKg(lift.last_weight)} kg`, trend: 'neutral', confidence: 'high',
        exerciseId: lift.exercise_id, priority: 75,
      });
    }

    if (lift.diff < -2.5 && sp.length >= 3 && isTrendingDown(sp, 3)) {
      out.push({
        id: `regress-${lift.exercise_id}`,
        type: 'warning', category: 'progression',
        title: isEn ? `${lift.exercise_name} — weight regressing` : `${lift.exercise_name} — Gewichtsrückgang`,
        body: isEn
          ? `${lift.exercise_name} has regressed by ${fmtKg(Math.abs(lift.diff))} kg across recent sessions. Regression is usually a sign of accumulated fatigue or inadequate recovery.`
          : `${lift.exercise_name} ist um ${fmtKg(Math.abs(lift.diff))} kg in letzten Einheiten zurückgegangen. Regression ist meist ein Zeichen von angesammelter Erschöpfung.`,
        signals: isEn ? [
          `Peak weight: ${fmtKg(lift.best_weight ?? lift.start_weight)} kg`,
          `Current weight: ${fmtKg(lift.last_weight)} kg (−${fmtKg(Math.abs(lift.diff))} kg)`,
          `Downward trend confirmed over last 3 sessions`,
        ] : [
          `Spitzengewicht: ${fmtKg(lift.best_weight ?? lift.start_weight)} kg`,
          `Aktuelles Gewicht: ${fmtKg(lift.last_weight)} kg (−${fmtKg(Math.abs(lift.diff))} kg)`,
          `Abwärtstrend über letzte 3 Einheiten bestätigt`,
        ],
        causes: isEn ? [
          'Accumulated training fatigue over multiple weeks',
          'Insufficient sleep or recovery between sessions',
          'Caloric/protein deficit limiting muscle recovery',
        ] : [
          'Angesammelte Trainingsermüdung über mehrere Wochen',
          'Unzureichender Schlaf oder Erholung zwischen Einheiten',
          'Kalorien-/Proteindefizit hemmt Muskelregeneration',
        ],
        suggestions: isEn ? [
          'Take 1 full deload week at 50–60% of normal weight',
          'Prioritise 8h of sleep and adequate caloric intake',
          'After deload, resume at your last comfortable working weight',
        ] : [
          '1 Deload-Woche mit 50–60% des normalen Gewichts einlegen',
          '8 Stunden Schlaf und ausreichende Kalorienaufnahme priorisieren',
          'Nach Deload mit letztem komfortablen Arbeitsgewicht fortfahren',
        ],
        metric: `−${fmtKg(Math.abs(lift.diff))} kg`, trend: 'down', confidence: 'medium',
        exerciseId: lift.exercise_id, priority: 70,
      });
    }
  }

  return out;
}

function genConsistency(sessions: CoachSession[], isEn: boolean): Insight[] {
  const out: Insight[] = [];
  if (sessions.length === 0) return out;

  const now    = new Date();
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );

  const thisMon = mondayOf(now);
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);

  const thisWeek = sorted.filter(s => new Date(s.completed_at) >= thisMon).length;
  const lastWeek = sorted.filter(s => {
    const d = new Date(s.completed_at); return d >= lastMon && d < thisMon;
  }).length;

  let streak = 0, misses = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (sorted.some(s => new Date(s.completed_at).toDateString() === d.toDateString())) {
      streak++; misses = 0;
    } else if (++misses > 2) break;
  }

  if (thisWeek >= 4) {
    out.push({
      id: 'cons-great-week',
      type: 'positive', category: 'consistency',
      title: isEn ? `${thisWeek} workouts this week` : `${thisWeek} Einheiten diese Woche`,
      body: isEn
        ? `${thisWeek} sessions logged this week — excellent consistency. High weekly frequency is one of the strongest drivers of muscle and strength adaptation.`
        : `${thisWeek} Einheiten diese Woche — ausgezeichnete Konsistenz. Hohe Wochenfrequenz ist einer der stärksten Treiber für Muskel- und Kraftanpassung.`,
      signals: isEn ? [
        `${thisWeek} sessions completed this week`,
        `Last week: ${lastWeek} sessions`,
        `Research supports 3–5 sessions/week for optimal adaptation`,
      ] : [
        `${thisWeek} Einheiten diese Woche absolviert`,
        `Letzte Woche: ${lastWeek} Einheiten`,
        `3–5 Einheiten/Woche sind optimal für Anpassung`,
      ],
      suggestions: isEn
        ? ['Maintain this frequency — it\'s driving your progress']
        : ['Diese Frequenz beibehalten — sie treibt deinen Fortschritt an'],
      metric: `${thisWeek}×`, trend: 'up', confidence: 'high',
      timeframe: isEn ? 'this week' : 'diese Woche', priority: 70,
    });
  }

  if (thisWeek > lastWeek + 1 && lastWeek >= 1) {
    out.push({
      id: 'cons-freq-up',
      type: 'positive', category: 'consistency',
      title: isEn ? 'Training frequency up' : 'Trainingsfrequenz gestiegen',
      body: isEn
        ? `Frequency up: ${lastWeek} → ${thisWeek} sessions this week vs last. Increasing frequency, when paired with good recovery, accelerates progress.`
        : `Frequenz gestiegen: ${lastWeek} → ${thisWeek} Einheiten diese Woche. Höhere Frequenz beschleunigt bei guter Erholung den Fortschritt.`,
      signals: isEn ? [
        `This week: ${thisWeek} sessions`,
        `Last week: ${lastWeek} sessions`,
        `Increase: +${thisWeek - lastWeek} sessions`,
      ] : [
        `Diese Woche: ${thisWeek} Einheiten`,
        `Letzte Woche: ${lastWeek} Einheiten`,
        `Steigerung: +${thisWeek - lastWeek} Einheiten`,
      ],
      suggestions: isEn
        ? ['Ensure recovery keeps pace with frequency — sleep and nutrition matter']
        : ['Sicherstellen, dass Erholung mit Frequenz Schritt hält — Schlaf und Ernährung sind wichtig'],
      metric: `+${thisWeek - lastWeek}`, trend: 'up', confidence: 'medium',
      timeframe: isEn ? 'vs last week' : 'vs. letzte Woche', priority: 60,
    });
  }

  if (thisWeek < lastWeek - 1 && lastWeek >= 3) {
    out.push({
      id: 'cons-freq-down',
      type: 'warning', category: 'consistency',
      title: isEn ? 'Workout frequency dropped' : 'Trainingsfrequenz gesunken',
      body: isEn
        ? `Training frequency fell from ${lastWeek} to ${thisWeek} session${thisWeek !== 1 ? 's' : ''} this week. Consistency is the most reliable predictor of long-term progress.`
        : `Trainingsfrequenz sank von ${lastWeek} auf ${thisWeek} Einheit${thisWeek !== 1 ? 'en' : ''} diese Woche.`,
      signals: isEn ? [
        `This week: ${thisWeek} sessions`,
        `Last week: ${lastWeek} sessions`,
        `Drop: −${lastWeek - thisWeek} sessions`,
      ] : [
        `Diese Woche: ${thisWeek} Einheiten`,
        `Letzte Woche: ${lastWeek} Einheiten`,
        `Rückgang: −${lastWeek - thisWeek} Einheiten`,
      ],
      causes: isEn
        ? ['External commitments reducing available training time', 'Fatigue or soreness limiting sessions']
        : ['Externe Verpflichtungen reduzieren verfügbare Trainingszeit', 'Erschöpfung oder Muskelkater begrenzt Einheiten'],
      suggestions: isEn
        ? ['Schedule the next session now to prevent further drop', 'Even a 30-minute session maintains momentum']
        : ['Nächste Einheit jetzt einplanen', 'Schon 30 Minuten erhalten den Schwung'],
      metric: `${thisWeek}×`, trend: 'down', confidence: 'medium',
      timeframe: isEn ? 'this week' : 'diese Woche', priority: 72,
    });
  }

  if (thisWeek === 0 && lastWeek >= 2) {
    const daysSince = sorted.length > 0 ? Math.round(daysBetween(new Date(sorted[0].completed_at), now)) : 99;
    if (daysSince >= 5) {
      out.push({
        id: 'cons-inactive',
        type: 'warning', category: 'consistency',
        title: isEn ? 'No workouts this week' : 'Keine Einheiten diese Woche',
        body: isEn
          ? `${daysSince} days since your last session. Last week you completed ${lastWeek}. Returning today prevents further deconditioning.`
          : `${daysSince} Tage seit der letzten Einheit. Letzte Woche ${lastWeek} Einheiten. Heute zurückkommen verhindert weiteren Leistungsabfall.`,
        signals: isEn ? [
          `Last session: ${daysSince} days ago`,
          `Last week: ${lastWeek} sessions`,
          `This week: 0 sessions`,
        ] : [
          `Letzte Einheit: vor ${daysSince} Tagen`,
          `Letzte Woche: ${lastWeek} Einheiten`,
          `Diese Woche: 0 Einheiten`,
        ],
        causes: isEn
          ? ['Possible schedule disruption', 'Reduced motivation or fatigue']
          : ['Mögliche Terminunterbrechung', 'Reduzierte Motivation oder Erschöpfung'],
        suggestions: isEn
          ? ['Return today — even a short session breaks the pattern', 'Set a recurring calendar reminder for training days']
          : ['Heute zurückkehren — schon eine kurze Einheit unterbricht das Muster', 'Wiederkehrende Kalendererinnerung für Trainingstage setzen'],
        trend: 'down', confidence: 'high',
        timeframe: isEn ? 'this week' : 'diese Woche', priority: 82,
      });
    }
  }

  if (streak >= 7) {
    out.push({
      id: 'cons-streak-long', type: 'positive', category: 'consistency',
      title: isEn ? `${streak}-day training streak` : `${streak}-Tage-Streak`,
      body: isEn
        ? `${streak} consecutive training days — elite-level consistency. This is the foundation of lasting progress.`
        : `${streak} aufeinanderfolgende Trainingstage — Konsistenz auf Spitzenniveau.`,
      signals: isEn
        ? [`${streak} days active (allowing up to 2 rest days within the streak)`]
        : [`${streak} aktive Tage (bis zu 2 Ruhetage innerhalb des Streaks erlaubt)`],
      suggestions: isEn ? ['Prioritise sleep to protect this streak'] : ['Schlaf priorisieren, um diesen Streak zu schützen'],
      metric: `🔥 ${streak}d`, trend: 'up', confidence: 'high', priority: 88,
    });
  } else if (streak >= 3) {
    out.push({
      id: 'cons-streak', type: 'positive', category: 'consistency',
      title: isEn ? `${streak}-day streak` : `${streak}-Tage-Streak`,
      body: isEn
        ? `${streak}-day streak — momentum is building. Consistency compounds over time.`
        : `${streak}-Tage-Streak — Schwung baut sich auf. Konsistenz potenziert sich mit der Zeit.`,
      signals: isEn
        ? [`${streak} consecutive active days`]
        : [`${streak} aufeinanderfolgende aktive Tage`],
      suggestions: isEn ? ['Keep adding sessions — 7 days earns the long-streak bonus'] : ['Einheiten fortführen — 7 Tage = langer Streak-Bonus'],
      metric: `🔥 ${streak}d`, trend: 'up', confidence: 'high', priority: 62,
    });
  }

  if (sessions.length >= 10) {
    const dayCount: Record<number, number> = {};
    for (const s of sorted.slice(0, 60)) {
      const dow = new Date(s.completed_at).getDay();
      dayCount[dow] = (dayCount[dow] ?? 0) + 1;
    }
    const best = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0];
    if (best) {
      const dow = parseInt(best[0]);
      const pct = Math.round((best[1] / Math.min(sessions.length, 60)) * 100);
      const DAY_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const DAY_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
      if (pct >= 22) {
        out.push({
          id: 'cons-best-day', type: 'info', category: 'coaching',
          title: isEn ? `${DAY_EN[dow]} is your peak training day` : `${DAY_DE[dow]} ist dein stärkster Trainingstag`,
          body: isEn
            ? `${pct}% of your sessions occur on ${DAY_EN[dow]}s — your body and schedule are naturally aligned on this day.`
            : `${pct}% deiner Einheiten finden am ${DAY_DE[dow]} statt — dein Körper und Zeitplan sind an diesem Tag natürlich abgestimmt.`,
          signals: isEn ? [
            `${best[1]} of your last ${Math.min(sessions.length, 60)} sessions fell on ${DAY_EN[dow]}`,
            `${pct}% concentration — well above random (14.3% expected)`,
          ] : [
            `${best[1]} von letzten ${Math.min(sessions.length, 60)} Einheiten am ${DAY_DE[dow]}`,
            `${pct}% Konzentration — weit über Zufall (erwartet: 14,3%)`,
          ],
          suggestions: isEn
            ? [`Schedule your most demanding workouts on ${DAY_EN[dow]} to leverage this peak`]
            : [`Intensivste Einheiten auf ${DAY_DE[dow]} legen`],
          trend: 'neutral', confidence: 'medium', priority: 45,
        });
      }
    }
  }

  return out;
}

function genVolume(exSessions: CoachExerciseSession[], isEn: boolean): Insight[] {
  const out: Insight[] = [];
  if (exSessions.length === 0) return out;

  const now = new Date();
  const weeklySetMap: Record<string, number> = {};
  for (const es of exSessions) {
    const k = weekKey(new Date(es.completed_at));
    weeklySetMap[k] = (weeklySetMap[k] ?? 0) + es.total_sets;
  }

  const currKey  = weekKey(now);
  const currSets = weeklySetMap[currKey] ?? 0;
  const pastKeys = Object.keys(weeklySetMap).filter(k => k < currKey).sort().slice(-4);
  if (pastKeys.length < 2) return out;

  const avg        = pastKeys.reduce((s, k) => s + weeklySetMap[k], 0) / pastKeys.length;
  const maxAllTime = Math.max(...Object.values(weeklySetMap));

  if (currSets === maxAllTime && currSets > avg * 1.15 && avg > 8) {
    out.push({
      id: 'vol-all-time-high', type: 'positive', category: 'volume',
      title: isEn ? 'All-time high weekly volume' : 'Wochenvolumen-Rekord',
      body: isEn
        ? `${currSets} sets this week — your personal best. That's ${Math.round((currSets / avg - 1) * 100)}% above your recent average of ${Math.round(avg)} sets.`
        : `${currSets} Sätze diese Woche — dein persönlicher Rekord. Das sind ${Math.round((currSets / avg - 1) * 100)}% über deinem Durchschnitt von ${Math.round(avg)} Sätzen.`,
      signals: isEn ? [
        `This week: ${currSets} sets (all-time high)`,
        `4-week average: ${Math.round(avg)} sets/week`,
        `Above average by: +${Math.round((currSets / avg - 1) * 100)}%`,
      ] : [
        `Diese Woche: ${currSets} Sätze (Allzeit-Rekord)`,
        `4-Wochen-Durchschnitt: ${Math.round(avg)} Sätze/Woche`,
        `Über Durchschnitt: +${Math.round((currSets / avg - 1) * 100)}%`,
      ],
      suggestions: isEn
        ? ['Match sleep and nutrition to this elevated training load', 'Monitor recovery — deload if needed next week']
        : ['Schlaf und Ernährung an diese erhöhte Last anpassen', 'Erholung beobachten — Deload falls nächste Woche nötig'],
      metric: `${currSets} sets`, trend: 'up', confidence: 'high',
      timeframe: isEn ? 'this week' : 'diese Woche', priority: 78,
    });
  } else if (currSets > avg * 1.5 && avg > 8) {
    out.push({
      id: 'vol-spike', type: 'warning', category: 'volume',
      title: isEn ? 'Volume spike this week' : 'Volumen-Spike diese Woche',
      body: isEn
        ? `Volume jumped to ${currSets} sets — ${Math.round((currSets / avg - 1) * 100)}% above your ${Math.round(avg)}-set average. Rapid increases can outpace recovery capacity.`
        : `Volumen stieg auf ${currSets} Sätze — ${Math.round((currSets / avg - 1) * 100)}% über dem Durchschnitt von ${Math.round(avg)} Sätzen. Schnelle Zunahmen können die Erholungskapazität übersteigen.`,
      signals: isEn ? [
        `This week: ${currSets} sets`,
        `4-week average: ${Math.round(avg)} sets`,
        `Spike: +${Math.round((currSets / avg - 1) * 100)}% above average`,
        `Recommended max single-week increase: ~10–20%`,
      ] : [
        `Diese Woche: ${currSets} Sätze`,
        `4-Wochen-Durchschnitt: ${Math.round(avg)} Sätze`,
        `Spike: +${Math.round((currSets / avg - 1) * 100)}% über Durchschnitt`,
        `Empfohlene max. Wochensteigerung: ~10–20%`,
      ],
      causes: isEn
        ? ['Sudden return after time off', 'New training block started at too high a volume']
        : ['Plötzliche Rückkehr nach Pause', 'Neuer Trainingsblock mit zu hohem Volumen begonnen'],
      suggestions: isEn
        ? ['Ensure 7–9h of sleep this week', 'Return to baseline next week if soreness is significant']
        : ['7–9 Stunden Schlaf diese Woche sicherstellen', 'Nächste Woche zur Grundlinie zurückkehren wenn starker Muskelkater'],
      metric: `+${Math.round((currSets / avg - 1) * 100)}%`, trend: 'up', confidence: 'medium', priority: 68,
    });
  } else if (currSets < avg * 0.55 && avg > 10 && currSets > 0) {
    out.push({
      id: 'vol-low', type: 'warning', category: 'volume',
      title: isEn ? 'Volume below average this week' : 'Volumen unter Durchschnitt diese Woche',
      body: isEn
        ? `${currSets} sets this week vs your ${Math.round(avg)}-set average — ${Math.round((1 - currSets / avg) * 100)}% below. Sustained below-average volume can slow adaptations.`
        : `${currSets} Sätze vs. Ø ${Math.round(avg)} Sätze — ${Math.round((1 - currSets / avg) * 100)}% darunter. Dauerhaft geringes Volumen kann Anpassungen verlangsamen.`,
      signals: isEn ? [
        `This week: ${currSets} sets`,
        `4-week average: ${Math.round(avg)} sets`,
        `Deficit: −${Math.round(avg - currSets)} sets (${Math.round((1 - currSets / avg) * 100)}% below)`,
      ] : [
        `Diese Woche: ${currSets} Sätze`,
        `4-Wochen-Durchschnitt: ${Math.round(avg)} Sätze`,
        `Defizit: −${Math.round(avg - currSets)} Sätze (${Math.round((1 - currSets / avg) * 100)}% darunter)`,
      ],
      suggestions: isEn
        ? [`Add ${Math.round(avg - currSets)} more sets to reach your average`, 'A short supplementary session can bridge the gap']
        : [`${Math.round(avg - currSets)} weitere Sätze für deinen Durchschnitt`, 'Eine kurze Zusatzeinheit kann die Lücke schließen'],
      metric: `−${Math.round((1 - currSets / avg) * 100)}%`, trend: 'down', confidence: 'medium', priority: 63,
    });
  }

  return out;
}

function genBalance(exSessions: CoachExerciseSession[], sessions: CoachSession[], isEn: boolean): Insight[] {
  const out: Insight[] = [];
  if (exSessions.length === 0) return out;

  const now = new Date();
  const thirtyAgo   = new Date(now.getTime() - 30 * 86_400_000);
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000);

  let pushS = 0, pullS = 0, legS = 0;
  const muscleCount: Record<string, number> = {};
  const recentMuscles = new Set<string>();
  const olderMuscles  = new Set<string>();

  for (const es of exSessions) {
    const d = new Date(es.completed_at);
    if (d >= thirtyAgo) {
      const cat = classifyMovement(es.movement_pattern, es.primary_muscles);
      if (cat === 'push') pushS += es.total_sets;
      else if (cat === 'pull') pullS += es.total_sets;
      else if (cat === 'legs') legS  += es.total_sets;
      for (const m of es.primary_muscles) muscleCount[m] = (muscleCount[m] ?? 0) + es.total_sets;
    }
    for (const m of es.primary_muscles) {
      if (d >= fourteenAgo) recentMuscles.add(m);
      else olderMuscles.add(m);
    }
  }

  const total   = pushS + pullS + legS;
  if (total < 15) return out;

  const pushPct = Math.round((pushS / total) * 100);
  const pullPct = Math.round((pullS / total) * 100);
  const legPct  = Math.round((legS  / total) * 100);
  const ratio   = pullS > 0 ? pushS / pullS : (pushS > 0 ? 99 : 1);

  if (ratio > 1.65) {
    out.push({
      id: 'bal-push-heavy', type: 'warning', category: 'balance',
      title: isEn ? 'Push-heavy training imbalance' : 'Drücklastiges Trainingsungleichgewicht',
      body: isEn
        ? `Your push-to-pull ratio is ${ratio.toFixed(1)}:1 over the last 30 days. Sustained imbalance can lead to shoulder impingement, rounded posture, and long-term injury risk.`
        : `Dein Druck-Zug-Verhältnis beträgt ${ratio.toFixed(1)}:1 in den letzten 30 Tagen. Dauerhaftes Ungleichgewicht kann zu Schulterimpingement, Rundrücken und Verletzungsrisiko führen.`,
      signals: isEn ? [
        `Push volume (last 30d): ${pushS} sets (${pushPct}%)`,
        `Pull volume (last 30d): ${pullS} sets (${pullPct}%)`,
        `Ratio: ${ratio.toFixed(1)}:1 (ideal: 1.0:1)`,
      ] : [
        `Drückvolumen (30 Tage): ${pushS} Sätze (${pushPct}%)`,
        `Zugvolumen (30 Tage): ${pullS} Sätze (${pullPct}%)`,
        `Verhältnis: ${ratio.toFixed(1)}:1 (ideal: 1,0:1)`,
      ],
      causes: isEn
        ? ['Chest/shoulder exercises prioritised in programming', 'Back exercises undertrained or skipped']
        : ['Brust-/Schulterübungen werden in der Programmplanung priorisiert', 'Rückenübungen untertrainiert oder ausgelassen'],
      suggestions: isEn ? [
        'Add 1 dedicated back session per week (rows, lat pulldowns)',
        'For every push set, aim to match it with a pull set',
        'Face pulls and rear delt work are underrated — add 2 sets/session',
      ] : [
        '1 dedizierte Rückeneinheit pro Woche hinzufügen (Rudern, Latziehen)',
        'Für jeden Drücksatz einen gleichwertigen Zugsatz anstreben',
        'Face Pulls und hintere Schulter werden unterschätzt — 2 Sätze/Einheit hinzufügen',
      ],
      metric: `${ratio.toFixed(1)}:1`, trend: 'neutral', confidence: 'high', priority: 73,
    });
  } else if (ratio >= 0.8 && ratio <= 1.3) {
    out.push({
      id: 'bal-pp-good', type: 'positive', category: 'balance',
      title: isEn ? 'Push/pull balance excellent' : 'Push/Pull-Balance hervorragend',
      body: isEn
        ? `Push/pull ratio: ${ratio.toFixed(2)}:1 — near-perfect. This symmetry supports shoulder health, posture, and balanced muscle development.`
        : `Push/Pull-Verhältnis: ${ratio.toFixed(2)}:1 — nahezu perfekt. Diese Symmetrie unterstützt Schultergesundheit, Haltung und ausgewogene Muskelentwicklung.`,
      signals: isEn ? [
        `Push: ${pushPct}%, Pull: ${pullPct}% (ideal: 50/50)`,
        `Based on ${pushS + pullS} sets over last 30 days`,
      ] : [
        `Push: ${pushPct}%, Pull: ${pullPct}% (ideal: 50/50)`,
        `Basierend auf ${pushS + pullS} Sätzen in letzten 30 Tagen`,
      ],
      metric: `${ratio.toFixed(2)}:1`, trend: 'neutral', confidence: 'high', priority: 52,
    });
  }

  if (legPct === 0 && total >= 20) {
    out.push({
      id: 'bal-no-legs', type: 'warning', category: 'balance',
      title: isEn ? 'No leg training in last 30 days' : 'Kein Beintraining (30 Tage)',
      body: isEn
        ? `Legs account for ~50% of your muscle mass. Skipping them misses the strongest stimulus for systemic strength, hormonal output, and metabolic rate.`
        : `Beine machen ~50% deiner Muskelmasse aus. Sie zu überspringen bedeutet, den stärksten Reiz für systemische Kraft, Hormonausschüttung und Stoffwechsel zu verpassen.`,
      signals: isEn ? [
        `0 sets categorised as leg training in last 30 days`,
        `Total sets analysed: ${total}`,
        `Lower body = quadriceps, hamstrings, glutes, calves`,
      ] : [
        `0 Sätze als Beintraining kategorisiert in letzten 30 Tagen`,
        `Analysierte Gesamtsätze: ${total}`,
        `Unterkörper = Quadrizeps, Beinbizeps, Gesäß, Waden`,
      ],
      suggestions: isEn ? [
        'Add squats or leg press to 1–2 existing sessions',
        'Even 3–4 sets of squats per week make a meaningful difference',
        'Deadlifts count as leg training — add them to your program',
      ] : [
        'Kniebeugen oder Beinpresse zu 1–2 bestehenden Einheiten hinzufügen',
        'Schon 3–4 Kniebeugensätze pro Woche machen einen bedeutsamen Unterschied',
        'Kreuzheben zählt als Beintraining — ins Programm aufnehmen',
      ],
      trend: 'down', confidence: 'high', priority: 72,
    });
  } else if (legPct >= 25) {
    out.push({
      id: 'bal-legs-good', type: 'positive', category: 'balance',
      title: isEn ? 'Strong upper/lower body balance' : 'Gute Ober-/Unterkörper-Balance',
      body: isEn
        ? `${legPct}% of your training targets the lower body — well-rounded programming that maximises overall strength and hormonal adaptation.`
        : `${legPct}% deines Trainings zielt auf den Unterkörper ab — ausgewogenes Programm für maximale Gesamtkraft und Hormonanpassung.`,
      signals: isEn ? [
        `Leg sets: ${legS} (${legPct}% of total)`,
        `Upper body sets: ${pushS + pullS} (${100 - legPct}%)`,
      ] : [
        `Beinsätze: ${legS} (${legPct}% gesamt)`,
        `Oberkörpersätze: ${pushS + pullS} (${100 - legPct}%)`,
      ],
      metric: `${legPct}% legs`, trend: 'up', confidence: 'high', priority: 48,
    });
  }

  const SKIP = new Set(['Forearms', 'Abs', 'Obliques', 'Calves', 'Lower Back']);
  const neglected = [...olderMuscles].filter(
    m => !recentMuscles.has(m) && !SKIP.has(m) && (muscleCount[m] ?? 0) >= 3
  ).slice(0, 2);

  if (neglected.length >= 2) {
    out.push({
      id: 'bal-neglected', type: 'warning', category: 'balance',
      title: isEn ? 'Muscle groups undertraining recently' : 'Muskelgruppen kürzlich vernachlässigt',
      body: isEn
        ? `${neglected.join(' and ')} haven't appeared in your last 2 weeks of training. Consistent coverage prevents imbalances and maximises symmetrical development.`
        : `${neglected.join(' und ')} in den letzten 2 Wochen nicht trainiert. Regelmäßige Abdeckung verhindert Ungleichgewichte.`,
      signals: isEn ? [
        `Not targeted in last 14 days: ${neglected.join(', ')}`,
        `Previously trained (historically): confirmed`,
      ] : [
        `In letzten 14 Tagen nicht trainiert: ${neglected.join(', ')}`,
        `Zuvor trainiert (historisch): bestätigt`,
      ],
      suggestions: isEn
        ? neglected.map(m => `Add 2–3 sets targeting ${m} this week`)
        : neglected.map(m => `2–3 Sätze für ${m} diese Woche hinzufügen`),
      trend: 'down', confidence: 'medium', priority: 58,
    });
  }

  return out;
}

function genRecovery(sessions: CoachSession[], isEn: boolean): Insight[] {
  const out: Insight[] = [];
  if (sessions.length < 3) return out;

  const now    = new Date();
  const sorted = [...sessions]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, 20);

  const warnings: { muscle: string; hours: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const hrs = hoursBetween(new Date(sorted[i + 1].completed_at), new Date(sorted[i].completed_at));
    if (hrs < 48) {
      for (const m of sorted[i].muscles) {
        if (sorted[i + 1].muscles.includes(m) && !warnings.some(w => w.muscle === m)) {
          warnings.push({ muscle: m, hours: Math.round(hrs) });
        }
      }
    }
  }

  if (warnings.length >= 2) {
    const muscles = warnings.slice(0, 2).map(w => w.muscle);
    const minHrs  = Math.min(...warnings.slice(0, 2).map(w => w.hours));
    out.push({
      id: 'rec-insufficient', type: 'warning', category: 'recovery',
      title: isEn ? 'Recovery window may be too short' : 'Erholungsfenster möglicherweise zu kurz',
      body: isEn
        ? `${muscles.join(' and ')} were trained with less than 48h rest (as little as ${minHrs}h). Muscle protein synthesis peaks at 48–72h after a session.`
        : `${muscles.join(' und ')} wurden mit weniger als 48h Erholung trainiert (min. ${minHrs}h). Muskelproteinsynthese erreicht ihr Maximum 48–72h nach einer Einheit.`,
      signals: isEn ? [
        ...warnings.slice(0, 2).map(w => `${w.muscle}: only ${w.hours}h between sessions`),
        'Optimal recovery window: 48–72 hours',
      ] : [
        ...warnings.slice(0, 2).map(w => `${w.muscle}: nur ${w.hours}h zwischen Einheiten`),
        'Optimales Erholungsfenster: 48–72 Stunden',
      ],
      causes: isEn
        ? ['High training frequency with overlapping muscle groups', 'Insufficient rotation between push/pull/legs']
        : ['Hohe Trainingsfrequenz mit überlappenden Muskelgruppen', 'Unzureichende Rotation zwischen Push/Pull/Beine'],
      suggestions: isEn ? [
        'Allow 48h minimum between sessions targeting the same muscle',
        'Rotate: Monday Push → Wednesday Pull → Friday Legs',
        'If you must train daily, fully separate muscle groups each session',
      ] : [
        'Mindestens 48h zwischen Einheiten für dieselbe Muskelgruppe',
        'Rotation: Montag Push → Mittwoch Pull → Freitag Beine',
        'Bei täglichem Training Muskelgruppen vollständig trennen',
      ],
      trend: 'down', confidence: 'medium', priority: 76,
    });
  } else if (warnings.length === 1) {
    const { muscle, hours } = warnings[0];
    out.push({
      id: `rec-${muscle.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'info', category: 'recovery',
      title: isEn ? `${muscle}: short recovery gap (${hours}h)` : `${muscle}: kurze Erholungszeit (${hours}h)`,
      body: isEn
        ? `${muscle} was trained just ${hours} hours after the previous session. For full recovery, target 48+ hours between same-muscle sessions.`
        : `${muscle} wurde nur ${hours}h nach der vorherigen Einheit trainiert. Für vollständige Erholung: 48+ Stunden zwischen gleichen Muskeleinheiten.`,
      signals: isEn ? [
        `${muscle}: ${hours}h gap between consecutive sessions`,
        `Recommended: ≥48h for full recovery`,
        `Deficit: ${Math.max(0, 48 - hours)}h short of optimal`,
      ] : [
        `${muscle}: ${hours}h Pause zwischen aufeinanderfolgenden Einheiten`,
        `Empfohlen: ≥48h für vollständige Erholung`,
        `Defizit: ${Math.max(0, 48 - hours)}h unter optimal`,
      ],
      suggestions: isEn
        ? ['Add 1 rest day between sessions targeting the same muscle group']
        : ['1 Ruhetag zwischen Einheiten mit derselben Muskelgruppe hinzufügen'],
      trend: 'neutral', confidence: 'medium', priority: 55,
    });
  }

  const fourWeeksAgo   = new Date(now.getTime() - 28 * 86_400_000);
  const recentSessions = sorted.filter(s => new Date(s.completed_at) >= fourWeeksAgo);
  if (recentSessions.length >= 16 && sorted.length >= 20) {
    out.push({
      id: 'rec-deload', type: 'info', category: 'recovery',
      title: isEn ? 'Consider a deload week' : 'Deload-Woche empfohlen',
      body: isEn
        ? `${recentSessions.length} sessions in 4 weeks — high load. A planned deload (50–60% volume) enables supercompensation and prevents accumulation of systemic fatigue.`
        : `${recentSessions.length} Einheiten in 4 Wochen — hohe Last. Ein geplanter Deload (50–60% Volumen) ermöglicht Superkompensation und verhindert systemische Ermüdung.`,
      signals: isEn ? [
        `${recentSessions.length} sessions in last 4 weeks (avg: ${(recentSessions.length / 4).toFixed(1)}/week)`,
        `High-frequency training triggers accumulated central nervous system fatigue`,
      ] : [
        `${recentSessions.length} Einheiten in letzten 4 Wochen (Ø: ${(recentSessions.length / 4).toFixed(1)}/Woche)`,
        `Hochfrequenztraining löst angesammelte ZNS-Ermüdung aus`,
      ],
      suggestions: isEn ? [
        'Take 1 deload week: same exercises at 50–60% normal weight',
        'Focus on technique during the deload',
        'Return stronger the following week — this is not regression',
      ] : [
        '1 Deload-Woche: gleiche Übungen mit 50–60% des normalen Gewichts',
        'Technikschwerpunkt während des Deloads',
        'Die folgende Woche stärker zurückkehren — das ist kein Rückschritt',
      ],
      trend: 'neutral', confidence: 'medium', priority: 55,
    });
  }

  return out;
}

function genCoaching(
  lifts: LiftProgressionEntry[],
  exSessions: CoachExerciseSession[],
  sessions: CoachSession[],
  isEn: boolean,
): Insight[] {
  const out: Insight[] = [];
  const total = sessions.length;

  for (const m of [300, 200, 150, 100, 50, 25, 10]) {
    if (total >= m && total < m + 5) {
      out.push({
        id: `milestone-${m}`, type: 'positive', category: 'coaching',
        title: isEn ? `${total} total workouts completed` : `${total} Einheiten absolviert`,
        body: isEn
          ? `You've surpassed ${m} sessions. Each one represents a decision to improve — that discipline is compounding into real results.`
          : `Du hast die ${m}-Einheiten-Marke überschritten. Jede davon war eine Entscheidung für Verbesserung.`,
        signals: isEn
          ? [`${total} completed sessions logged in total`]
          : [`${total} abgeschlossene Einheiten insgesamt protokolliert`],
        metric: `${total}×`, trend: 'up', confidence: 'high', priority: 85,
      });
      break;
    }
  }

  const multiLifts     = lifts.filter(l => l.session_count >= 2);
  const improvingCount = multiLifts.filter(l => l.diff > 0).length;
  const stagnantCount  = multiLifts.filter(l => Math.abs(l.diff) <= 1 && l.session_count >= 4).length;

  if (multiLifts.length >= 4 && improvingCount / multiLifts.length >= 0.7) {
    out.push({
      id: 'coach-overall', type: 'positive', category: 'coaching',
      title: isEn ? 'Overall: consistent strength gains' : 'Gesamt: konstante Kraftzuwächse',
      body: isEn
        ? `${improvingCount} of ${multiLifts.length} tracked exercises are progressing — ${Math.round(improvingCount / multiLifts.length * 100)}% improvement rate. Your training is producing real results.`
        : `${improvingCount} von ${multiLifts.length} Übungen zeigen Fortschritt — ${Math.round(improvingCount / multiLifts.length * 100)}% Verbesserungsrate.`,
      signals: isEn ? [
        `Improving: ${improvingCount} exercises`,
        `Plateaued: ${stagnantCount} exercises`,
        `Declining: ${multiLifts.filter(l => l.diff < -2).length} exercises`,
      ] : [
        `Verbessernd: ${improvingCount} Übungen`,
        `Stagnierend: ${stagnantCount} Übungen`,
        `Sinkend: ${multiLifts.filter(l => l.diff < -2).length} Übungen`,
      ],
      metric: `${Math.round(improvingCount / multiLifts.length * 100)}%`,
      trend: 'up', confidence: 'high', priority: 68,
    });
  } else if (multiLifts.length >= 4 && stagnantCount / multiLifts.length >= 0.6) {
    out.push({
      id: 'coach-stagnant', type: 'warning', category: 'coaching',
      title: isEn ? 'Most lifts have stalled' : 'Fortschritt bei den meisten Übungen gestoppt',
      body: isEn
        ? `${stagnantCount} of ${multiLifts.length} tracked exercises have plateaued. This is a clear signal that your training stimulus needs to change.`
        : `${stagnantCount} von ${multiLifts.length} Übungen stagnieren. Das ist ein deutliches Signal, dass sich dein Trainingsreiz ändern muss.`,
      signals: isEn ? [
        `${stagnantCount} exercises with no weight change in ≥4 sessions`,
        `Total exercises tracked: ${multiLifts.length}`,
      ] : [
        `${stagnantCount} Übungen ohne Gewichtsveränderung in ≥4 Einheiten`,
        `Insgesamt verfolgte Übungen: ${multiLifts.length}`,
      ],
      causes: isEn
        ? ['Same rep ranges and loads used for too long', 'Possible need for periodisation or program change']
        : ['Gleiche Wiederholungsbereiche und Lasten zu lange verwendet', 'Möglicher Bedarf an Periodisierung oder Programmwechsel'],
      suggestions: isEn ? [
        'Vary rep ranges: try a strength phase (3–5 reps) or hypertrophy block (10–15 reps)',
        'Increase training intensity (RPE) on key exercises',
        'Consider switching to a structured program (linear or undulating)',
      ] : [
        'Wiederholungsbereiche variieren: Kraftphase (3–5 Wdh) oder Hypertrophieblock (10–15 Wdh)',
        'Trainingsintensität (RPE) bei Schlüsselübungen erhöhen',
        'Strukturiertes Programm in Betracht ziehen (linear oder undulierend)',
      ],
      metric: `${stagnantCount} stalled`, trend: 'neutral', confidence: 'medium', priority: 65,
    });
  }

  const earlyFlat = lifts.filter(
    l => l.session_count >= 2 && l.session_count < 4 &&
         cleanSparkline(l.sparkline).length >= 2 &&
         isFlat(cleanSparkline(l.sparkline), 2, 1.0)
  );
  if (earlyFlat.length > 0) {
    const lift = earlyFlat[0];
    out.push({
      id: `coach-increase-${lift.exercise_id}`, type: 'info', category: 'coaching',
      title: isEn ? `Add weight: ${lift.exercise_name}` : `Gewicht erhöhen: ${lift.exercise_name}`,
      body: isEn
        ? `${lift.exercise_name} has been stable at ${fmtKg(lift.last_weight)} kg. If you're completing all sets comfortably, it's time to add 2.5 kg.`
        : `${lift.exercise_name} ist stabil bei ${fmtKg(lift.last_weight)} kg. Wenn alle Sätze problemlos abgeschlossen werden, ist es Zeit für 2,5 kg mehr.`,
      signals: isEn ? [
        `Current weight: ${fmtKg(lift.last_weight)} kg`,
        `Last 2 sessions: same weight`,
        `${lift.session_count} sessions tracked`,
      ] : [
        `Aktuelles Gewicht: ${fmtKg(lift.last_weight)} kg`,
        `Letzte 2 Einheiten: gleiches Gewicht`,
        `${lift.session_count} Einheiten verfolgt`,
      ],
      suggestions: isEn
        ? [`Next session: try ${fmtKg(lift.last_weight + 2.5)} kg`, 'If that fails, add only 1.25 kg']
        : [`Nächste Einheit: ${fmtKg(lift.last_weight + 2.5)} kg probieren`, 'Falls das zu schwer: nur 1,25 kg hinzufügen'],
      metric: '+2.5 kg?', trend: 'neutral', confidence: 'medium',
      exerciseId: lift.exercise_id, priority: 42,
    });
  }

  return out;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function dedupe(insights: Insight[]): Insight[] {
  const seen = new Set<string>();
  return insights.filter(ins => {
    if (seen.has(ins.id)) return false;
    seen.add(ins.id);
    return true;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface AnalyticsInput {
  coachData:       CoachData;
  liftProgression: LiftProgressionEntry[];
  stats:           Stats;
  locale:          string;
}

export function computeAnalytics(input: AnalyticsInput): AnalyticsResult {
  const { coachData, liftProgression, locale } = input;
  const { sessions, exercise_sessions } = coachData;
  const isEn    = !locale.startsWith('de');
  const quality = dataQuality(sessions, liftProgression);

  if (quality === 'insufficient') {
    const emptyBreakdown = (score: number, s: string): import('../types').ScoreBreakdown => ({
      score, summary: s,
      factors: [], positives: [], negatives: [], suggestions: [],
      trendDirection: 'neutral', trendText: '', dataNote: '',
    });
    return {
      scores:     { consistency: 0, volume: 0, balance: 50 },
      breakdowns: {
        consistency: emptyBreakdown(0, isEn ? 'Complete 3+ workouts to unlock' : '3+ Einheiten für Einblicke'),
        volume:      emptyBreakdown(0, isEn ? 'No data yet' : 'Noch keine Daten'),
        balance:     emptyBreakdown(50, isEn ? 'No data yet' : 'Noch keine Daten'),
      },
      insights:    [],
      lastUpdated: new Date(),
      dataQuality: 'insufficient',
    };
  }

  const consistencyBd = computeConsistencyBreakdown(sessions, isEn);
  const volumeBd      = computeVolumeBreakdown(exercise_sessions, isEn);
  const balanceBd     = computeBalanceBreakdown(exercise_sessions, isEn);

  const raw: Insight[] = [
    ...genProgression(liftProgression, isEn),
    ...genConsistency(sessions, isEn),
    ...genVolume(exercise_sessions, isEn),
    ...genBalance(exercise_sessions, sessions, isEn),
    ...genRecovery(sessions, isEn),
    ...genCoaching(liftProgression, exercise_sessions, sessions, isEn),
  ];

  const unique = dedupe(raw);
  unique.sort((a, b) => b.priority - a.priority);

  return {
    scores: {
      consistency: consistencyBd.score,
      volume:      volumeBd.score,
      balance:     balanceBd.score,
    },
    breakdowns: {
      consistency: consistencyBd,
      volume:      volumeBd,
      balance:     balanceBd,
    },
    insights:    unique.slice(0, 15),
    lastUpdated: new Date(),
    dataQuality: quality,
  };
}

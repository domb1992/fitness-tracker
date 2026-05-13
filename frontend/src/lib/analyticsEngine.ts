import {
  CoachData, CoachSession, CoachExerciseSession,
  Insight, AnalyticsResult, AnalyticsScores, DataQuality,
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

// ─── Small helpers ────────────────────────────────────────────────────────────

function msToHours(ms: number): number  { return ms / 3_600_000; }
function msToDays(ms: number): number   { return ms / 86_400_000; }

function daysBetween(a: Date, b: Date): number {
  return Math.abs(msToDays(b.getTime() - a.getTime()));
}
function hoursBetween(a: Date, b: Date): number {
  return Math.abs(msToHours(b.getTime() - a.getTime()));
}

function fmtKg(v: number): string {
  return v % 1 === 0 ? `${v}` : `${v.toFixed(1)}`;
}

function fmtTimeframe(firstIso: string, lastIso: string, isEn: boolean): string {
  const days = Math.round(daysBetween(new Date(firstIso), new Date(lastIso)));
  if (days < 7)  return isEn ? `${days}d`           : `${days} T`;
  if (days < 30) return isEn ? `${Math.round(days / 7)}w`  : `${Math.round(days / 7)} Wo`;
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

// ─── Sparkline analysis ───────────────────────────────────────────────────────

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

// ─── Data quality ─────────────────────────────────────────────────────────────

function dataQuality(sessions: CoachSession[], lifts: LiftProgressionEntry[]): DataQuality {
  const n = sessions.length;
  if (n < 3)  return 'insufficient';
  if (n < 8)  return 'limited';
  if (n < 20 || lifts.length < 3) return 'good';
  return 'excellent';
}

// ─── Score computation ────────────────────────────────────────────────────────

function computeScores(
  sessions: CoachSession[],
  exSessions: CoachExerciseSession[],
  lifts: LiftProgressionEntry[],
): AnalyticsScores {
  const now = new Date();

  // ── Consistency (workouts/week over last 4 weeks) ──
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);
  const recentCount  = sessions.filter(s => new Date(s.completed_at) >= fourWeeksAgo).length;
  const sessPerWeek  = recentCount / 4;
  const consistency  = Math.round(Math.min(100,
    sessPerWeek >= 4 ? 100 :
    sessPerWeek >= 3 ? 75 + (sessPerWeek - 3) * 25 :
    sessPerWeek >= 2 ? 50 + (sessPerWeek - 2) * 25 :
    sessPerWeek >= 1 ? 25 + (sessPerWeek - 1) * 25 :
    sessPerWeek * 25
  ));

  // ── Volume (this week vs 4-week avg) ──
  const weeklySetMap: Record<string, number> = {};
  for (const es of exSessions) {
    const k = weekKey(new Date(es.completed_at));
    weeklySetMap[k] = (weeklySetMap[k] ?? 0) + es.total_sets;
  }
  const currWeekKey   = weekKey(now);
  const currWeekSets  = weeklySetMap[currWeekKey] ?? 0;
  const pastWeekKeys  = Object.keys(weeklySetMap).filter(k => k < currWeekKey).sort().slice(-4);
  let volume = 50;
  if (pastWeekKeys.length > 0) {
    const avg = pastWeekKeys.reduce((s, k) => s + weeklySetMap[k], 0) / pastWeekKeys.length;
    if (avg > 0) {
      const r = currWeekSets / avg;
      volume = Math.round(
        r >= 1.2 ? 100 :
        r >= 0.9 ? 70 + (r - 0.9) * 100 :
        r >= 0.5 ? 40 + (r - 0.5) * 75  :
        r * 80
      );
    }
  }

  // ── Balance (push / pull / legs over last 30 days) ──
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);
  let pushS = 0, pullS = 0, legS = 0;
  for (const es of exSessions) {
    if (new Date(es.completed_at) < thirtyAgo) continue;
    const cat = classifyMovement(es.movement_pattern, es.primary_muscles);
    if (cat === 'push') pushS += es.total_sets;
    else if (cat === 'pull') pullS += es.total_sets;
    else if (cat === 'legs') legS  += es.total_sets;
  }
  const total = pushS + pullS + legS;
  let balance = 50;
  if (total >= 15) {
    const ratio = pullS > 0 ? pushS / pullS : (pushS > 0 ? 3 : 1);
    balance = ratio >= 0.8 && ratio <= 1.3 ? 88 :
              ratio >= 0.6 && ratio <= 1.6 ? 65 : 40;
    if (legS / total >= 0.2) balance = Math.min(100, balance + 15);
    else if (legS === 0 && total >= 20) balance = Math.max(0, balance - 15);
  }

  // ── Readiness (composite) ──
  const readiness = Math.round(
    Math.min(100, Math.max(0, consistency * 0.4 + volume * 0.3 + balance * 0.3))
  );

  return {
    readiness:   Math.max(0, Math.min(100, readiness)),
    consistency: Math.max(0, Math.min(100, consistency)),
    volume:      Math.max(0, Math.min(100, volume)),
    balance:     Math.max(0, Math.min(100, balance)),
  };
}

// ─── Insight generators ───────────────────────────────────────────────────────

function genProgression(lifts: LiftProgressionEntry[], isEn: boolean): Insight[] {
  const out: Insight[] = [];

  for (const lift of lifts) {
    if (lift.session_count < 2) continue;
    const sp = cleanSparkline(lift.sparkline);
    const latest = sp.length > 0 ? sp[sp.length - 1] : lift.last_weight;

    // PR: latest weight equals best_weight and we actually improved
    const isNewPR =
      lift.best_weight !== null &&
      latest !== null &&
      Math.abs(latest - lift.best_weight) < 0.3 &&
      lift.diff > 0 &&
      lift.session_count >= 3;

    if (isNewPR) {
      out.push({
        id: `pr-${lift.exercise_id}`,
        type: 'pr',
        category: 'pr',
        title: isEn ? `New PR: ${lift.exercise_name}` : `Neuer PR: ${lift.exercise_name}`,
        body: isEn
          ? `You set a new personal record on ${lift.exercise_name} — ${fmtKg(lift.best_weight!)} kg. That's ${fmtKg(lift.diff)} kg more than when you started.`
          : `Neuer persönlicher Rekord bei ${lift.exercise_name} — ${fmtKg(lift.best_weight!)} kg. Das sind ${fmtKg(lift.diff)} kg mehr als zu Beginn.`,
        metric:     `${fmtKg(lift.best_weight!)} kg`,
        trend:      'up',
        confidence: 'high',
        timeframe:  fmtTimeframe(lift.first_logged_at, lift.last_logged_at, isEn),
        exerciseId: lift.exercise_id,
        priority:   95,
      });
      continue;
    }

    // Strong progression: ≥10% gain, ≥3 sessions
    if (lift.pct_change >= 10 && lift.session_count >= 3) {
      const tf = fmtTimeframe(lift.first_logged_at, lift.last_logged_at, isEn);
      out.push({
        id: `prog-strong-${lift.exercise_id}`,
        type: 'positive',
        category: 'progression',
        title: isEn
          ? `${lift.exercise_name} — strong progress`
          : `${lift.exercise_name} — starker Fortschritt`,
        body: isEn
          ? `${lift.exercise_name} improved by +${fmtKg(lift.diff)} kg (+${Math.round(lift.pct_change)}%) over ${tf} — ${fmtKg(lift.start_weight)} → ${fmtKg(lift.last_weight)} kg. Your current training stimulus is effective.`
          : `${lift.exercise_name} verbesserte sich um +${fmtKg(lift.diff)} kg (+${Math.round(lift.pct_change)}%) in ${tf} — ${fmtKg(lift.start_weight)} → ${fmtKg(lift.last_weight)} kg.`,
        metric:     `+${fmtKg(lift.diff)} kg`,
        trend:      'up',
        confidence: 'high',
        timeframe:  tf,
        exerciseId: lift.exercise_id,
        priority:   80,
      });
      continue;
    }

    // Steady gains: last 3 sessions all ascending
    if (sp.length >= 3 && isTrendingUp(sp, 3) && lift.diff > 0) {
      out.push({
        id: `prog-steady-${lift.exercise_id}`,
        type: 'positive',
        category: 'progression',
        title: isEn
          ? `Steady progress — ${lift.exercise_name}`
          : `Konstanter Fortschritt — ${lift.exercise_name}`,
        body: isEn
          ? `${lift.exercise_name} has shown consistent session-to-session gains over ${lift.session_count} sessions — the gold standard for progressive overload.`
          : `${lift.exercise_name} zeigt in den letzten ${lift.session_count} Einheiten konstante Fortschritte — der goldene Standard des progressiven Überladens.`,
        metric:     `+${fmtKg(lift.diff)} kg`,
        trend:      'up',
        confidence: 'medium',
        exerciseId: lift.exercise_id,
        priority:   65,
      });
    }

    // Stagnation: flat last 4+ sessions
    if (sp.length >= 4 && isFlat(sp, 4) && lift.session_count >= 4) {
      out.push({
        id: `stag-${lift.exercise_id}`,
        type: 'warning',
        category: 'progression',
        title: isEn
          ? `${lift.exercise_name} — plateau detected`
          : `${lift.exercise_name} — Plateau erkannt`,
        body: isEn
          ? `${lift.exercise_name} has shown no meaningful weight increase over ${lift.session_count} sessions. Try adding 2.5 kg or adjusting rep ranges to break through.`
          : `${lift.exercise_name} zeigt seit ${lift.session_count} Einheiten keine Gewichtssteigerung. Versuche 2,5 kg mehr oder passe den Wiederholungsbereich an.`,
        metric:     `${fmtKg(lift.last_weight)} kg`,
        trend:      'neutral',
        confidence: 'high',
        exerciseId: lift.exercise_id,
        priority:   75,
      });
    }

    // Regression: trending down with meaningful diff
    if (lift.diff < -2.5 && sp.length >= 3 && isTrendingDown(sp, 3)) {
      out.push({
        id: `regress-${lift.exercise_id}`,
        type: 'warning',
        category: 'progression',
        title: isEn
          ? `${lift.exercise_name} — weight regressing`
          : `${lift.exercise_name} — Gewichtsrückgang`,
        body: isEn
          ? `${lift.exercise_name} has regressed by ${fmtKg(Math.abs(lift.diff))} kg. This may indicate accumulated fatigue. A short deload week could restore performance.`
          : `${lift.exercise_name} ist um ${fmtKg(Math.abs(lift.diff))} kg gesunken. Das kann auf angesammelte Ermüdung hinweisen. Eine Entlastungswoche könnte helfen.`,
        metric:     `−${fmtKg(Math.abs(lift.diff))} kg`,
        trend:      'down',
        confidence: 'medium',
        exerciseId: lift.exercise_id,
        priority:   70,
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

  const inRange = (s: CoachSession, from: Date, to: Date) => {
    const d = new Date(s.completed_at);
    return d >= from && d < to;
  };

  const thisWeek = sorted.filter(s => new Date(s.completed_at) >= thisMon).length;
  const lastWeek = sorted.filter(s => inRange(s, lastMon, thisMon)).length;

  // Streak (up to 2 rest-day grace)
  let streak = 0, misses = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toDateString();
    if (sorted.some(s => new Date(s.completed_at).toDateString() === key)) {
      streak++; misses = 0;
    } else if (++misses > 2) break;
  }

  // Great week
  if (thisWeek >= 4) {
    out.push({
      id: 'cons-great-week',
      type: 'positive',
      category: 'consistency',
      title: isEn ? `${thisWeek} workouts this week` : `${thisWeek} Einheiten diese Woche`,
      body: isEn
        ? `Excellent — ${thisWeek} sessions logged this week. High weekly frequency is one of the strongest predictors of muscle and strength gains.`
        : `Ausgezeichnet — ${thisWeek} Einheiten diese Woche. Hohe Trainingsfrequenz ist einer der stärksten Prädiktoren für Muskel- und Kraftzuwächse.`,
      metric:     `${thisWeek}×`,
      trend:      'up',
      confidence: 'high',
      timeframe:  isEn ? 'this week' : 'diese Woche',
      priority:   70,
    });
  }

  // Frequency up vs last week
  if (thisWeek > lastWeek + 1 && lastWeek >= 1) {
    out.push({
      id: 'cons-freq-up',
      type: 'positive',
      category: 'consistency',
      title: isEn ? 'Training frequency up' : 'Trainingsfrequenz gestiegen',
      body: isEn
        ? `You're training ${thisWeek - lastWeek} more time${thisWeek - lastWeek !== 1 ? 's' : ''} this week than last. Increasing frequency, when paired with good recovery, accelerates progress.`
        : `Du trainierst diese Woche ${thisWeek - lastWeek} Mal mehr als letzte Woche. Höhere Frequenz beschleunigt den Fortschritt.`,
      metric:     `+${thisWeek - lastWeek}`,
      trend:      'up',
      confidence: 'medium',
      timeframe:  isEn ? 'vs last week' : 'vs. letzte Woche',
      priority:   60,
    });
  }

  // Frequency dropped
  if (thisWeek < lastWeek - 1 && lastWeek >= 3) {
    out.push({
      id: 'cons-freq-down',
      type: 'warning',
      category: 'consistency',
      title: isEn ? 'Workout frequency dropped' : 'Trainingsfrequenz gesunken',
      body: isEn
        ? `Your training frequency dropped from ${lastWeek} to ${thisWeek} session${thisWeek !== 1 ? 's' : ''} compared to last week. Consistent scheduling is the foundation of long-term progress.`
        : `Deine Trainingsfrequenz sank von ${lastWeek} auf ${thisWeek} Einheit${thisWeek !== 1 ? 'en' : ''} im Vergleich zur Vorwoche.`,
      metric:     `${thisWeek}×`,
      trend:      'down',
      confidence: 'medium',
      timeframe:  isEn ? 'this week' : 'diese Woche',
      priority:   72,
    });
  }

  // Inactive this week despite recent history
  if (thisWeek === 0 && lastWeek >= 2) {
    const daysSince = sorted.length > 0
      ? daysBetween(new Date(sorted[0].completed_at), now) : 99;
    if (daysSince >= 5) {
      out.push({
        id: 'cons-inactive',
        type: 'warning',
        category: 'consistency',
        title: isEn ? 'No workouts logged this week' : 'Keine Einheiten diese Woche',
        body: isEn
          ? `No sessions logged this week — last week you completed ${lastWeek}. Getting back today protects your progress and keeps momentum alive.`
          : `Diese Woche noch keine Einheiten — letzte Woche ${lastWeek} Einheiten. Jetzt zurückkommen schützt deinen Fortschritt.`,
        trend:      'down',
        confidence: 'high',
        timeframe:  isEn ? 'this week' : 'diese Woche',
        priority:   82,
      });
    }
  }

  // Long streak
  if (streak >= 7) {
    out.push({
      id: 'cons-streak-long',
      type: 'positive',
      category: 'consistency',
      title: isEn ? `${streak}-day training streak` : `${streak}-Tage-Streak`,
      body: isEn
        ? `${streak} consecutive training days — an elite display of discipline. This level of commitment is what separates consistent athletes from occasional gym-goers.`
        : `${streak} aufeinanderfolgende Trainingstage — eine beeindruckende Disziplinleistung.`,
      metric:     `🔥 ${streak}d`,
      trend:      'up',
      confidence: 'high',
      priority:   88,
    });
  } else if (streak >= 3) {
    out.push({
      id: 'cons-streak',
      type: 'positive',
      category: 'consistency',
      title: isEn ? `${streak}-day streak` : `${streak}-Tage-Streak`,
      body: isEn
        ? `You're on a ${streak}-day streak. Keep the momentum going — consistency compounds over time.`
        : `Du hast einen ${streak}-Tage-Streak. Halte den Schwung aufrecht — Konsistenz multipliziert sich mit der Zeit.`,
      metric:     `🔥 ${streak}d`,
      trend:      'up',
      confidence: 'high',
      priority:   62,
    });
  }

  // Best performance day (min 10 sessions for signal)
  if (sessions.length >= 10) {
    const dayCount: Record<number, number> = {};
    for (const s of sorted.slice(0, 60)) {
      const dow = new Date(s.completed_at).getDay();
      dayCount[dow] = (dayCount[dow] ?? 0) + 1;
    }
    const best = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0];
    if (best) {
      const dow = parseInt(best[0]);
      const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const DAY_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      const dayName = isEn ? DAY_EN[dow] : DAY_DE[dow];
      const pct = Math.round((best[1] / Math.min(sessions.length, 60)) * 100);
      if (pct >= 22) {
        out.push({
          id: 'cons-best-day',
          type: 'info',
          category: 'coaching',
          title: isEn ? `${dayName} is your strongest training day` : `${dayName} ist dein stärkster Trainingstag`,
          body: isEn
            ? `${pct}% of your sessions fall on ${dayName}s. Scheduling your heaviest lifts on this day leverages your natural weekly rhythm for peak performance.`
            : `${pct}% deiner Einheiten finden am ${dayName} statt. Plane deine schwersten Übungen auf diesen Tag für maximale Leistung.`,
          trend:      'neutral',
          confidence: 'medium',
          priority:   45,
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
      id: 'vol-all-time-high',
      type: 'positive',
      category: 'volume',
      title: isEn ? 'All-time high weekly volume' : 'Rekordvolumen diese Woche',
      body: isEn
        ? `This week's training volume (${currSets} sets) is your highest ever — ${Math.round((currSets / avg - 1) * 100)}% above your recent average. Ensure recovery matches the load.`
        : `Das Trainingsvolumen dieser Woche (${currSets} Sätze) ist dein bisher höchstes — ${Math.round((currSets / avg - 1) * 100)}% über deinem Durchschnitt. Achte auf ausreichend Erholung.`,
      metric:     `${currSets} sets`,
      trend:      'up',
      confidence: 'high',
      timeframe:  isEn ? 'this week' : 'diese Woche',
      priority:   78,
    });
  } else if (currSets > avg * 1.5 && avg > 8) {
    out.push({
      id: 'vol-spike',
      type: 'warning',
      category: 'volume',
      title: isEn ? 'Volume spike this week' : 'Volumen-Spike diese Woche',
      body: isEn
        ? `This week's volume is ${Math.round((currSets / avg - 1) * 100)}% above your 4-week average. Rapid volume spikes increase injury risk — monitor recovery carefully.`
        : `Das Volumen dieser Woche liegt ${Math.round((currSets / avg - 1) * 100)}% über deinem 4-Wochen-Durchschnitt. Schnelle Volumensteigerungen erhöhen das Verletzungsrisiko.`,
      metric:     `+${Math.round((currSets / avg - 1) * 100)}%`,
      trend:      'up',
      confidence: 'medium',
      priority:   68,
    });
  } else if (currSets < avg * 0.55 && avg > 10 && currSets > 0) {
    out.push({
      id: 'vol-low',
      type: 'warning',
      category: 'volume',
      title: isEn ? 'Training volume below average' : 'Trainingsvolumen unter Durchschnitt',
      body: isEn
        ? `This week's volume (${currSets} sets) is ${Math.round((1 - currSets / avg) * 100)}% below your recent average. Below-average volume weeks can slow muscle and strength adaptations.`
        : `Das Volumen dieser Woche (${currSets} Sätze) liegt ${Math.round((1 - currSets / avg) * 100)}% unter deinem Durchschnitt.`,
      metric:     `−${Math.round((1 - currSets / avg) * 100)}%`,
      trend:      'down',
      confidence: 'medium',
      priority:   63,
    });
  }

  // Consistent volume (low variance, sustainable load)
  if (pastKeys.length >= 3 && currSets >= avg * 0.85 && currSets <= avg * 1.25 && avg >= 12) {
    const vars = pastKeys.map(k => Math.abs(weeklySetMap[k] - avg) / avg);
    if (vars.reduce((a, b) => a + b, 0) / vars.length < 0.25) {
      out.push({
        id: 'vol-consistent',
        type: 'positive',
        category: 'volume',
        title: isEn ? 'Consistent training volume' : 'Konsistentes Trainingsvolumen',
        body: isEn
          ? `Your weekly volume has stayed remarkably stable over ${pastKeys.length} weeks — averaging ~${Math.round(avg)} sets/week. Consistent volume is the foundation of reliable progress.`
          : `Dein wöchentliches Volumen blieb über ${pastKeys.length} Wochen bemerkenswert stabil — im Durchschnitt ~${Math.round(avg)} Sätze/Woche.`,
        metric:     `~${Math.round(avg)} sets/wk`,
        trend:      'neutral',
        confidence: 'high',
        priority:   50,
      });
    }
  }

  return out;
}

function genBalance(exSessions: CoachExerciseSession[], sessions: CoachSession[], isEn: boolean): Insight[] {
  const out: Insight[] = [];
  if (exSessions.length === 0) return out;

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000);

  let pushS = 0, pullS = 0, legS = 0;
  const muscleCount: Record<string, number> = {};
  const recentMuscles  = new Set<string>();
  const olderMuscles   = new Set<string>();

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

  const total = pushS + pullS + legS;
  if (total < 15) return out;

  const ratio = pullS > 0 ? pushS / pullS : (pushS > 0 ? 99 : 1);

  if (ratio > 1.65) {
    out.push({
      id: 'bal-push-heavy',
      type: 'warning',
      category: 'balance',
      title: isEn ? 'Push-heavy imbalance' : 'Ungleichgewicht: zu viel Drücken',
      body: isEn
        ? `Your push-to-pull ratio is ${ratio.toFixed(1)}:1 over the last 30 days. Persistent imbalances can lead to shoulder impingement and postural issues. Add rows, pull-ups, or face pulls to rebalance.`
        : `Dein Druck-Zug-Verhältnis beträgt ${ratio.toFixed(1)}:1 in den letzten 30 Tagen. Das kann langfristig zu Schulter- und Haltungsproblemen führen.`,
      metric:     `${ratio.toFixed(1)}:1`,
      trend:      'neutral',
      confidence: 'high',
      priority:   73,
    });
  } else if (ratio < 0.6 && pushS > 0) {
    out.push({
      id: 'bal-pull-heavy',
      type: 'info',
      category: 'balance',
      title: isEn ? 'Pull-dominant training pattern' : 'Zugdominantes Trainingsmuster',
      body: isEn
        ? `You're pulling ${(1 / ratio).toFixed(1)}× more than pressing. For symmetrical development, try matching push and pull volume more closely.`
        : `Du ziehst ${(1 / ratio).toFixed(1)}× mehr als du drückst. Für eine ausgewogene Entwicklung solltest du das Druckvolumen angleichen.`,
      metric:     `${(1 / ratio).toFixed(1)}:1 pull`,
      trend:      'neutral',
      confidence: 'medium',
      priority:   48,
    });
  } else if (ratio >= 0.8 && ratio <= 1.3) {
    out.push({
      id: 'bal-push-pull-good',
      type: 'positive',
      category: 'balance',
      title: isEn ? 'Push/pull balance is excellent' : 'Push/Pull-Balance hervorragend',
      body: isEn
        ? `Your push-to-pull ratio is ${ratio.toFixed(1)}:1 — near-perfect balance. This symmetry supports shoulder joint health and prevents muscular imbalances.`
        : `Dein Druck-Zug-Verhältnis beträgt ${ratio.toFixed(1)}:1 — nahezu perfekte Balance. Das unterstützt die Schultergesundheit.`,
      metric:     `${ratio.toFixed(1)}:1`,
      trend:      'neutral',
      confidence: 'high',
      priority:   52,
    });
  }

  if (pushS > 0 && pullS === 0) {
    out.push({
      id: 'bal-no-pull',
      type: 'warning',
      category: 'balance',
      title: isEn ? 'No pulling movements detected' : 'Keine Zugübungen erkannt',
      body: isEn
        ? `No pulling exercises in the last 30 days. Rows, pull-ups, and lat pulldowns are essential for back development, posture, and long-term shoulder health.`
        : `In den letzten 30 Tagen wurden keine Zugübungen erkannt. Rudern, Klimmzüge und Latziehen sind essenziell für Rückenentwicklung und Schultergesundheit.`,
      trend:      'down',
      confidence: 'medium',
      priority:   70,
    });
  }

  const legPct = total > 0 ? legS / total : 0;
  if (legS === 0 && total >= 25) {
    out.push({
      id: 'bal-no-legs',
      type: 'warning',
      category: 'balance',
      title: isEn ? 'No leg training in last 30 days' : 'Kein Beintraining in 30 Tagen',
      body: isEn
        ? `Legs constitute ~50% of your muscle mass. Regular squats, deadlifts, and leg presses drive systemic strength, anabolic hormone response, and metabolic rate.`
        : `Beine machen ~50% deiner Muskelmasse aus. Kniebeugen, Kreuzheben und Beinpresse fördern Gesamtkraft und Hormonausschüttung.`,
      trend:      'down',
      confidence: 'high',
      priority:   72,
    });
  } else if (legPct >= 0.25) {
    out.push({
      id: 'bal-legs-good',
      type: 'positive',
      category: 'balance',
      title: isEn ? 'Well-rounded upper/lower balance' : 'Gute Ober-/Unterkörper-Balance',
      body: isEn
        ? `${Math.round(legPct * 100)}% of your training targets the lower body — balanced programming that maximises overall strength and hormonal adaptation.`
        : `${Math.round(legPct * 100)}% deines Trainings zielt auf den Unterkörper ab — ausgewogenes Programm für maximale Gesamtkraft.`,
      trend:      'up',
      confidence: 'high',
      priority:   48,
    });
  }

  // Neglected muscles
  const skip = new Set(['Forearms', 'Abs', 'Obliques', 'Calves', 'Lower Back']);
  const neglected = [...olderMuscles].filter(
    m => !recentMuscles.has(m) && !skip.has(m) && (muscleCount[m] ?? 0) >= 3
  );
  if (neglected.length >= 2) {
    const top = neglected.slice(0, 2);
    out.push({
      id: 'bal-neglected',
      type: 'warning',
      category: 'balance',
      title: isEn ? 'Muscle groups undertrained recently' : 'Muskelgruppen vernachlässigt',
      body: isEn
        ? `${top.join(' and ')} haven't been targeted in the last 2 weeks. Consistent coverage of all muscle groups prevents imbalances and maximises development.`
        : `${top.join(' und ')} wurden in den letzten 2 Wochen nicht trainiert. Regelmäßiges Training aller Muskelgruppen verhindert Ungleichgewichte.`,
      trend:      'down',
      confidence: 'medium',
      priority:   58,
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
    const curr = sorted[i];
    const prev = sorted[i + 1];
    const hrs  = hoursBetween(new Date(prev.completed_at), new Date(curr.completed_at));
    if (hrs < 48) {
      for (const m of curr.muscles) {
        if (prev.muscles.includes(m) && !warnings.some(w => w.muscle === m)) {
          warnings.push({ muscle: m, hours: Math.round(hrs) });
        }
      }
    }
  }

  if (warnings.length >= 2) {
    const muscles = warnings.slice(0, 2).map(w => w.muscle);
    const minHrs  = Math.min(...warnings.slice(0, 2).map(w => w.hours));
    out.push({
      id: 'rec-insufficient',
      type: 'warning',
      category: 'recovery',
      title: isEn ? 'Recovery window may be too short' : 'Erholungsfenster möglicherweise zu kurz',
      body: isEn
        ? `${muscles.join(' and ')} were trained with less than 48 hours of rest (as little as ${minHrs}h). Most muscles need 48–72h for full protein synthesis and recovery.`
        : `${muscles.join(' und ')} wurden mit weniger als 48 Stunden Erholung trainiert (min. ${minHrs}h). Die meisten Muskeln brauchen 48–72h für vollständige Regeneration.`,
      trend:      'down',
      confidence: 'medium',
      priority:   76,
    });
  } else if (warnings.length === 1) {
    const { muscle, hours } = warnings[0];
    out.push({
      id: `rec-${muscle.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'info',
      category: 'recovery',
      title: isEn ? `${muscle}: short recovery gap (${hours}h)` : `${muscle}: kurze Erholungszeit (${hours}h)`,
      body: isEn
        ? `${muscle} was trained just ${hours} hours after the previous session. Target 48+ hours between sessions for the same muscle group to maximise recovery.`
        : `${muscle} wurde nur ${hours} Stunden nach der vorherigen Einheit trainiert. Strebe 48+ Stunden Pause für dieselbe Muskelgruppe an.`,
      trend:      'neutral',
      confidence: 'medium',
      priority:   55,
    });
  }

  // Deload suggestion: very high session count over 4 weeks
  const fourWeeksAgo     = new Date(now.getTime() - 28 * 86_400_000);
  const recentSessions   = sorted.filter(s => new Date(s.completed_at) >= fourWeeksAgo);
  if (recentSessions.length >= 16 && sorted.length >= 20) {
    out.push({
      id: 'rec-deload',
      type: 'info',
      category: 'recovery',
      title: isEn ? 'Consider a deload week' : 'Deload-Woche empfohlen',
      body: isEn
        ? `You've completed ${recentSessions.length} sessions in the last 4 weeks — a high training load. A planned deload (reduced volume/intensity) allows supercompensation and prevents accumulated fatigue.`
        : `Du hast in den letzten 4 Wochen ${recentSessions.length} Einheiten absolviert. Eine geplante Entlastungswoche ermöglicht Superkompensation und verhindert Übertraining.`,
      trend:      'neutral',
      confidence: 'medium',
      priority:   55,
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

  // Milestone: total sessions
  const total = sessions.length;
  for (const m of [300, 200, 150, 100, 50, 25, 10]) {
    if (total >= m && total < m + 5) {
      out.push({
        id: `milestone-${m}`,
        type: 'positive',
        category: 'coaching',
        title: isEn ? `${total} total workouts completed` : `${total} Einheiten absolviert`,
        body: isEn
          ? `You've passed the ${m}-session mark. Every single session has contributed to your current strength, body composition, and discipline.`
          : `Du hast die ${m}-Einheiten-Marke überschritten. Jede einzelne Einheit hat zu deiner aktuellen Stärke beigetragen.`,
        metric:     `${total}×`,
        trend:      'up',
        confidence: 'high',
        priority:   85,
      });
      break;
    }
  }

  // Overall trend across all lifts
  const multiSessionLifts = lifts.filter(l => l.session_count >= 2);
  const improvingCount    = multiSessionLifts.filter(l => l.diff > 0).length;
  const stagnantCount     = multiSessionLifts.filter(l => Math.abs(l.diff) <= 1 && l.session_count >= 4).length;

  if (multiSessionLifts.length >= 4 && improvingCount / multiSessionLifts.length >= 0.7) {
    out.push({
      id: 'coach-overall-progress',
      type: 'positive',
      category: 'coaching',
      title: isEn ? 'Overall: consistent strength gains' : 'Gesamt: konstante Kraftzuwächse',
      body: isEn
        ? `${improvingCount} of ${multiSessionLifts.length} tracked exercises are progressing — a ${Math.round(improvingCount / multiSessionLifts.length * 100)}% improvement rate. Your training is working.`
        : `${improvingCount} von ${multiSessionLifts.length} Übungen zeigen Fortschritt — eine Verbesserungsrate von ${Math.round(improvingCount / multiSessionLifts.length * 100)}%.`,
      metric:     `${Math.round(improvingCount / multiSessionLifts.length * 100)}%`,
      trend:      'up',
      confidence: 'high',
      priority:   68,
    });
  } else if (multiSessionLifts.length >= 4 && stagnantCount / multiSessionLifts.length >= 0.6) {
    out.push({
      id: 'coach-overall-stagnant',
      type: 'warning',
      category: 'coaching',
      title: isEn ? 'Most lifts have stalled' : 'Fortschritt bei den meisten Übungen gestoppt',
      body: isEn
        ? `${stagnantCount} of your exercises have plateaued. Consider varying rep ranges, adding volume, or introducing a deload week to break through.`
        : `${stagnantCount} deiner Übungen stagnieren. Versuche, Wiederholungsbereiche zu variieren oder das Volumen anzupassen.`,
      metric:     `${stagnantCount} stalled`,
      trend:      'neutral',
      confidence: 'medium',
      priority:   65,
    });
  }

  // Weight increase suggestion for flat early-stage lifts (< 4 sessions, not yet stagnation threshold)
  const earlyFlatLifts = lifts.filter(
    l => l.session_count >= 2 && l.session_count < 4 && isFlat(cleanSparkline(l.sparkline), 2, 1.0)
  );
  if (earlyFlatLifts.length > 0) {
    const lift = earlyFlatLifts[0];
    out.push({
      id: `coach-increase-${lift.exercise_id}`,
      type: 'info',
      category: 'coaching',
      title: isEn
        ? `Consider adding weight on ${lift.exercise_name}`
        : `Gewicht bei ${lift.exercise_name} erhöhen`,
      body: isEn
        ? `${lift.exercise_name} has been stable at ${fmtKg(lift.last_weight)} kg. If you're completing all sets comfortably, try adding 2.5 kg next session to drive progression.`
        : `${lift.exercise_name} ist stabil bei ${fmtKg(lift.last_weight)} kg. Wenn alle Sätze problemlos abgeschlossen werden, erhöhe das Gewicht um 2,5 kg.`,
      metric:     '+2.5 kg?',
      trend:      'neutral',
      confidence: 'medium',
      exerciseId: lift.exercise_id,
      priority:   42,
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
  const { coachData, liftProgression, stats, locale } = input;
  const { sessions, exercise_sessions } = coachData;
  const isEn    = !locale.startsWith('de');
  const quality = dataQuality(sessions, liftProgression);

  if (quality === 'insufficient') {
    return {
      scores:      { readiness: 0, consistency: 0, volume: 0, balance: 50 },
      insights:    [],
      lastUpdated: new Date(),
      dataQuality: 'insufficient',
    };
  }

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
    scores:      computeScores(sessions, exercise_sessions, liftProgression),
    insights:    unique.slice(0, 15),
    lastUpdated: new Date(),
    dataQuality: quality,
  };
}

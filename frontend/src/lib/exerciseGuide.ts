import { recognizeExercise } from './exerciseDatabase';
import type { Exercise } from '../types';

export interface ExerciseGuide {
  tip: string;
  cues: string[];
  mistakes: string[];
  breathing: string;
}

// ─── By movement pattern (fallback) ──────────────────────────────────────────

const BY_PATTERN: Record<string, ExerciseGuide> = {
  horizontal_push: {
    tip: 'Retract your shoulder blades and keep them pinched throughout every rep.',
    cues: [
      'Feet flat, slight arch in lower back',
      'Elbows at 45° — not flared to 90°',
      'Grip the bar hard and try to "bend it apart"',
      'Drive through the whole palm, not just the heel',
    ],
    mistakes: [
      'Elbows flaring out — strains the shoulder joint',
      'Bouncing off the chest — wastes the stretch reflex',
      'Losing upper-back tightness mid-set',
    ],
    breathing: 'Inhale as you lower. Brace hard and exhale on the press.',
  },
  incline_push: {
    tip: 'Think of pushing up and slightly back — not straight up like a flat press.',
    cues: [
      'Set bench to 30–45° for peak upper-chest activation',
      'Grip slightly narrower than on flat bench',
      'Keep shoulder blades pinched, chest tall',
      'Drive the chest up to meet the bar on descent',
    ],
    mistakes: [
      'Angle too steep (above 45°) — loads front delts, not upper chest',
      'Losing upper-back tightness mid-set',
      'Cutting the range short at the top',
    ],
    breathing: 'Inhale on the way down. Exhale forcefully on the press.',
  },
  vertical_push: {
    tip: 'Brace your core as if absorbing a punch — this protects your lumbar spine.',
    cues: [
      'Stack ribcage directly over hips — no excessive lean back',
      'Press straight overhead; bar travels a slight arc',
      'Squeeze glutes to prevent lower-back hyperextension',
      'Shrug up at the top for full overhead range',
    ],
    mistakes: [
      'Excessive lean-back — compresses the lumbar spine',
      'Pressing forward instead of vertically',
      'Letting the bar drift away from the body on the way down',
    ],
    breathing: 'Big breath and brace before each rep. Exhale at the top.',
  },
  horizontal_pull: {
    tip: 'Lead with your elbows, not your hands — think "elbow to hip".',
    cues: [
      'Initiate by retracting the shoulder blade first',
      'Chest up, torso still — no swinging',
      'Pause at peak contraction for one count',
      'Control the eccentric — feel the full lat stretch',
    ],
    mistakes: [
      'Momentum / body English taking over',
      'Rounding the lower back under load',
      'Not achieving full scapular retraction at the top',
    ],
    breathing: 'Inhale at full stretch. Exhale as you row in.',
  },
  vertical_pull: {
    tip: 'Pull the bar to your chest — your chest goes up to meet it.',
    cues: [
      'Slight upper-back arch, chest up, look at the bar',
      'Drive elbows down AND back — not just back',
      'Depress shoulder blades before the pull',
      'Squeeze lats hard at the bottom of each rep',
    ],
    mistakes: [
      'Using bicep strength instead of lats to initiate',
      'Shrugging shoulders up during the pull',
      'Stopping short — bar should touch the upper chest',
    ],
    breathing: 'Exhale as you pull. Inhale on the controlled return.',
  },
  hip_hinge: {
    tip: 'Build tension before you pull — the bar should never jerk off the floor.',
    cues: [
      'Push the floor away — don\'t think "lift up"',
      'Keep lats engaged — protect your armpits',
      'Neutral spine from tailbone to skull throughout',
      'Lock out with glutes, not by hyperextending the back',
    ],
    mistakes: [
      'Rounding the lower back — especially off the floor',
      'Bar drifting forward away from the legs',
      'Jerking the bar instead of building tension first',
    ],
    breathing: 'Big breath and brace before every pull. Exhale at lockout.',
  },
  squat: {
    tip: 'Spread the floor outward with your feet — this fires your glutes and stabilises your knees.',
    cues: [
      'Brace your core like a 360° cylinder',
      'Knees track over toes — push them out deliberately',
      'Break at hips and knees simultaneously on descent',
      'Drive hips through at the top — don\'t just stand up',
    ],
    mistakes: [
      'Knees caving inward (valgus collapse)',
      'Heels rising — signals ankle mobility limitation',
      'Forward lean from a weak upper back or tight hips',
    ],
    breathing: 'Valsalva breath before descent. Exhale past the sticking point on the way up.',
  },
  lunge: {
    tip: 'Step far enough that your front shin stays vertical throughout.',
    cues: [
      'Torso stays upright — don\'t lean over the front knee',
      'Drive through the front heel to return',
      'Back knee drops straight down, not forward',
      'Keep hips level — don\'t let them tilt sideways',
    ],
    mistakes: [
      'Stride too short — front knee travels past toes',
      'Torso collapsing forward',
      'Pushing off the back toes instead of the front heel',
    ],
    breathing: 'Inhale as you lower. Exhale as you drive back up.',
  },
  hip_thrust: {
    tip: 'Drive through upper back and heels — not through your lower back.',
    cues: [
      'Chin tucked — avoid hyperextending the neck',
      'Feet flat and hip-width apart',
      'Squeeze glutes hard at the top for 1–2 seconds',
      'Keep ribs down — don\'t arch the lower back at lockout',
    ],
    mistakes: [
      'Hyperextending the lumbar at the top',
      'Bar too high or too low on the hip crease',
      'Heels lifting off the floor',
    ],
    breathing: 'Exhale and squeeze at full hip extension.',
  },
  curl: {
    tip: 'Squeeze the bicep peak — don\'t just get the weight up.',
    cues: [
      'Pin elbows to sides throughout the set',
      'Supinate (turn) the wrist at the top for peak contraction',
      'Control all the way down — feel the full stretch',
      'Shoulders back and down — no shrugging',
    ],
    mistakes: [
      'Swinging the torso — turns it into a back exercise',
      'Partial range — not lowering to full elbow extension',
      'Elbows drifting forward on the way up',
    ],
    breathing: 'Exhale as you curl up. Inhale as you lower.',
  },
  extension: {
    tip: 'Lock your upper arms — only your forearms should move.',
    cues: [
      'Elbows fixed in position throughout the rep',
      'Squeeze the tricep hard at full extension',
      'Slow the eccentric — don\'t let gravity take it',
      'Avoid flaring elbows outward',
    ],
    mistakes: [
      'Upper arms moving during the rep',
      'Locking out with a jerk instead of a controlled squeeze',
      'Going too heavy — breaks elbow position',
    ],
    breathing: 'Exhale on the extension. Inhale as you bend.',
  },
  fly: {
    tip: 'Think "hugging a barrel" — maintain that fixed elbow bend the whole way.',
    cues: [
      'Keep a consistent soft bend in the elbow throughout',
      'Lower until you feel a deep chest stretch',
      'Lead with your chest — not your hands — to close',
      'Keep shoulder blades retracted and stable',
    ],
    mistakes: [
      'Turning it into a press by bending elbows too much',
      'Going too heavy — reduces ROM and increases injury risk',
      'Arms going so wide the shoulder joint is at risk',
    ],
    breathing: 'Inhale as you lower and stretch. Exhale as you bring it together.',
  },
  abduction: {
    tip: 'Lead the raise with your pinky side — not your thumb.',
    cues: [
      'Slight forward torso lean (10–15°) shifts load to side delt',
      'Raise to shoulder height — going higher is traps',
      'Brief pause at the top for maximum activation',
      'Control the descent — resist gravity on the way down',
    ],
    mistakes: [
      'Shrugging up during the raise — involves trapezius',
      'Momentum or torso swing removing load from the delt',
      'Elbows below wrists — reduces lateral delt activation',
    ],
    breathing: 'Exhale as you raise. Inhale on the slow descent.',
  },
  flexion: {
    tip: 'Curl your spine like a scroll — not a sit-up.',
    cues: [
      'Press lower back firmly to the floor or pad',
      'Tuck chin slightly — look up at a 45° angle',
      'Exhale fully at the peak — deepens the contraction',
      'Hands lightly support the head, never pull',
    ],
    mistakes: [
      'Pulling on the neck with interlaced hands',
      'Using hip flexors instead of abs to lift',
      'Moving too fast — momentum replaces muscle work',
    ],
    breathing: 'Exhale completely as you crunch up. Inhale as you lower.',
  },
  isometric: {
    tip: 'Pull your belly button toward your spine and squeeze everything.',
    cues: [
      'Straight line from ankles to the top of your head',
      'Engage glutes and quads — it\'s full-body',
      'Push the floor away with forearms/hands',
      'Breathe steadily — short breaths, not held',
    ],
    mistakes: [
      'Hips piking up or sagging down',
      'Holding breath — leads to early fatigue',
      'Head drooping or neck craning forward',
    ],
    breathing: 'Diaphragmatic breathing — steady and controlled throughout.',
  },
  elevation: {
    tip: 'Shrug straight up — not forward or in circles.',
    cues: [
      'Let weight hang with straight arms to start',
      'Shrug as high as possible — full trap contraction',
      'Hold 1–2 seconds at the top',
      'Lower with control — don\'t drop',
    ],
    mistakes: [
      'Rolling shoulders — increases impingement risk',
      'Grip width limiting shrug range',
      'Too heavy — loses the actual shrug range of motion',
    ],
    breathing: 'Exhale as you shrug. Inhale as you lower.',
  },
  rotation: {
    tip: 'Rotate from your ribcage — not just your arms.',
    cues: [
      'Hips stay fixed — only the torso rotates',
      'Slow and deliberate — momentum defeats the purpose',
      'Brace your core throughout to protect the spine',
      'Keep weight close to the body for better leverage',
    ],
    mistakes: [
      'Swinging the weight instead of rotating the spine',
      'Leaning back and losing core tension',
      'Too fast — control is the entire point',
    ],
    breathing: 'Exhale as you rotate. Inhale as you return to centre.',
  },
  hip_extension: {
    tip: 'Squeeze the glute and push through the heel — not the lower back.',
    cues: [
      'Keep hips level — don\'t rotate or tilt',
      'Controlled arc — not a kick',
      'Pause at full extension and feel the glute squeeze',
      'Core stays braced throughout',
    ],
    mistakes: [
      'Using lower back to hyperextend instead of glute',
      'Swinging the leg — loses isolation',
      'Standing hip dropping on the support side',
    ],
    breathing: 'Exhale as you extend. Inhale as you return.',
  },
  calf_raise: {
    tip: 'Pause at both ends — eliminate all bounce for maximum stimulus.',
    cues: [
      'Drop heel fully below step level for a deep stretch',
      'Rise all the way onto the ball of the foot',
      'Straight leg = gastrocnemius; bent knee = soleus',
      'Slow eccentric is where the adaptation happens',
    ],
    mistakes: [
      'Bouncing through the bottom — wastes the stretch',
      'Turning feet in or out excessively',
      'Too fast — calves respond best to tempo',
    ],
    breathing: 'Breathe freely — calves tolerate high reps.',
  },
};

// ─── Exercise-specific overrides (by canonical lowercase name) ────────────────

const BY_NAME: Record<string, Partial<ExerciseGuide>> = {
  'deadlift': {
    tip: 'Take the slack out of the bar before you pull — feel it tighten, then accelerate.',
    cues: [
      'Bar over mid-foot, shoulder blades over bar',
      'Lats locked, chest up — "protect your armpits"',
      'Push the floor away — don\'t think "pull the bar up"',
      'Hips and shoulders rise at the same rate off the floor',
    ],
  },
  'squat': {
    tip: 'Own the bottom — be comfortable in the hole before you drive up.',
    cues: [
      'Brace 360° around the trunk — front, sides, and back',
      'Break at hips first, knees follow simultaneously',
      'Keep your chest up by driving the back into the bar',
      'Spread the floor on the way up, don\'t just stand',
    ],
  },
  'bench press': {
    tip: 'The upper back drives the bench — build a solid arch and keep it.',
    cues: [
      'Grip slightly wider than shoulder-width',
      'Pull the bar apart as you lower it',
      'Leg drive transfers power from the floor to the press',
      'Elbows at 45° — the safest and strongest bar path',
    ],
  },
  'pull-up': {
    tip: 'Dead hang at the start of every rep — full range builds full strength.',
    cues: [
      'Active shoulders: pack them down before pulling',
      'Standard: chest touches the bar, not chin',
      'Cross feet, squeeze glutes for full-body tension',
      'Think "elbows to hips" — not "chin to bar"',
    ],
  },
  'plank': {
    tip: 'Squeeze everything — abs, glutes, quads — think total-body tension.',
    breathing: 'Short nasal breaths — never hold your breath in a plank.',
  },
  'romanian deadlift': {
    tip: 'Feel the hamstring stretch at the bottom — that\'s your cue to reverse.',
    cues: [
      'Soft, fixed knee bend maintained throughout',
      'Hips push BACK — this is not a knee bend',
      'Bar stays in contact with the legs the entire descent',
      'Return by squeezing glutes, not by pulling with the back',
    ],
  },
  'hip thrust': {
    tip: 'The loaded position is mid-back on the bench edge — get it right before adding weight.',
    cues: [
      'Bar sits in the hip crease, padded if needed',
      'Chin tucked throughout — prevents lumbar overextension',
      'Drive through heels and upper back equally',
      'Full hip extension lockout — glute squeeze is the goal',
    ],
  },
  'lateral raise': {
    tip: 'Go lighter than you think. The side delt is small — it doesn\'t need ego weight.',
    cues: [
      'Slight forward lean (10°) pre-loads the side delt',
      'Thumbs slightly lower than pinkies at the top',
      'Pause 1 second at shoulder height before lowering',
      'Slow the descent — 3 seconds down is ideal',
    ],
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getExerciseGuide(exercise: Exercise): ExerciseGuide | null {
  const nameLower = exercise.name.trim().toLowerCase();
  const nameOverride = BY_NAME[nameLower];
  const base = exercise.movement_pattern ? BY_PATTERN[exercise.movement_pattern] : null;

  if (base) {
    return nameOverride ? { ...base, ...nameOverride } : base;
  }
  if (nameOverride && nameOverride.tip) {
    return nameOverride as ExerciseGuide;
  }
  return null;
}

/** Returns primary/secondary muscles, falling back to exerciseDatabase recognition. */
export function resolveExerciseMuscles(exercise: Exercise): {
  primary: string[];
  secondary: string[];
} {
  if (exercise.primary_muscles && exercise.primary_muscles.length > 0) {
    return {
      primary: exercise.primary_muscles,
      secondary: exercise.secondary_muscles ?? [],
    };
  }
  const result = recognizeExercise(exercise.name);
  if (result) {
    return {
      primary: result.exercise.primaryMuscles as string[],
      secondary: result.exercise.secondaryMuscles as string[],
    };
  }
  return { primary: [], secondary: [] };
}

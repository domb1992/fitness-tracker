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

// ─── German translations ──────────────────────────────────────────────────────

const BY_PATTERN_DE: Record<string, ExerciseGuide> = {
  horizontal_push: {
    tip: 'Schulterblätter zusammenziehen und während jeder Wiederholung angespannt halten.',
    cues: [
      'Füße flach, leichter Hohlkreuz',
      'Ellbogen bei 45° – nicht auf 90° abspreizen',
      'Stange fest greifen und versuchen, sie "auseinanderzubiegen"',
      'Druck durch den gesamten Handteller, nicht nur die Ferse',
    ],
    mistakes: [
      'Ellbogen zu weit abspreizen – belastet das Schultergelenk',
      'Abprallen von der Brust – verschwendet den Dehnungsreflex',
      'Verlust der Oberkörperspannung in der Satzmitte',
    ],
    breathing: 'Einatmen beim Absenken. Kräftig ausatmen beim Drücken.',
  },
  incline_push: {
    tip: 'Denk daran, nach oben und leicht zurück zu drücken – nicht gerade hoch wie beim Flachdrücken.',
    cues: [
      'Bank auf 30–45° für maximale Aktivierung der oberen Brust',
      'Griff etwas enger als auf der Flachbank',
      'Schulterblätter zusammenziehen, Brust aufgerichtet halten',
      'Brust beim Absenken zur Stange führen',
    ],
    mistakes: [
      'Winkel zu steil (über 45°) – belastet vordere Schultern statt obere Brust',
      'Verlust der Oberkörperspannung in der Satzmitte',
      'Bewegungsumfang am oberen Ende kürzen',
    ],
    breathing: 'Einatmen beim Absenken. Kräftig ausatmen beim Drücken.',
  },
  vertical_push: {
    tip: 'Bauch anspannen als würdest du einen Schlag absorbieren – das schützt die Lendenwirbelsäule.',
    cues: [
      'Brustkorb direkt über den Hüften – nicht übermäßig zurücklehnen',
      'Gerade über den Kopf drücken; Stange beschreibt einen leichten Bogen',
      'Gesäß anspannen um Hohlkreuz zu vermeiden',
      'Am Ende nach oben shruggern für vollen Overhead-Bewegungsumfang',
    ],
    mistakes: [
      'Übermäßiges Zurücklehnen – komprimiert die Lendenwirbelsäule',
      'Nach vorne statt senkrecht drücken',
      'Stange auf dem Weg nach unten vom Körper wegdriften lassen',
    ],
    breathing: 'Tief einatmen und anspannen vor jeder Wiederholung. Ausatmen am höchsten Punkt.',
  },
  horizontal_pull: {
    tip: 'Mit den Ellbogen führen, nicht mit den Händen – "Ellbogen zur Hüfte" denken.',
    cues: [
      'Mit Schulterblatt-Retraktion initiieren, nicht mit dem Arm',
      'Brust hoch, Rumpf stabil – kein Schwingen',
      'Eine Sekunde Pause bei maximaler Kontraktion',
      'Exzentrik kontrollieren – vollen Latissimus-Stretch spüren',
    ],
    mistakes: [
      'Schwung übernimmt die Arbeit',
      'Rundrücken unter Last',
      'Keine vollständige Schulterblatt-Retraktion am Endpunkt',
    ],
    breathing: 'Einatmen bei vollem Stretch. Ausatmen beim Heranziehen.',
  },
  vertical_pull: {
    tip: 'Stange zur Brust ziehen – die Brust bewegt sich nach oben zur Stange.',
    cues: [
      'Leichter Hohlkreuz, Brust hoch, Blick auf die Stange',
      'Ellbogen nach unten UND hinten – nicht nur hinten',
      'Schulterblätter vor dem Zug deprimieren',
      'Lats am unteren Punkt jeder Wiederholung stark anspannen',
    ],
    mistakes: [
      'Bizeps statt Lats zum Initiieren nutzen',
      'Schultern beim Ziehen hochziehen',
      'Unvollständiger Bewegungsumfang – Stange sollte die obere Brust berühren',
    ],
    breathing: 'Ausatmen beim Ziehen. Einatmen bei der kontrollierten Rückkehr.',
  },
  hip_hinge: {
    tip: 'Spannung aufbauen bevor du ziehst – die Stange sollte nie ruckartig vom Boden gehen.',
    cues: [
      'Boden wegdrücken – nicht "nach oben heben" denken',
      'Lats angespannt halten – Achseln schützen',
      'Neutrale Wirbelsäule vom Steißbein bis zum Hinterkopf',
      'Am Ende mit Gesäßmuskeln durchstrecken, nicht mit Hohlkreuz',
    ],
    mistakes: [
      'Rundrücken – besonders vom Boden weg',
      'Stange driftet nach vorne vom Körper',
      'Ruckartig ziehen statt Spannung aufzubauen',
    ],
    breathing: 'Tief einatmen und anspannen vor jedem Zug. Ausatmen bei Streckung.',
  },
  squat: {
    tip: 'Boden mit den Füßen auseinanderdrücken – aktiviert die Gesäßmuskeln und stabilisiert die Knie.',
    cues: [
      'Bauch wie ein 360°-Zylinder anspannen',
      'Knie über die Zehen führen – aktiv nach außen drücken',
      'Hüfte und Knie gleichzeitig beim Absenken beugen',
      'Hüfte am Ende durchdrücken – nicht einfach aufstehen',
    ],
    mistakes: [
      'Knie einwärts kollabieren (Valgus)',
      'Fersen heben – deutet auf eingeschränkte Sprunggelenksmobilität hin',
      'Vorwärtslehnen durch schwachen Oberkörper oder enge Hüften',
    ],
    breathing: 'Valsalva-Atem vor dem Absenken. Ausatmen über den Sticking Point.',
  },
  lunge: {
    tip: 'Weit genug ausschreiten, damit das vordere Schienbein während der ganzen Bewegung senkrecht bleibt.',
    cues: [
      'Rumpf aufrecht – nicht über das Vorderknie beugen',
      'Durch die vordere Ferse zurückdrücken',
      'Hinteres Knie gerade nach unten, nicht vorwärts',
      'Hüften waagerecht halten – nicht seitwärts kippen',
    ],
    mistakes: [
      'Schritt zu kurz – Vorderknie wandert über die Zehen',
      'Rumpf fällt nach vorne',
      'Von den Hinterzehen statt der Vorderferse abstoßen',
    ],
    breathing: 'Einatmen beim Absenken. Ausatmen beim Hochdrücken.',
  },
  hip_thrust: {
    tip: 'Durch den oberen Rücken und die Fersen drücken – nicht durch den unteren Rücken.',
    cues: [
      'Kinn einziehen – Nacken nicht überstrecken',
      'Füße flach und hüftbreit',
      'Gesäß am oberen Punkt 1–2 Sekunden kräftig anspannen',
      'Rippen unten halten – kein Hohlkreuz am Endpunkt',
    ],
    mistakes: [
      'Lendenwirbelsäule am oberen Punkt überstrecken',
      'Stange zu hoch oder zu niedrig in der Hüftbeuge',
      'Fersen heben sich vom Boden',
    ],
    breathing: 'Ausatmen und anspannen bei voller Hüftstreckung.',
  },
  curl: {
    tip: 'Bizepspeak anspannen – nicht einfach das Gewicht hochbringen.',
    cues: [
      'Ellbogen während des gesamten Satzes an den Seiten fixieren',
      'Handgelenk am oberen Punkt supinieren für maximale Kontraktion',
      'Bis ganz unten kontrollieren – vollen Stretch spüren',
      'Schultern hinten und unten – kein Hochziehen',
    ],
    mistakes: [
      'Rumpf schwingen – macht es zu einer Rückenübung',
      'Unvollständiger Bewegungsumfang – nicht bis zur vollen Ellbogenstreckung',
      'Ellbogen wandern beim Hochcurlen nach vorne',
    ],
    breathing: 'Ausatmen beim Hochcurlen. Einatmen beim Absenken.',
  },
  extension: {
    tip: 'Oberarme fixiert – nur die Unterarme bewegen sich.',
    cues: [
      'Ellbogen während der gesamten Wiederholung in Position',
      'Trizeps bei voller Streckung kräftig anspannen',
      'Exzentrik verlangsamen – nicht von der Schwerkraft fallen lassen',
      'Ellbogen nicht nach außen abspreizen',
    ],
    mistakes: [
      'Oberarme bewegen sich während der Wiederholung',
      'Mit Ruck ausgestreckt statt kontrolliert angespannt',
      'Zu schwer – bricht die Ellbogenposition',
    ],
    breathing: 'Ausatmen bei der Streckung. Einatmen beim Beugen.',
  },
  fly: {
    tip: '"Ein Fass umarmen" denken – diese fixierte Ellbogenbeugung die ganze Zeit halten.',
    cues: [
      'Gleichmäßige, leichte Ellbogenbeugung beibehalten',
      'Absenken bis ein tiefer Bruststretch spürbar ist',
      'Brust führt – nicht die Hände – zum Schließen',
      'Schulterblätter retrahiert und stabil halten',
    ],
    mistakes: [
      'In eine Drückübung umwandeln durch zu viel Ellbogenbeugung',
      'Zu schwer – reduziert Bewegungsumfang und erhöht Verletzungsrisiko',
      'Arme so weit, dass das Schultergelenk gefährdet ist',
    ],
    breathing: 'Einatmen beim Absenken und Strecken. Ausatmen beim Zusammenführen.',
  },
  abduction: {
    tip: 'Die Kleinfinger-Seite führt – nicht der Daumen.',
    cues: [
      'Leichte Vorwärtsneigung (10–15°) verlagert Last auf den seitlichen Deltamuskel',
      'Bis Schulterhöhe heben – höher aktiviert den Trapezius',
      'Kurze Pause oben für maximale Aktivierung',
      'Absenken kontrollieren – der Schwerkraft auf dem Weg nach unten widerstehen',
    ],
    mistakes: [
      'Hochziehen beim Heben – Trapezius übernimmt',
      'Schwung oder Rumpfbewegung entlastet den Deltamuskel',
      'Ellbogen unter Handgelenken – reduziert seitliche Deltamuskelaktivierung',
    ],
    breathing: 'Ausatmen beim Heben. Einatmen beim langsamen Absenken.',
  },
  flexion: {
    tip: 'Wirbelsäule wie eine Schriftrolle aufrollen – kein Sit-up.',
    cues: [
      'Lendenwirbelsäule fest auf dem Boden oder Pad drücken',
      'Kinn leicht einziehen – unter 45° nach oben schauen',
      'Am höchsten Punkt vollständig ausatmen – vertieft die Kontraktion',
      'Hände stützen den Kopf leicht, niemals ziehen',
    ],
    mistakes: [
      'Am Nacken mit verschränkten Händen ziehen',
      'Hüftbeuger statt Bauch zum Heben verwenden',
      'Zu schnell – Schwung ersetzt Muskelarbeit',
    ],
    breathing: 'Vollständig ausatmen beim Hochcrunchen. Einatmen beim Absenken.',
  },
  isometric: {
    tip: 'Nabel zur Wirbelsäule und alles anspannen.',
    cues: [
      'Gerade Linie von den Knöcheln bis zum Hinterkopf',
      'Gesäß und Quadrizeps anspannen – Ganzkörperspannung',
      'Boden mit Unterarmen/Händen wegdrücken',
      'Gleichmäßig atmen – kurze Atemzüge, nicht anhalten',
    ],
    mistakes: [
      'Hüfte nach oben oder unten absinken',
      'Atem anhalten – führt zu früher Erschöpfung',
      'Kopf hängt oder Nacken nach vorne',
    ],
    breathing: 'Zwerchfellatmung – gleichmäßig und kontrolliert.',
  },
  elevation: {
    tip: 'Gerade nach oben shruggern – nicht vorwärts oder in Kreisen.',
    cues: [
      'Gewicht mit gestreckten Armen hängen lassen',
      'So hoch wie möglich – volle Trapezkontraktion',
      '1–2 Sekunden oben halten',
      'Kontrolliert absenken – nicht fallen lassen',
    ],
    mistakes: [
      'Schultern rollen – erhöht das Impingement-Risiko',
      'Griffweite begrenzt den Shrug-Bereich',
      'Zu schwer – verliert den tatsächlichen Bewegungsbereich',
    ],
    breathing: 'Ausatmen beim Shruggern. Einatmen beim Absenken.',
  },
  rotation: {
    tip: 'Rotation aus dem Brustkorb – nicht nur mit den Armen.',
    cues: [
      'Hüften fixiert – nur der Rumpf rotiert',
      'Langsam und bewusst – Schwung macht die Übung zunichte',
      'Bauch während der ganzen Übung anspannen',
      'Gewicht körpernah halten für bessere Hebelwirkung',
    ],
    mistakes: [
      'Gewicht schwingen statt Wirbelsäule zu rotieren',
      'Zurücklehnen und Bauchspannung verlieren',
      'Zu schnell – Kontrolle ist das Ziel',
    ],
    breathing: 'Ausatmen bei der Rotation. Einatmen bei der Rückkehr zur Mitte.',
  },
  hip_extension: {
    tip: 'Gesäßmuskel anspannen und durch die Ferse drücken – nicht durch den unteren Rücken.',
    cues: [
      'Hüften waagerecht halten – nicht rotieren oder kippen',
      'Kontrollierter Bogen – kein Kick',
      'Bei voller Streckung pausieren und Gesäßkontraktion spüren',
      'Bauch durchgehend angespannt',
    ],
    mistakes: [
      'Lendenwirbelsäule überstrecken statt Gesäß einsetzen',
      'Bein schwingen – verliert die Isolation',
      'Standhüfte auf der Stützseite absinken',
    ],
    breathing: 'Ausatmen beim Strecken. Einatmen bei der Rückkehr.',
  },
  calf_raise: {
    tip: 'An beiden Enden pausieren – jeden Schwung eliminieren für maximalen Reiz.',
    cues: [
      'Ferse vollständig unter Stufenniveau absenken für tiefen Stretch',
      'Vollständig auf den Fußballen hochgehen',
      'Gestrecktes Bein = Gastrocnemius; gebeugtes Knie = Soleus',
      'Langsame Exzentrik – dort findet die Anpassung statt',
    ],
    mistakes: [
      'Federn am unteren Punkt – verschwendet den Stretch',
      'Füße zu weit ein- oder auswärts drehen',
      'Zu schnell – Waden sprechen am besten auf Tempo an',
    ],
    breathing: 'Frei atmen – Waden vertragen hohe Wiederholungszahlen.',
  },
};

const BY_NAME_DE: Record<string, Partial<ExerciseGuide>> = {
  'deadlift': {
    tip: 'Slack aus der Stange nehmen bevor du ziehst – spüren wie sie sich strafft, dann beschleunigen.',
    cues: [
      'Stange über Fußmitte, Schulterblätter über der Stange',
      'Lats gesichert, Brust hoch – "Achseln schützen"',
      'Boden wegdrücken – nicht "Stange hochziehen" denken',
      'Hüfte und Schultern steigen gleich schnell vom Boden auf',
    ],
  },
  'squat': {
    tip: 'Die Unterposition besitzen – wohlfühlen im Loch bevor man hochdrückt.',
    cues: [
      'Rumpf 360° anspannen – vorne, seitlich und hinten',
      'Zuerst Hüfte beugen, Knie folgen gleichzeitig',
      'Brust hochhalten durch den Rücken gegen die Stange drücken',
      'Boden auf dem Weg hoch auseinanderdrücken, nicht nur aufstehen',
    ],
  },
  'bench press': {
    tip: 'Der obere Rücken treibt die Bank – soliden Bogen aufbauen und halten.',
    cues: [
      'Griff etwas breiter als schulterbreit',
      'Stange beim Absenken auseinanderziehen',
      'Beindruck überträgt Kraft vom Boden auf den Druck',
      'Ellbogen bei 45° – der sicherste und stärkste Stangenpfad',
    ],
  },
  'pull-up': {
    tip: 'Toter Hang am Anfang jeder Wiederholung – voller Bewegungsumfang baut volle Kraft.',
    cues: [
      'Aktive Schultern: vor dem Ziehen nach unten packen',
      'Standard: Brust berührt die Stange, nicht Kinn',
      'Füße kreuzen, Gesäß anspannen für Ganzkörperspannung',
      '"Ellbogen zur Hüfte" denken – nicht "Kinn zur Stange"',
    ],
  },
  'plank': {
    tip: 'Alles anspannen – Bauch, Gesäß, Quadrizeps – totale Körperspannung.',
    breathing: 'Kurze Atemzüge durch die Nase – niemals Atem anhalten in einer Planke.',
  },
  'romanian deadlift': {
    tip: 'Hamstring-Stretch am unteren Punkt spüren – das ist das Signal zur Umkehr.',
    cues: [
      'Weiche, fixierte Kniebeugung während der gesamten Übung',
      'Hüfte drückt ZURÜCK – dies ist keine Kniebeugung',
      'Stange bleibt beim gesamten Absenken in Körperkontakt',
      'Rückkehr durch Gesäßmuskeln anspannen, nicht durch Rücken ziehen',
    ],
  },
  'hip thrust': {
    tip: 'Die Belastungsposition ist Mitte Rücken auf der Bankkante – vor dem Gewichtsauflegen richtig positionieren.',
    cues: [
      'Stange liegt in der Hüftbeuge, gepolstert wenn nötig',
      'Kinn während der ganzen Übung eingezogen – verhindert Lendenübersteckung',
      'Gleichmäßig durch Fersen und oberen Rücken drücken',
      'Volle Hüftstreckung am Endpunkt – Gesäßanspannung ist das Ziel',
    ],
  },
  'lateral raise': {
    tip: 'Leichter als gedacht nehmen. Der seitliche Deltamuskel ist klein – kein Ego-Gewicht.',
    cues: [
      'Leichte Vorwärtsneigung (10°) aktiviert den seitlichen Deltamuskel vor',
      'Daumen leicht tiefer als Kleinfinger am oberen Punkt',
      '1 Sekunde Pause auf Schulterhöhe vor dem Absenken',
      'Absenken verlangsamen – 3 Sekunden nach unten ist ideal',
    ],
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getExerciseGuide(exercise: Exercise, locale?: string): ExerciseGuide | null {
  const nameLower = exercise.name.trim().toLowerCase();
  const isDE = locale === 'de';
  const patternMap = isDE ? BY_PATTERN_DE : BY_PATTERN;
  const nameMap    = isDE ? BY_NAME_DE    : BY_NAME;

  const nameOverride = nameMap[nameLower];
  const base = exercise.movement_pattern ? patternMap[exercise.movement_pattern] : null;

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

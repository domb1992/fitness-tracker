// ============================================================
// FitTrack – Exercise Database & Muscle Recognition
// ============================================================

// ─── Fixed muscle list ────────────────────────────────────────────────────────

export const MUSCLES = [
  'Chest', 'Upper Chest',
  'Back', 'Latissimus', 'Trapezius', 'Rhomboids', 'Rear Delts',
  'Front Delts', 'Side Delts',
  'Biceps', 'Triceps', 'Forearms',
  'Abs', 'Obliques', 'Lower Back',
  'Glutes', 'Quadriceps', 'Hamstrings', 'Calves',
] as const;

export type Muscle = typeof MUSCLES[number];

// Grouped by region for the UI picker
export const MUSCLE_REGIONS: { label: string; muscles: Muscle[] }[] = [
  { label: 'Chest',     muscles: ['Chest', 'Upper Chest'] },
  { label: 'Back',      muscles: ['Back', 'Latissimus', 'Trapezius', 'Rhomboids', 'Rear Delts'] },
  { label: 'Shoulders', muscles: ['Front Delts', 'Side Delts', 'Rear Delts'] },
  { label: 'Arms',      muscles: ['Biceps', 'Triceps', 'Forearms'] },
  { label: 'Core',      muscles: ['Abs', 'Obliques', 'Lower Back'] },
  { label: 'Legs',      muscles: ['Glutes', 'Quadriceps', 'Hamstrings', 'Calves'] },
];

// ─── Exercise entry ───────────────────────────────────────────────────────────

export interface ExerciseEntry {
  name:             string;
  aliases:          string[];
  primaryMuscles:   Muscle[];
  secondaryMuscles: Muscle[];
  movementPattern:  string;
  equipment:        string;
  category:         string;
}

export interface RecognitionResult {
  exercise:   ExerciseEntry;
  confidence: number; // 0–1
}

// ─── Exercise database ────────────────────────────────────────────────────────
// Canonical name is English; aliases cover German names and common variations.

export const EXERCISE_DATABASE: ExerciseEntry[] = [

  // ── Chest ──────────────────────────────────────────────────────────────────
  {
    name: 'Bench Press',
    aliases: ['Bankdrücken', 'Flachbankdrücken', 'Barbell Bench Press', 'BB Bench Press',
              'Bench', 'LH Bankdrücken', 'Langhantel Bankdrücken'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Front Delts', 'Triceps'],
    movementPattern: 'horizontal_push',
    equipment: 'barbell',
    category: 'chest',
  },
  {
    name: 'Incline Bench Press',
    aliases: ['Schrägbankdrücken', 'Schrägbank aufwärts', 'Incline Press',
              'Incline Bankdrücken', 'LH Schrägbank', 'Incline Barbell Press'],
    primaryMuscles: ['Upper Chest'],
    secondaryMuscles: ['Front Delts', 'Triceps'],
    movementPattern: 'incline_push',
    equipment: 'barbell',
    category: 'chest',
  },
  {
    name: 'Decline Bench Press',
    aliases: ['Schrägbank abwärts', 'Decline Press', 'Decline Bankdrücken'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Front Delts'],
    movementPattern: 'decline_push',
    equipment: 'barbell',
    category: 'chest',
  },
  {
    name: 'Dumbbell Bench Press',
    aliases: ['KH Bankdrücken', 'Kurzhantel Bankdrücken', 'Dumbbell Press',
              'DB Bench Press', 'Hantel Bankdrücken'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Front Delts', 'Triceps'],
    movementPattern: 'horizontal_push',
    equipment: 'dumbbell',
    category: 'chest',
  },
  {
    name: 'Incline Dumbbell Press',
    aliases: ['KH Schrägbank', 'Kurzhantel Schrägbank', 'Incline DB Press',
              'DB Incline Press', 'Schrägbank KH'],
    primaryMuscles: ['Upper Chest'],
    secondaryMuscles: ['Front Delts', 'Triceps'],
    movementPattern: 'incline_push',
    equipment: 'dumbbell',
    category: 'chest',
  },
  {
    name: 'Dumbbell Fly',
    aliases: ['KH Fliegende', 'Kurzhantel Fliegende', 'DB Fly', 'Chest Fly',
              'Flyes', 'KH Flyes', 'Butterfly KH'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Front Delts'],
    movementPattern: 'fly',
    equipment: 'dumbbell',
    category: 'chest',
  },
  {
    name: 'Cable Fly',
    aliases: ['Kabel Fliegende', 'Cable Crossover', 'Kabel Crossover',
              'Seilzug Fliegende', 'Crossover', 'Kabel Fly'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Front Delts'],
    movementPattern: 'fly',
    equipment: 'cable',
    category: 'chest',
  },
  {
    name: 'Machine Chest Press',
    aliases: ['Brust Maschine', 'Chest Press Maschine', 'Brustpresse',
              'Chest Press Machine', 'Hammer Strength Chest'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Front Delts', 'Triceps'],
    movementPattern: 'horizontal_push',
    equipment: 'machine',
    category: 'chest',
  },
  {
    name: 'Push-up',
    aliases: ['Liegestütz', 'Liegestütze', 'Pushup', 'Push Up', 'Push Ups', 'Liegestützen'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Front Delts', 'Triceps'],
    movementPattern: 'horizontal_push',
    equipment: 'bodyweight',
    category: 'chest',
  },
  {
    name: 'Dips',
    aliases: ['Dip', 'Chest Dips', 'Brust Dips', 'Parallelbarren',
              'Tricep Dips', 'Ring Dips'],
    primaryMuscles: ['Chest', 'Triceps'],
    secondaryMuscles: ['Front Delts'],
    movementPattern: 'vertical_push',
    equipment: 'bodyweight',
    category: 'chest',
  },

  // ── Back ────────────────────────────────────────────────────────────────────
  {
    name: 'Lat Pulldown',
    aliases: ['Latzug', 'Latzug breit', 'Wide Lat Pulldown', 'Latzug eng',
              'Close Grip Lat Pulldown', 'Pulldown', 'Latziehen', 'Latissimus Zug'],
    primaryMuscles: ['Latissimus'],
    secondaryMuscles: ['Biceps', 'Rhomboids', 'Rear Delts'],
    movementPattern: 'vertical_pull',
    equipment: 'cable',
    category: 'back',
  },
  {
    name: 'Pull-up',
    aliases: ['Klimmzug', 'Klimmzüge', 'Pullup', 'Pull Up', 'Pull Ups',
              'Chin Up', 'Chin-up', 'Kinn Auf', 'Untergriff Klimmzug'],
    primaryMuscles: ['Latissimus'],
    secondaryMuscles: ['Biceps', 'Rhomboids', 'Rear Delts'],
    movementPattern: 'vertical_pull',
    equipment: 'bodyweight',
    category: 'back',
  },
  {
    name: 'Barbell Row',
    aliases: ['Langhantelrudern', 'LH Rudern', 'Rudern Langhantel',
              'Bent Over Row', 'Bent-Over Row', 'Vorgebeugtes Rudern',
              'BB Row', 'Barbell Bent Over Row'],
    primaryMuscles: ['Back', 'Latissimus'],
    secondaryMuscles: ['Biceps', 'Rhomboids', 'Rear Delts', 'Lower Back'],
    movementPattern: 'horizontal_pull',
    equipment: 'barbell',
    category: 'back',
  },
  {
    name: 'Dumbbell Row',
    aliases: ['Kurzhantelrudern', 'KH Rudern', 'One Arm Row', 'Einarmiges Rudern',
              'Single Arm Row', 'DB Row', 'Einarm Kurzhantelrudern'],
    primaryMuscles: ['Latissimus', 'Back'],
    secondaryMuscles: ['Biceps', 'Rhomboids', 'Rear Delts'],
    movementPattern: 'horizontal_pull',
    equipment: 'dumbbell',
    category: 'back',
  },
  {
    name: 'Cable Row',
    aliases: ['Kabelrudern', 'Sitzrudern', 'Seated Cable Row', 'Low Cable Row',
              'Rudern am Kabel', 'Cable Rudern', 'Kabel Rudern'],
    primaryMuscles: ['Back', 'Rhomboids'],
    secondaryMuscles: ['Biceps', 'Rear Delts', 'Latissimus'],
    movementPattern: 'horizontal_pull',
    equipment: 'cable',
    category: 'back',
  },
  {
    name: 'T-Bar Row',
    aliases: ['T-Stangen Rudern', 'T Bar Rudern', 'T-Bar Rudern', 'Landmine Row'],
    primaryMuscles: ['Back', 'Latissimus'],
    secondaryMuscles: ['Biceps', 'Rhomboids', 'Rear Delts'],
    movementPattern: 'horizontal_pull',
    equipment: 'barbell',
    category: 'back',
  },
  {
    name: 'Deadlift',
    aliases: ['Kreuzheben', 'Conventional Deadlift', 'Conventional Kreuzheben',
              'Sumo Deadlift', 'Sumo Kreuzheben', 'DL'],
    primaryMuscles: ['Lower Back', 'Glutes', 'Hamstrings'],
    secondaryMuscles: ['Trapezius', 'Latissimus', 'Quadriceps', 'Forearms'],
    movementPattern: 'hip_hinge',
    equipment: 'barbell',
    category: 'back',
  },
  {
    name: 'Romanian Deadlift',
    aliases: ['RDL', 'Rumänisches Kreuzheben', 'Rumänisches KH', 'Stiff Leg Deadlift',
              'Romanian DL', 'Straight Leg Deadlift'],
    primaryMuscles: ['Hamstrings', 'Glutes'],
    secondaryMuscles: ['Lower Back', 'Forearms', 'Calves'],
    movementPattern: 'hip_hinge',
    equipment: 'barbell',
    category: 'back',
  },
  {
    name: 'Hyperextension',
    aliases: ['Rückenstrecker', 'Back Extension', 'Roman Chair', 'Rücken Extension',
              'Back Raise', '45 Degree Hyperextension'],
    primaryMuscles: ['Lower Back'],
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    movementPattern: 'hip_hinge',
    equipment: 'machine',
    category: 'back',
  },
  {
    name: 'Machine Row',
    aliases: ['Rudern Maschine', 'Chest Supported Row', 'Hammer Strength Row',
              'Machine Rudern', 'Seated Row Machine'],
    primaryMuscles: ['Back', 'Rhomboids'],
    secondaryMuscles: ['Biceps', 'Rear Delts'],
    movementPattern: 'horizontal_pull',
    equipment: 'machine',
    category: 'back',
  },

  // ── Shoulders ───────────────────────────────────────────────────────────────
  {
    name: 'Overhead Press',
    aliases: ['Schulterdrücken', 'Military Press', 'OHP', 'Overhead Drücken',
              'Schulter Drücken', 'Barbell Shoulder Press', 'Stehend Drücken',
              'Standing Press', 'LH Schulterdrücken'],
    primaryMuscles: ['Front Delts', 'Side Delts'],
    secondaryMuscles: ['Triceps', 'Trapezius'],
    movementPattern: 'vertical_push',
    equipment: 'barbell',
    category: 'shoulders',
  },
  {
    name: 'Dumbbell Shoulder Press',
    aliases: ['KH Schulterdrücken', 'Kurzhantel Schulterdrücken', 'DB Shoulder Press',
              'Seated DB Press', 'Arnold Press', 'Arnold Drücken'],
    primaryMuscles: ['Front Delts', 'Side Delts'],
    secondaryMuscles: ['Triceps', 'Trapezius'],
    movementPattern: 'vertical_push',
    equipment: 'dumbbell',
    category: 'shoulders',
  },
  {
    name: 'Arnold Press',
    aliases: ['Arnold Drücken', 'Arnold DB Press'],
    primaryMuscles: ['Front Delts', 'Side Delts'],
    secondaryMuscles: ['Triceps', 'Rear Delts'],
    movementPattern: 'vertical_push',
    equipment: 'dumbbell',
    category: 'shoulders',
  },
  {
    name: 'Lateral Raise',
    aliases: ['Seitheben', 'Seitliches Heben', 'Side Raise', 'Seitliches Heben KH',
              'Dumbbell Lateral Raise', 'KH Seitheben', 'Lateral Heben'],
    primaryMuscles: ['Side Delts'],
    secondaryMuscles: ['Front Delts', 'Trapezius'],
    movementPattern: 'abduction',
    equipment: 'dumbbell',
    category: 'shoulders',
  },
  {
    name: 'Front Raise',
    aliases: ['Frontheben', 'Vorheben', 'Front Heben', 'Vorderes Heben',
              'Dumbbell Front Raise', 'KH Frontheben', 'Plate Front Raise'],
    primaryMuscles: ['Front Delts'],
    secondaryMuscles: ['Side Delts', 'Chest'],
    movementPattern: 'flexion',
    equipment: 'dumbbell',
    category: 'shoulders',
  },
  {
    name: 'Rear Delt Fly',
    aliases: ['Hintere Schulter Fliegende', 'Reverse Fly', 'Reverse Flyes',
              'Hintere Schulter', 'Rear Delt Raise', 'Face Pull adjacent',
              'Bent Over Lateral Raise', 'KH Reverse Fly'],
    primaryMuscles: ['Rear Delts'],
    secondaryMuscles: ['Rhomboids', 'Trapezius'],
    movementPattern: 'fly',
    equipment: 'dumbbell',
    category: 'shoulders',
  },
  {
    name: 'Face Pull',
    aliases: ['Face Pulls', 'Kabel Gesichtszug', 'Gesichtszug', 'Cable Face Pull'],
    primaryMuscles: ['Rear Delts'],
    secondaryMuscles: ['Rhomboids', 'Trapezius', 'Biceps'],
    movementPattern: 'horizontal_pull',
    equipment: 'cable',
    category: 'shoulders',
  },
  {
    name: 'Upright Row',
    aliases: ['Aufrechtes Rudern', 'Hochziehen', 'Barbell Upright Row',
              'Upright Rudern', 'LH Hochziehen', 'KH Hochziehen'],
    primaryMuscles: ['Side Delts', 'Trapezius'],
    secondaryMuscles: ['Rear Delts', 'Biceps', 'Forearms'],
    movementPattern: 'vertical_pull',
    equipment: 'barbell',
    category: 'shoulders',
  },
  {
    name: 'Shrugs',
    aliases: ['Schulterheben', 'Schulter Shrugs', 'Trap Shrugs', 'Barbell Shrugs',
              'KH Schulterheben', 'LH Schulterheben'],
    primaryMuscles: ['Trapezius'],
    secondaryMuscles: ['Forearms'],
    movementPattern: 'elevation',
    equipment: 'barbell',
    category: 'shoulders',
  },

  // ── Biceps ──────────────────────────────────────────────────────────────────
  {
    name: 'Barbell Curl',
    aliases: ['Langhantel Curl', 'LH Curl', 'BB Curl', 'Bizeps Curl Langhantel',
              'Barbell Bicep Curl', 'Standing Barbell Curl', 'EZ Bar Curl', 'EZ Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    movementPattern: 'curl',
    equipment: 'barbell',
    category: 'biceps',
  },
  {
    name: 'Dumbbell Curl',
    aliases: ['Kurzhantel Curl', 'KH Curl', 'DB Curl', 'Bizeps Curl KH',
              'Alternating Curl', 'Wechselcurl', 'Dumbbell Bicep Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    movementPattern: 'curl',
    equipment: 'dumbbell',
    category: 'biceps',
  },
  {
    name: 'Hammer Curl',
    aliases: ['Hammer Curls', 'Neutral Curl', 'Neutral Grip Curl',
              'KH Hammer Curl', 'Hammercurl'],
    primaryMuscles: ['Biceps', 'Forearms'],
    secondaryMuscles: [],
    movementPattern: 'curl',
    equipment: 'dumbbell',
    category: 'biceps',
  },
  {
    name: 'Preacher Curl',
    aliases: ['Scott Curl', 'Scott Press', 'Prediger Curl', 'Preacher Curls',
              'EZ Preacher Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    movementPattern: 'curl',
    equipment: 'barbell',
    category: 'biceps',
  },
  {
    name: 'Cable Curl',
    aliases: ['Seilzug Curl', 'Kabel Curl', 'Cable Bicep Curl', 'Low Cable Curl',
              'Kabelzug Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    movementPattern: 'curl',
    equipment: 'cable',
    category: 'biceps',
  },
  {
    name: 'Concentration Curl',
    aliases: ['Konzentrations Curl', 'Konzentrationsübung Bizeps',
              'Seated Concentration Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: [],
    movementPattern: 'curl',
    equipment: 'dumbbell',
    category: 'biceps',
  },
  {
    name: 'Incline Dumbbell Curl',
    aliases: ['Schrägbank Curl', 'Incline Curl', 'Schrägbank KH Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    movementPattern: 'curl',
    equipment: 'dumbbell',
    category: 'biceps',
  },

  // ── Triceps ─────────────────────────────────────────────────────────────────
  {
    name: 'Tricep Pushdown',
    aliases: ['Trizep Drücken', 'Pushdown', 'Kabel Trizep', 'Cable Pushdown',
              'Seilzug Trizep', 'Tricep Cable Pushdown', 'Trizep Kabel',
              'Rope Pushdown', 'V-Bar Pushdown'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: [],
    movementPattern: 'extension',
    equipment: 'cable',
    category: 'triceps',
  },
  {
    name: 'Overhead Tricep Extension',
    aliases: ['Trizep Überdrücken', 'Overhead Extension', 'French Press',
              'Trizepsstrecken', 'KH Trizep', 'Overhead Tricep', 'OHT',
              'KH Überdrücken', 'Kurzhantel Trizep', 'DB Overhead Extension'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: [],
    movementPattern: 'extension',
    equipment: 'dumbbell',
    category: 'triceps',
  },
  {
    name: 'Skull Crusher',
    aliases: ['French Press Lying', 'Trizep Strecken Liegend', 'EZ Bar Skull Crusher',
              'Lying Tricep Extension', 'Skull Crushers', 'Trizep Liegend'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: [],
    movementPattern: 'extension',
    equipment: 'barbell',
    category: 'triceps',
  },
  {
    name: 'Close-Grip Bench Press',
    aliases: ['Enges Bankdrücken', 'Close Grip Bench', 'Enger Griff Bankdrücken',
              'Close Grip Press', 'Trizep Bankdrücken'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: ['Chest', 'Front Delts'],
    movementPattern: 'horizontal_push',
    equipment: 'barbell',
    category: 'triceps',
  },
  {
    name: 'Tricep Kickback',
    aliases: ['Trizep Kickback', 'KH Kickback', 'Dumbbell Kickback', 'Trizep Rückwärts'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: [],
    movementPattern: 'extension',
    equipment: 'dumbbell',
    category: 'triceps',
  },

  // ── Legs ────────────────────────────────────────────────────────────────────
  {
    name: 'Squat',
    aliases: ['Kniebeuge', 'Back Squat', 'Barbell Squat', 'LH Kniebeuge',
              'Kniebeugen', 'Squat Stange', 'High Bar Squat', 'Low Bar Squat'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Lower Back', 'Calves'],
    movementPattern: 'squat',
    equipment: 'barbell',
    category: 'legs',
  },
  {
    name: 'Front Squat',
    aliases: ['Frontkniebeuge', 'Front Kniebeuge', 'Vordere Kniebeuge'],
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: ['Glutes', 'Lower Back'],
    movementPattern: 'squat',
    equipment: 'barbell',
    category: 'legs',
  },
  {
    name: 'Goblet Squat',
    aliases: ['Goblet Kniebeuge', 'KB Squat', 'Kettlebell Squat'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Calves'],
    movementPattern: 'squat',
    equipment: 'dumbbell',
    category: 'legs',
  },
  {
    name: 'Leg Press',
    aliases: ['Beinpresse', 'Leg Press Maschine', 'Machine Leg Press',
              '45 Degree Leg Press', 'Hack Squat Machine'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Calves'],
    movementPattern: 'squat',
    equipment: 'machine',
    category: 'legs',
  },
  {
    name: 'Hack Squat',
    aliases: ['Hack Kniebeuge', 'Hack Squat Machine', 'Hacke Squat'],
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    movementPattern: 'squat',
    equipment: 'machine',
    category: 'legs',
  },
  {
    name: 'Leg Extension',
    aliases: ['Beinstrecker', 'Leg Extensions', 'Beinstreckung', 'Quad Extension',
              'Kniestrecker', 'Beinstrecker Maschine'],
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: [],
    movementPattern: 'extension',
    equipment: 'machine',
    category: 'legs',
  },
  {
    name: 'Leg Curl',
    aliases: ['Beincurl', 'Beincurls', 'Leg Curls', 'Hamstring Curl',
              'Lying Leg Curl', 'Seated Leg Curl', 'Beincurl Maschine',
              'Kniebeuge Curl'],
    primaryMuscles: ['Hamstrings'],
    secondaryMuscles: ['Calves'],
    movementPattern: 'curl',
    equipment: 'machine',
    category: 'legs',
  },
  {
    name: 'Lunges',
    aliases: ['Ausfallschritte', 'Walking Lunges', 'Reverse Lunges', 'Split Squat',
              'Ausfallschritt', 'Lunge', 'Rückwärts Ausfallschritte'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Calves'],
    movementPattern: 'lunge',
    equipment: 'dumbbell',
    category: 'legs',
  },
  {
    name: 'Bulgarian Split Squat',
    aliases: ['Bulgarische Kniebeuge', 'Bulgarian Squat', 'Rear Foot Elevated Split Squat',
              'RFESS', 'Bulgarer', 'Split Squat Erhöht'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Calves'],
    movementPattern: 'lunge',
    equipment: 'dumbbell',
    category: 'legs',
  },
  {
    name: 'Hip Thrust',
    aliases: ['Hüftstrecken', 'Barbell Hip Thrust', 'Glute Bridge', 'Hüftbeugen',
              'Hip Extension', 'Gesäßbrücke', 'LH Hüftstrecken'],
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings', 'Lower Back'],
    movementPattern: 'hip_thrust',
    equipment: 'barbell',
    category: 'legs',
  },
  {
    name: 'Good Morning',
    aliases: ['Good Mornings', 'Guten Morgen', 'Morgengruß', 'Barbell Good Morning'],
    primaryMuscles: ['Lower Back', 'Hamstrings'],
    secondaryMuscles: ['Glutes'],
    movementPattern: 'hip_hinge',
    equipment: 'barbell',
    category: 'legs',
  },
  {
    name: 'Calf Raise',
    aliases: ['Wadenheben', 'Calf Raises', 'Standing Calf Raise', 'Stehend Wadenheben',
              'Waden', 'Smith Machine Calf Raise', 'Calf Press'],
    primaryMuscles: ['Calves'],
    secondaryMuscles: [],
    movementPattern: 'calf_raise',
    equipment: 'machine',
    category: 'legs',
  },
  {
    name: 'Seated Calf Raise',
    aliases: ['Sitzend Wadenheben', 'Sitzende Waden', 'Seated Calf', 'Seated Calf Raises'],
    primaryMuscles: ['Calves'],
    secondaryMuscles: [],
    movementPattern: 'calf_raise',
    equipment: 'machine',
    category: 'legs',
  },
  {
    name: 'Glute Kickback',
    aliases: ['Gesäß Kickback', 'Donkey Kick', 'Cable Kickback', 'Glute Cable Kickback',
              'Kabelzug Kickback'],
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings'],
    movementPattern: 'hip_extension',
    equipment: 'cable',
    category: 'legs',
  },

  // ── Core ────────────────────────────────────────────────────────────────────
  {
    name: 'Plank',
    aliases: ['Unterarmstütz', 'Plank Halten', 'Forearm Plank', 'Side Plank',
              'Seitstütz', 'Rumpfstabilisierung'],
    primaryMuscles: ['Abs'],
    secondaryMuscles: ['Obliques', 'Lower Back'],
    movementPattern: 'isometric',
    equipment: 'bodyweight',
    category: 'core',
  },
  {
    name: 'Crunch',
    aliases: ['Crunches', 'Bauchpresse', 'Sit Up', 'Sit Ups', 'Situps',
              'Crunchen', 'Bauchcrunches'],
    primaryMuscles: ['Abs'],
    secondaryMuscles: ['Obliques'],
    movementPattern: 'flexion',
    equipment: 'bodyweight',
    category: 'core',
  },
  {
    name: 'Cable Crunch',
    aliases: ['Kabel Crunch', 'Rope Crunch', 'Cable Crunches', 'Kabel Bauchpresse',
              'Seilzug Crunch'],
    primaryMuscles: ['Abs'],
    secondaryMuscles: ['Obliques'],
    movementPattern: 'flexion',
    equipment: 'cable',
    category: 'core',
  },
  {
    name: 'Leg Raise',
    aliases: ['Beinheben', 'Beinanheben', 'Lying Leg Raise', 'Liegend Beinheben',
              'Leg Raises', 'Hanging Knee Raise'],
    primaryMuscles: ['Abs'],
    secondaryMuscles: ['Obliques'],
    movementPattern: 'flexion',
    equipment: 'bodyweight',
    category: 'core',
  },
  {
    name: 'Hanging Leg Raise',
    aliases: ['Hängendes Beinheben', 'Hanging Raises', 'Hanging Knee Raise',
              'Knieheben am Reck', 'Knieheben hängend'],
    primaryMuscles: ['Abs'],
    secondaryMuscles: ['Obliques', 'Forearms'],
    movementPattern: 'flexion',
    equipment: 'bodyweight',
    category: 'core',
  },
  {
    name: 'Russian Twist',
    aliases: ['Russischer Twist', 'Russian Twists', 'Rumpfrotation', 'Torso Rotation'],
    primaryMuscles: ['Obliques'],
    secondaryMuscles: ['Abs'],
    movementPattern: 'rotation',
    equipment: 'bodyweight',
    category: 'core',
  },
  {
    name: 'Ab Machine',
    aliases: ['Bauchmaschine', 'Crunch Machine', 'Abs Machine', 'Abdominal Machine'],
    primaryMuscles: ['Abs'],
    secondaryMuscles: ['Obliques'],
    movementPattern: 'flexion',
    equipment: 'machine',
    category: 'core',
  },
];

// ─── Recognition engine ───────────────────────────────────────────────────────

/** Normalise: lowercase, German umlauts → ascii, strip punctuation, collapse spaces */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t.length > 1);
}

/** Jaccard token-overlap similarity */
function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  const intersection = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Levenshtein distance (capped for performance) */
function levenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  // Only compute if lengths are reasonably similar
  if (Math.abs(la - lb) > 12) return Math.max(la, lb);
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[la][lb];
}

/** String edit-distance similarity (0–1) */
function editSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Score how well `candidate` matches `query` (both already normalised) */
function matchScore(queryNorm: string, queryTokens: string[], candidateNorm: string): number {
  const candTokens = tokenize(candidateNorm);

  // 1. Exact match
  if (queryNorm === candidateNorm) return 1.0;

  // 2. One contains the other exactly
  if (queryNorm.includes(candidateNorm) || candidateNorm.includes(queryNorm)) {
    const ratio = Math.min(queryNorm.length, candidateNorm.length) /
                  Math.max(queryNorm.length, candidateNorm.length);
    return 0.85 + ratio * 0.1;
  }

  // 3. Token overlap (Jaccard)
  const tok = tokenSimilarity(queryTokens, candTokens);

  // 4. String edit distance on the whole string
  const edit = editSimilarity(queryNorm, candidateNorm);

  // Combine: token overlap is the main signal, edit distance is a tie-breaker
  return tok * 0.72 + edit * 0.28;
}

/**
 * Recognise an exercise by name.
 * Returns the best match if confidence ≥ threshold (default 0.35), otherwise null.
 */
export function recognizeExercise(
  name: string,
  threshold = 0.35,
): RecognitionResult | null {
  if (!name || name.trim().length < 2) return null;

  const queryNorm   = normalize(name);
  const queryTokens = tokenize(name);
  let best: { entry: ExerciseEntry; score: number } | null = null;

  for (const entry of EXERCISE_DATABASE) {
    const candidates = [entry.name, ...entry.aliases];
    let top = 0;

    for (const alias of candidates) {
      const score = matchScore(queryNorm, queryTokens, normalize(alias));
      if (score > top) top = score;
      if (top >= 1.0) break; // perfect match, no need to check further
    }

    if (!best || top > best.score) {
      best = { entry, score: top };
    }
  }

  if (!best || best.score < threshold) return null;

  return { exercise: best.entry, confidence: best.score };
}

/**
 * Validate a list of muscle names against the allowed list.
 * Returns only muscles that exist in MUSCLES.
 */
export function validateMuscles(muscles: string[]): Muscle[] {
  const allowed = new Set<string>(MUSCLES);
  return muscles.filter((m) => allowed.has(m)) as Muscle[];
}

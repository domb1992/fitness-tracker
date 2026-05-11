import React, { useMemo } from 'react';

interface Props {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  className?: string;
}

const MUSCLE_TO_ZONES: Record<string, { front?: string[]; back?: string[] }> = {
  'Chest':       { front: ['chest'] },
  'Upper Chest': { front: ['upper-chest'] },
  'Front Delts': { front: ['front-delts'] },
  'Side Delts':  { front: ['side-delts'] },
  'Rear Delts':  { back: ['rear-delts'] },
  'Biceps':      { front: ['biceps'] },
  'Triceps':     { back: ['triceps'] },
  'Forearms':    { front: ['forearms'], back: ['forearms'] },
  'Abs':         { front: ['abs'] },
  'Obliques':    { front: ['obliques'] },
  'Back':        { back: ['lats', 'rhomboids'] },
  'Latissimus':  { back: ['lats'] },
  'Trapezius':   { back: ['traps'] },
  'Rhomboids':   { back: ['rhomboids'] },
  'Lower Back':  { back: ['lower-back'] },
  'Glutes':      { back: ['glutes'] },
  'Quadriceps':  { front: ['quads'] },
  'Hamstrings':  { back: ['hamstrings'] },
  'Calves':      { front: ['calves'], back: ['calves'] },
};

function buildZoneSet(muscles: string[], view: 'front' | 'back'): Set<string> {
  const s = new Set<string>();
  for (const m of muscles) {
    const z = MUSCLE_TO_ZONES[m];
    if (z?.[view]) z[view]!.forEach(id => s.add(id));
  }
  return s;
}

function zoneProps(id: string, primary: Set<string>, secondary: Set<string>) {
  if (primary.has(id))   return { fill: 'var(--lime)', fillOpacity: 0.85 as number };
  if (secondary.has(id)) return { fill: 'var(--lime)', fillOpacity: 0.32 as number };
  return                         { fill: 'currentColor', fillOpacity: 0.10 as number };
}

// Muscular male silhouette — 100×148 viewBox, V-taper physique
// Clockwise: left neck → left outer arm ↓ → wrist → left inner arm ↑ →
//            left torso ↓ → left leg ↓ → crotch → right leg ↓ →
//            right torso ↑ → right inner arm ↓ → wrist → right outer arm ↑ → neck
const BODY_PATH =
  // Left neck → broad left shoulder
  'M44,18 C40,19 27,24 16,32 C9,37 6,43 6,52 ' +
  // Left outer arm ↓ (thick)
  'C6,60 7,68 8,76 C8,83 9,88 10,92 ' +
  // Wrist turn
  'L16,93 ' +
  // Left inner arm ↑
  'C16,87 17,80 17,70 C18,60 19,53 20,48 ' +
  // Armpit notch → left chest wall
  'C21,45 22,43 24,43 ' +
  // Left torso ↓ — chest wide, waist narrowest, hip flares slightly
  'C23,52 24,62 26,72 C28,82 30,89 29,96 C28,100 27,103 25,106 ' +
  // Left leg outer ↓
  'L22,148 L37,148 ' +
  // Left inner thigh → crotch
  'L38,122 C39,114 41,107 43,103 ' +
  // Crotch
  'L57,103 ' +
  // Right inner thigh
  'C59,107 61,114 62,122 L63,148 ' +
  // Right leg outer ↓ (mirror)
  'L78,148 L75,106 ' +
  // Right torso ↑
  'C73,103 72,100 71,96 C70,89 72,82 74,72 C76,62 77,52 76,43 ' +
  // Right armpit notch → right inner arm
  'C78,43 79,45 80,48 ' +
  // Right inner arm ↓
  'C81,53 82,60 83,70 C83,80 84,87 84,93 ' +
  // Wrist turn
  'L90,92 ' +
  // Right outer arm ↑
  'C91,88 92,83 92,76 C93,68 94,60 94,52 ' +
  // Right shoulder
  'C94,43 91,37 84,32 ' +
  // Right shoulder → right neck
  'C73,24 60,19 56,18 ' +
  // Neck top
  'C53,17 47,17 44,18Z';

// ── Front-view muscle zones ───────────────────────────────────────────────────

function FrontZones({ primary, secondary }: { primary: Set<string>; secondary: Set<string> }) {
  const z = (id: string) => zoneProps(id, primary, secondary);
  const T = 'transition-all duration-500';
  return (
    <>
      {/* Chest — pec fan shapes from sternum */}
      <g className={T} {...z('chest')}>
        <path d="M50,45 C46,41 34,38 26,44 C21,48 20,55 24,62 C27,67 34,68 41,64 C47,61 50,56 50,51Z" />
        <path d="M50,45 C54,41 66,38 74,44 C79,48 80,55 76,62 C73,67 66,68 59,64 C53,61 50,56 50,51Z" />
      </g>
      {/* Upper Chest — clavicular head */}
      <g className={T} {...z('upper-chest')}>
        <ellipse cx={37} cy={39} rx={12} ry={6} />
        <ellipse cx={63} cy={39} rx={12} ry={6} />
      </g>
      {/* Front Delts — anterior deltoid cap */}
      <g className={T} {...z('front-delts')}>
        <ellipse cx={17} cy={40} rx={10} ry={11} />
        <ellipse cx={83} cy={40} rx={10} ry={11} />
      </g>
      {/* Side Delts — lateral cap, very outer */}
      <g className={T} {...z('side-delts')}>
        <ellipse cx={8}  cy={52} rx={6} ry={9} />
        <ellipse cx={92} cy={52} rx={6} ry={9} />
      </g>
      {/* Biceps */}
      <g className={T} {...z('biceps')}>
        <ellipse cx={11} cy={69} rx={6} ry={13} />
        <ellipse cx={89} cy={69} rx={6} ry={13} />
      </g>
      {/* Forearms */}
      <g className={T} {...z('forearms')}>
        <ellipse cx={12} cy={85} rx={5} ry={8} />
        <ellipse cx={88} cy={85} rx={5} ry={8} />
      </g>
      {/* Abs — 3×2 six-pack */}
      <g className={T} {...z('abs')}>
        <rect x={42} y={64} width={7} height={6} rx={2} />
        <rect x={51} y={64} width={7} height={6} rx={2} />
        <rect x={42} y={73} width={7} height={6} rx={2} />
        <rect x={51} y={73} width={7} height={6} rx={2} />
        <rect x={41} y={82} width={8} height={6} rx={2} />
        <rect x={51} y={82} width={8} height={6} rx={2} />
      </g>
      {/* Obliques — angled side bands */}
      <g className={T} {...z('obliques')}>
        <path d="M26,63 C27,70 28,78 29,88 C28,90 25,90 24,88 C23,78 23,70 24,63Z" />
        <path d="M74,63 C73,70 72,78 71,88 C72,90 75,90 76,88 C77,78 77,70 76,63Z" />
      </g>
      {/* Quadriceps — outer sweep */}
      <g className={T} {...z('quads')}>
        <path d="M26,106 C24,114 24,124 25,132 C27,136 32,137 37,136 C42,135 44,130 43,122 C42,114 38,108 33,106Z" />
        <path d="M74,106 C76,114 76,124 75,132 C73,136 68,137 63,136 C58,135 56,130 57,122 C58,114 62,108 67,106Z" />
      </g>
      {/* Calves (front — gastroc visible) */}
      <g className={T} {...z('calves')}>
        <ellipse cx={33} cy={140} rx={8} ry={7} />
        <ellipse cx={67} cy={140} rx={8} ry={7} />
      </g>
    </>
  );
}

// ── Back-view muscle zones ────────────────────────────────────────────────────

function BackZones({ primary, secondary }: { primary: Set<string>; secondary: Set<string> }) {
  const z = (id: string) => zoneProps(id, primary, secondary);
  const T = 'transition-all duration-500';
  return (
    <>
      {/* Trapezius — kite/diamond from neck to mid-back */}
      <g className={T} {...z('traps')}>
        <path d="M38,22 L62,22 C65,30 66,40 63,52 L50,58 L37,52 C34,40 35,30 38,22Z" />
      </g>
      {/* Rhomboids — between shoulder blades */}
      <g className={T} {...z('rhomboids')}>
        <rect x={38} y={52} width={24} height={14} rx={3} />
      </g>
      {/* Latissimus — wide fan from armpit to hip */}
      <g className={T} {...z('lats')}>
        <path d="M22,50 C19,64 18,78 19,92 C20,98 22,103 26,105 L36,105 C36,91 36,77 36,63 C36,55 37,48 38,44 L26,46Z" />
        <path d="M78,50 C81,64 82,78 81,92 C80,98 78,103 74,105 L64,105 C64,91 64,77 64,63 C64,55 63,48 62,44 L74,46Z" />
      </g>
      {/* Rear Delts */}
      <g className={T} {...z('rear-delts')}>
        <ellipse cx={17} cy={40} rx={10} ry={11} />
        <ellipse cx={83} cy={40} rx={10} ry={11} />
      </g>
      {/* Triceps — lateral/long head */}
      <g className={T} {...z('triceps')}>
        <ellipse cx={11} cy={69} rx={6} ry={13} />
        <ellipse cx={89} cy={69} rx={6} ry={13} />
      </g>
      {/* Forearms (back) */}
      <g className={T} {...z('forearms')}>
        <ellipse cx={12} cy={85} rx={5} ry={8} />
        <ellipse cx={88} cy={85} rx={5} ry={8} />
      </g>
      {/* Lower Back — erector spinae columns */}
      <g className={T} {...z('lower-back')}>
        <rect x={38} y={90} width={10} height={18} rx={3} />
        <rect x={52} y={90} width={10} height={18} rx={3} />
      </g>
      {/* Glutes — rounded, divided */}
      <g className={T} {...z('glutes')}>
        <ellipse cx={37} cy={114} rx={14} ry={13} />
        <ellipse cx={63} cy={114} rx={14} ry={13} />
      </g>
      {/* Hamstrings */}
      <g className={T} {...z('hamstrings')}>
        <path d="M26,108 C24,116 24,126 26,134 C28,138 33,138 38,136 C43,134 45,128 44,120 C43,113 38,108 33,107Z" />
        <path d="M74,108 C76,116 76,126 74,134 C72,138 67,138 62,136 C57,134 55,128 56,120 C57,113 62,108 67,107Z" />
      </g>
      {/* Calves (back — diamond gastroc) */}
      <g className={T} {...z('calves')}>
        <ellipse cx={33} cy={141} rx={8} ry={7} />
        <ellipse cx={67} cy={141} rx={8} ry={7} />
      </g>
    </>
  );
}

// ── Single body view ──────────────────────────────────────────────────────────

function BodyView({ label, primary, secondary, zones }: {
  label: string;
  primary: Set<string>;
  secondary: Set<string>;
  zones: React.ReactNode;
}) {
  const id = `clip-${label.toLowerCase()}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--ink-4)',
      }}>
        {label}
      </span>
      <svg viewBox="0 0 100 148" style={{ width: '100%', height: 'auto', overflow: 'visible' }} aria-hidden>
        <defs>
          <clipPath id={id}>
            <circle cx={50} cy={9} r={9} />
            <path d={BODY_PATH} />
          </clipPath>
        </defs>
        {/* Silhouette base */}
        <g fill="var(--paper-3)" stroke="var(--border)" strokeWidth={0.6}>
          <circle cx={50} cy={9} r={9} />
          <path d={BODY_PATH} />
        </g>
        {/* Muscle zones clipped to silhouette */}
        <g clipPath={`url(#${id})`}>
          {zones}
        </g>
      </svg>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export const MuscleMap: React.FC<Props> = ({ primaryMuscles, secondaryMuscles, className }) => {
  const primaryFront   = useMemo(() => buildZoneSet(primaryMuscles,   'front'), [primaryMuscles]);
  const secondaryFront = useMemo(() => buildZoneSet(secondaryMuscles, 'front'), [secondaryMuscles]);
  const primaryBack    = useMemo(() => buildZoneSet(primaryMuscles,   'back'),  [primaryMuscles]);
  const secondaryBack  = useMemo(() => buildZoneSet(secondaryMuscles, 'back'),  [secondaryMuscles]);

  if (primaryMuscles.length === 0 && secondaryMuscles.length === 0) return null;

  return (
    <div className={className} style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '4px 0' }}>
      <div style={{ width: 90, flexShrink: 0 }}>
        <BodyView label="Front" primary={primaryFront} secondary={secondaryFront}
          zones={<FrontZones primary={primaryFront} secondary={secondaryFront} />} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, paddingBottom: 16 }}>
        {primaryMuscles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--lime)', opacity: 0.85, flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)' }}>
              <div style={{ color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Primary</div>
              {primaryMuscles.map(m => (
                <div key={m} style={{ color: 'var(--ink-2)', fontWeight: 700, fontSize: 10 }}>{m}</div>
              ))}
            </div>
          </div>
        )}
        {secondaryMuscles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--lime)', opacity: 0.32, flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)' }}>
              <div style={{ color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Secondary</div>
              {secondaryMuscles.map(m => (
                <div key={m} style={{ color: 'var(--ink-3)', fontSize: 9 }}>{m}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 90, flexShrink: 0 }}>
        <BodyView label="Back" primary={primaryBack} secondary={secondaryBack}
          zones={<BackZones primary={primaryBack} secondary={secondaryBack} />} />
      </div>
    </div>
  );
};

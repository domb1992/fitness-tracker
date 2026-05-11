import React, { useMemo } from 'react';

interface Props {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  className?: string;
}

// Muscle name → which SVG zone IDs to activate, per view
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

function zoneProps(
  id: string,
  primary: Set<string>,
  secondary: Set<string>,
): { fill: string; fillOpacity: number } {
  if (primary.has(id))   return { fill: 'var(--lime)',    fillOpacity: 0.82 };
  if (secondary.has(id)) return { fill: 'var(--lime)',    fillOpacity: 0.30 };
  return                         { fill: 'currentColor',  fillOpacity: 0.08 };
}

// ── Shared body silhouette path (100×148 viewBox, centre x=50) ───────────────
// Same outline for front and back — only the muscle zones differ.
const BODY_PATH =
  'M44,19 C40,20 30,24 23,31 C16,38 11,46 10,54 L8,94 L17,94 L18,78 ' +
  'C20,70 22,64 23,62 L25,74 C25,80 24,87 23,92 L21,92 L20,148 L35,148 ' +
  'L36,121 L40,101 L60,101 L64,121 L65,148 L80,148 L79,92 L77,92 ' +
  'C76,87 75,80 75,74 L77,62 C78,64 80,70 82,78 L83,94 L92,94 ' +
  'L90,54 C89,46 84,38 77,31 C70,24 60,20 56,19 C53,17 47,17 44,19 Z';

// ── Front-view muscle zones ───────────────────────────────────────────────────

function FrontZones({ primary, secondary }: { primary: Set<string>; secondary: Set<string> }) {
  const z = (id: string) => zoneProps(id, primary, secondary);
  const T = 'transition-all duration-500';

  return (
    <>
      {/* Chest */}
      <g className={T} {...z('chest')}>
        <ellipse cx={38} cy={50} rx={10} ry={12} />
        <ellipse cx={62} cy={50} rx={10} ry={12} />
      </g>
      {/* Upper Chest */}
      <g className={T} {...z('upper-chest')}>
        <ellipse cx={38} cy={40} rx={9}  ry={7}  />
        <ellipse cx={62} cy={40} rx={9}  ry={7}  />
      </g>
      {/* Front Delts */}
      <g className={T} {...z('front-delts')}>
        <ellipse cx={21} cy={40} rx={7}  ry={9}  />
        <ellipse cx={79} cy={40} rx={7}  ry={9}  />
      </g>
      {/* Side Delts */}
      <g className={T} {...z('side-delts')}>
        <ellipse cx={13} cy={52} rx={6}  ry={7}  />
        <ellipse cx={87} cy={52} rx={6}  ry={7}  />
      </g>
      {/* Biceps */}
      <g className={T} {...z('biceps')}>
        <ellipse cx={12} cy={71} rx={5.5} ry={13} />
        <ellipse cx={88} cy={71} rx={5.5} ry={13} />
      </g>
      {/* Forearms */}
      <g className={T} {...z('forearms')}>
        <ellipse cx={10} cy={88} rx={4.5} ry={10} />
        <ellipse cx={90} cy={88} rx={4.5} ry={10} />
      </g>
      {/* Abs — 6 blocks in 3 rows */}
      <g className={T} {...z('abs')}>
        <rect x={41} y={62} width={7} height={7} rx={1.5} />
        <rect x={52} y={62} width={7} height={7} rx={1.5} />
        <rect x={41} y={71} width={7} height={7} rx={1.5} />
        <rect x={52} y={71} width={7} height={7} rx={1.5} />
        <rect x={40} y={80} width={8} height={7} rx={1.5} />
        <rect x={52} y={80} width={8} height={7} rx={1.5} />
      </g>
      {/* Obliques */}
      <g className={T} {...z('obliques')}>
        <rect x={28} y={63} width={9} height={24} rx={3} />
        <rect x={63} y={63} width={9} height={24} rx={3} />
      </g>
      {/* Quadriceps */}
      <g className={T} {...z('quads')}>
        <ellipse cx={37} cy={114} rx={12} ry={16} />
        <ellipse cx={63} cy={114} rx={12} ry={16} />
      </g>
      {/* Calves (front) */}
      <g className={T} {...z('calves')}>
        <ellipse cx={37} cy={137} rx={8} ry={10} />
        <ellipse cx={63} cy={137} rx={8} ry={10} />
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
      {/* Trapezius */}
      <g className={T} {...z('traps')}>
        <path d="M36,26 L64,26 C66,36 66,46 64,52 L36,52 C34,46 34,36 36,26 Z" />
      </g>
      {/* Rhomboids (between shoulder blades) */}
      <g className={T} {...z('rhomboids')}>
        <rect x={39} y={50} width={22} height={14} rx={3} />
      </g>
      {/* Latissimus */}
      <g className={T} {...z('lats')}>
        <path d="M22,56 C18,68 20,84 26,96 L38,96 L38,52 Z" />
        <path d="M78,56 C82,68 80,84 74,96 L62,96 L62,52 Z" />
      </g>
      {/* Rear Delts */}
      <g className={T} {...z('rear-delts')}>
        <ellipse cx={21} cy={40} rx={7} ry={9} />
        <ellipse cx={79} cy={40} rx={7} ry={9} />
      </g>
      {/* Triceps */}
      <g className={T} {...z('triceps')}>
        <ellipse cx={12} cy={71} rx={5.5} ry={13} />
        <ellipse cx={88} cy={71} rx={5.5} ry={13} />
      </g>
      {/* Forearms (back) */}
      <g className={T} {...z('forearms')}>
        <ellipse cx={10} cy={88} rx={4.5} ry={10} />
        <ellipse cx={90} cy={88} rx={4.5} ry={10} />
      </g>
      {/* Lower Back */}
      <g className={T} {...z('lower-back')}>
        <rect x={37} y={94} width={26} height={16} rx={4} />
      </g>
      {/* Glutes */}
      <g className={T} {...z('glutes')}>
        <ellipse cx={38} cy={113} rx={14} ry={12} />
        <ellipse cx={62} cy={113} rx={14} ry={12} />
      </g>
      {/* Hamstrings */}
      <g className={T} {...z('hamstrings')}>
        <ellipse cx={37} cy={131} rx={12} ry={15} />
        <ellipse cx={63} cy={131} rx={12} ry={15} />
      </g>
      {/* Calves (back) */}
      <g className={T} {...z('calves')}>
        <ellipse cx={37} cy={141} rx={8} ry={8} />
        <ellipse cx={63} cy={141} rx={8} ry={8} />
      </g>
    </>
  );
}

// ── Single body view ──────────────────────────────────────────────────────────

function BodyView({
  label,
  primary,
  secondary,
  zones,
}: {
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
      <svg
        viewBox="0 0 100 148"
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        aria-hidden
      >
        <defs>
          <clipPath id={id}>
            <circle cx={50} cy={9} r={9} />
            <path d={BODY_PATH} />
          </clipPath>
        </defs>

        {/* Body silhouette base */}
        <g fill="var(--paper-3)" stroke="var(--border)" strokeWidth={0.8}>
          <circle cx={50} cy={9} r={9} />
          <path d={BODY_PATH} />
        </g>

        {/* Muscle zones — clipped to body outline */}
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

  const hasMuscles = primaryMuscles.length > 0 || secondaryMuscles.length > 0;
  if (!hasMuscles) return null;

  return (
    <div
      className={className}
      style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '4px 0' }}
    >
      {/* Front view */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <BodyView
          label="Front"
          primary={primaryFront}
          secondary={secondaryFront}
          zones={<FrontZones primary={primaryFront} secondary={secondaryFront} />}
        />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 8, paddingBottom: 16,
      }}>
        {primaryMuscles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3,
              background: 'var(--lime)', opacity: 0.82, flexShrink: 0,
            }} />
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
            <span style={{
              width: 10, height: 10, borderRadius: 3,
              background: 'var(--lime)', opacity: 0.30, flexShrink: 0,
            }} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)' }}>
              <div style={{ color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Secondary</div>
              {secondaryMuscles.map(m => (
                <div key={m} style={{ color: 'var(--ink-3)', fontSize: 9 }}>{m}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Back view */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <BodyView
          label="Back"
          primary={primaryBack}
          secondary={secondaryBack}
          zones={<BackZones primary={primaryBack} secondary={secondaryBack} />}
        />
      </div>
    </div>
  );
};

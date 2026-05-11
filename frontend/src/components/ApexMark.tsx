import React from 'react';

interface ApexMarkProps {
  size?: number;
  color?: string;
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FitTrack primary logo mark — the Apex.
 * A bold upward wedge with an inner chevron accent.
 * Accent color defaults to var(--lime) (volt).
 */
export const ApexMark: React.FC<ApexMarkProps> = ({
  size = 24,
  color = 'currentColor',
  accentColor = 'var(--lime)',
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    className={className}
    style={style}
  >
    {/* Outer wedge */}
    <path d="M50 8 L92 88 L72 88 L50 46 L28 88 L8 88 Z" fill={color} />
    {/* Inner ascending chevron (accent) */}
    <path d="M50 30 L66 62 L34 62 Z" fill={accentColor} />
  </svg>
);

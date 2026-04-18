/**
 * Shared stroke-based SVG icon set.
 * All icons use a 24-unit viewBox; size is configurable via the `size` prop.
 */

interface SvgIconProps {
  size?: number;
}

function svgBase(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function EyeIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function DiffIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M12 3v18M5 8h4M5 16h4M15 8h4M15 16h4" />
    </svg>
  );
}

export function BranchIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M6 8v8M8 6h6a2 2 0 0 1 2 2v8" />
    </svg>
  );
}

export function CopyIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function LinkIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function RewindIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M1 4v6h6" />
      <path d="M3.5 15a9 9 0 1 0 .3-4.5" />
    </svg>
  );
}

export function EditIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  );
}

export function HistoryIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function LayersIcon({ size = 13 }: SvgIconProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M12 2 2 7l10 5 10-5z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

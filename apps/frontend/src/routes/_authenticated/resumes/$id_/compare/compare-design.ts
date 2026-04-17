/**
 * Design tokens for the editorial Compare page. Mirrors the reference design
 * (real/styles.css) and is applied only to the compare container so it
 * coexists with the rest of the app's Google-style theme.
 */

export const ink = {
  0: "oklch(13% 0.008 250)",
  1: "oklch(16% 0.008 250)",
  2: "oklch(19% 0.009 250)",
  3: "oklch(23% 0.010 250)",
  4: "oklch(28% 0.012 250)",
} as const;

export const line = {
  1: "oklch(25% 0.010 250)",
  2: "oklch(32% 0.012 250)",
} as const;

export const fg = {
  1: "oklch(97% 0.005 250)",
  2: "oklch(82% 0.008 250)",
  3: "oklch(62% 0.010 250)",
  4: "oklch(48% 0.010 250)",
  5: "oklch(38% 0.010 250)",
} as const;

export const accent = {
  main: "oklch(72% 0.12 245)",
  soft: "oklch(72% 0.12 245 / 0.14)",
  line: "oklch(72% 0.12 245 / 0.35)",
} as const;

export const warm = {
  main: "oklch(78% 0.08 70)",
  soft: "oklch(78% 0.08 70 / 0.14)",
  line: "oklch(78% 0.08 70 / 0.3)",
} as const;

export const ok = {
  main: "oklch(74% 0.10 155)",
  soft: "oklch(74% 0.10 155 / 0.14)",
  line: "oklch(74% 0.10 155 / 0.3)",
  cellBg: "oklch(74% 0.10 155 / 0.06)",
} as const;

export const danger = {
  main: "oklch(68% 0.14 25)",
  soft: "oklch(68% 0.14 25 / 0.14)",
  line: "oklch(68% 0.14 25 / 0.3)",
  cellBg: "oklch(68% 0.14 25 / 0.06)",
} as const;

export const font = {
  display:
    '"Instrument Serif", "Iowan Old Style", Georgia, serif',
  ui: '"Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
} as const;

export const lilac = {
  main: "oklch(72% 0.12 310)",
  soft: "oklch(72% 0.12 310 / 0.14)",
  line: "oklch(72% 0.12 310 / 0.3)",
} as const;

export const shadow = {
  1: "0 1px 0 0 oklch(100% 0 0 / 0.04) inset, 0 1px 2px oklch(0% 0 0 / 0.4)",
  2: "0 12px 32px -12px oklch(0% 0 0 / 0.6)",
} as const;

// ---------------------------------------------------------------------------
// parsePeriod
//
// Converts a Swedish/English quarter-based period string into structured
// date fields suitable for storing on an assignment row.
//
// Supported formats:
//   "Q3 2025 – Pågående"     → ongoing assignment
//   "Q3 2025 – Ongoing"      → ongoing assignment (English variant)
//   "Q4 2025 – Q1 2026"      → completed, both ends known (en-dash)
//   "Q1 2023 - Q1 2024"      → completed, both ends known (hyphen)
//   "Q3 2025"                → start only, end unknown
//   ""                       → no date info → returns null
// ---------------------------------------------------------------------------

export interface ParsedPeriod {
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

const QUARTER_START_MONTH: Record<number, number> = { 1: 0, 2: 3, 3: 6, 4: 9 };
const QUARTER_END_MONTH: Record<number, number> = { 1: 2, 2: 5, 3: 8, 4: 11 };
const QUARTER_END_DAY: Record<number, number> = { 1: 31, 2: 30, 3: 30, 4: 31 };

const ONGOING_TOKENS = new Set(["pågående", "ongoing", "present", "nuvarande"]);

function parseQuarterDate(token: string, position: "start" | "end"): Date | null {
  const match = token.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!match) return null;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const quarter = parseInt(match[1]!, 10);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const year = parseInt(match[2]!, 10);
  if (position === "start") {
    return new Date(Date.UTC(year, QUARTER_START_MONTH[quarter], 1));
  }
  return new Date(Date.UTC(year, QUARTER_END_MONTH[quarter], QUARTER_END_DAY[quarter]));
}

/**
 * Parses a period string into structured date fields.
 * Returns null if the string is empty or cannot be parsed.
 */
export function parsePeriod(period: string): ParsedPeriod | null {
  const trimmed = period.trim();
  if (!trimmed) return null;

  // Split on en-dash (–), em-dash (—), or plain hyphen surrounded by spaces
  const parts = trimmed.split(/\s*[–—]\s*|\s+-\s+/).map((p) => p.trim());

  const startToken = parts[0] ?? "";
  const startDate = parseQuarterDate(startToken, "start");
  if (!startDate) return null;

  if (parts.length === 1) {
    return { startDate, endDate: null, isCurrent: false };
  }

  const endToken = (parts[1] ?? "").toLowerCase();
  if (ONGOING_TOKENS.has(endToken)) {
    return { startDate, endDate: null, isCurrent: true };
  }

  const endDate = parseQuarterDate(parts[1] ?? "", "end");
  return { startDate, endDate, isCurrent: false };
}

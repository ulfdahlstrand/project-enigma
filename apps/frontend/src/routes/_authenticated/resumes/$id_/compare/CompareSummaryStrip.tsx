/**
 * CompareSummaryStrip — 4-cell editorial strip matching real/styles.css
 * .compare__summary. Uses the design tokens (ink-1 bg, font-display values,
 * font-mono labels).
 *
 * Styling: MUI sx prop only (design tokens from compare-design.ts)
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { danger, fg, font, ink, line, ok, radius } from "./compare-design";

interface CompareSummaryStripProps {
  plusCount: number;
  minusCount: number;
  affectedSections: number;
  totalSections: number;
  baseCreatedAt: Date | null;
  headCreatedAt: Date | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(base: Date | null, head: Date | null): number | null {
  if (!base || !head) return null;
  const diff = Math.abs(head.getTime() - base.getTime());
  return Math.round(diff / MS_PER_DAY);
}

interface CellProps {
  label: string;
  value: string;
  unit?: string;
  tone?: "add" | "del" | "neutral";
}

function Cell({ label, value, unit, tone = "neutral" }: CellProps) {
  const valueColor =
    tone === "add" ? ok.main : tone === "del" ? danger.main : fg[1];
  return (
    <Box
      sx={{
        backgroundColor: ink[1],
        border: `1px solid ${line[1]}`,
        borderRadius: radius.md,
        px: "16px",
        py: "14px",
      }}
    >
      <Box
        sx={{
          fontFamily: font.mono,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: fg[5],
          mb: "4px",
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontFamily: font.display,
          fontSize: "28px",
          fontWeight: 400,
          color: valueColor,
          letterSpacing: "-0.01em",
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <Box
            component="small"
            sx={{
              fontFamily: font.mono,
              fontSize: "11px",
              color: fg[4],
              letterSpacing: "0.04em",
              fontWeight: 400,
            }}
          >
            {unit}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function CompareSummaryStrip({
  plusCount,
  minusCount,
  affectedSections,
  totalSections,
  baseCreatedAt,
  headCreatedAt,
}: CompareSummaryStripProps) {
  const { t } = useTranslation("common");
  const days = daysBetween(baseCreatedAt, headCreatedAt);
  const timeUnit =
    days === null
      ? undefined
      : days === 0
        ? t("resume.compare.summary.sameDay").toUpperCase()
        : t("resume.compare.summary.days", { count: days }).toUpperCase();

  return (
    <Box
      role="group"
      aria-label={t("resume.compare.summary.ariaLabel")}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
        gap: "12px",
        mb: "16px",
      }}
    >
      <Cell
        label={t("resume.compare.summary.added")}
        value={`+${plusCount}`}
        unit={t("resume.compare.summary.changes").toUpperCase()}
        tone="add"
      />
      <Cell
        label={t("resume.compare.summary.removed")}
        value={`−${minusCount}`}
        unit={t("resume.compare.summary.changes").toUpperCase()}
        tone="del"
      />
      <Cell
        label={t("resume.compare.summary.sectionsAffected")}
        value={String(affectedSections)}
        unit={t("resume.compare.summary.sectionsOf", { total: totalSections }).toUpperCase()}
      />
      <Cell
        label={t("resume.compare.summary.timeBetween")}
        value={days === null ? "—" : String(days)}
        {...(timeUnit ? { unit: timeUnit } : {})}
      />
    </Box>
  );
}

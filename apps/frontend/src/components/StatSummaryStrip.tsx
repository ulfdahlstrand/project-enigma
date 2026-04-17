/**
 * StatSummaryStrip — reusable horizontal strip of summary cells. Each cell
 * shows a label (small caps), a value, and an optional unit. Cells render
 * with tonal colour variants (add/del/neutral) for the value.
 *
 * Used by the compare page diff summary; also suitable for history and
 * other pages that need an editorial stat strip above content.
 *
 * Styling: MUI sx prop only
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";

export type StatCellTone = "add" | "del" | "neutral";

export interface StatCell {
  key: string;
  label: string;
  value: string;
  unit?: string;
  tone?: StatCellTone;
}

interface StatSummaryStripProps {
  cells: StatCell[];
  ariaLabel?: string;
}

function valueColor(tone: StatCellTone | undefined) {
  return (theme: Theme) => {
    if (tone === "add") return theme.palette.success.main;
    if (tone === "del") return theme.palette.error.main;
    return theme.palette.text.primary;
  };
}

export function StatSummaryStrip({ cells, ariaLabel }: StatSummaryStripProps) {
  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        "& > *:not(:last-child)": {
          borderRight: { sm: "1px solid" },
          borderBottom: { xs: "1px solid", sm: "none" },
          borderColor: { xs: "divider", sm: "divider" },
        },
      }}
    >
      {cells.map((cell) => (
        <Box
          key={cell.key}
          sx={{
            flex: 1,
            minWidth: 140,
            px: 2,
            py: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: "0.7rem",
            }}
          >
            {cell.label}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 600,
                fontSize: "1.4rem",
                lineHeight: 1,
                color: valueColor(cell.tone),
              }}
            >
              {cell.value}
            </Typography>
            {cell.unit && (
              <Typography
                component="span"
                variant="caption"
                sx={{
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.7rem",
                }}
              >
                {cell.unit}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

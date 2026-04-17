/**
 * DiffChip — reusable inline chip with add/remove/unchanged tones for
 * rendering chip-style diffs (e.g. skills, keywords, technologies).
 *
 * Styling: MUI sx prop only
 */
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import type { Theme } from "@mui/material/styles";

export type DiffChipStatus = "added" | "removed" | "unchanged";

interface DiffChipProps {
  status: DiffChipStatus;
  children: ReactNode;
  ariaLabel?: string;
}

function chipSx(status: DiffChipStatus) {
  return (theme: Theme) => {
    const base = {
      display: "inline-flex",
      alignItems: "center",
      px: 1.25,
      py: 0.25,
      borderRadius: "999px",
      fontSize: "0.8rem",
      border: "1px solid",
    };

    if (status === "added") {
      return {
        ...base,
        color: theme.palette.success.main,
        borderColor: theme.palette.success.main,
        backgroundColor:
          theme.palette.mode === "dark"
            ? "rgba(76,175,80,0.12)"
            : "rgba(76,175,80,0.08)",
      };
    }

    if (status === "removed") {
      return {
        ...base,
        color: theme.palette.error.main,
        borderColor: theme.palette.error.main,
        textDecoration: "line-through",
        backgroundColor:
          theme.palette.mode === "dark"
            ? "rgba(244,67,54,0.12)"
            : "rgba(244,67,54,0.08)",
      };
    }

    return {
      ...base,
      color: theme.palette.text.primary,
      borderColor: theme.palette.divider,
    };
  };
}

function prefix(status: DiffChipStatus): string {
  if (status === "added") return "+";
  if (status === "removed") return "−";
  return "";
}

export function DiffChip({ status, children, ariaLabel }: DiffChipProps) {
  const sign = prefix(status);
  return (
    <Box component="span" sx={chipSx(status)} aria-label={ariaLabel}>
      {sign && (
        <Box component="span" aria-hidden="true" sx={{ mr: 0.5 }}>
          {sign}
        </Box>
      )}
      <Box component="span">{children}</Box>
    </Box>
  );
}

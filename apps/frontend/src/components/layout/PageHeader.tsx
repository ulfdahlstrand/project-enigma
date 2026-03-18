/**
 * PageHeader — content-area page title bar.
 *
 * White bar with bottom border sitting at the top of the content region.
 * Left side: title (h1) with an optional chip (e.g. language badge).
 * Right side: optional action buttons slot.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  chip?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, chip, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
        minHeight: 56,
        flexWrap: "wrap",
      }}
    >
      {/* Title + optional chip */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{ fontWeight: 500, color: "text.primary" }}
        >
          {title}
        </Typography>
        {chip}
      </Box>

      {/* Action buttons */}
      {actions && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}

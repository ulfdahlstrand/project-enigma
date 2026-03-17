/**
 * PageHeader — content-area page title bar.
 *
 * White bar with bottom border sitting at the top of the content region.
 * Holds the page title (left) and optional action buttons (right).
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        px: 3,
        py: 1.75,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
        minHeight: 56,
      }}
    >
      <Typography
        variant="h5"
        component="h1"
        sx={{ fontWeight: 500, color: "text.primary", flexGrow: 1 }}
      >
        {title}
      </Typography>
      {actions && <Box sx={{ display: "flex", gap: 1 }}>{actions}</Box>}
    </Box>
  );
}

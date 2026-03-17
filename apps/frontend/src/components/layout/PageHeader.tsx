/**
 * PageHeader — top bar for the content area.
 *
 * Renders a slim border-bottom header with a title and optional actions slot.
 * Replaces the AppBar inside the content region so each page can declare its
 * own heading without the global chrome.
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
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        alignItems: "center",
        gap: 2,
        minHeight: 52,
      }}
    >
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: "1.0625rem", flexGrow: 1 }}>
        {title}
      </Typography>
      {actions && <Box sx={{ display: "flex", gap: 1 }}>{actions}</Box>}
    </Box>
  );
}

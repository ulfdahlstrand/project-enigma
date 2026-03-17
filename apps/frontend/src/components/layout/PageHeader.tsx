/**
 * PageHeader — Office 365-style content-area page header.
 *
 * Renders a page title (h1) with an optional actions slot aligned to the right.
 * Sits inside the main scrollable area, below the fixed app bar.
 *
 * Styling via MUI sx prop only.
 */
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 1.5,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {actions && <Box sx={{ display: "flex", gap: 1 }}>{actions}</Box>}
      </Box>
      <Divider />
    </Box>
  );
}

/**
 * PageHeader — content-area page toolbar.
 *
 * Sits at the top of each page's content area, replacing the removed global header.
 *
 * Left side:  optional breadcrumb → title → optional chip/context
 * Right side: optional action buttons
 *
 * Usage:
 *   <PageHeader
 *     title="Employee Details"
 *     breadcrumb={<RouterLink to="/employees">Employees</RouterLink>}
 *     chip={<Chip label="EN" size="small" />}
 *     actions={<Button>Save</Button>}
 *   />
 */
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** Optional breadcrumb node rendered above the title. */
  breadcrumb?: ReactNode;
  /** Optional chip or badge rendered next to the title. */
  chip?: ReactNode;
  /** Optional right-aligned action buttons. */
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumb, chip, actions }: PageHeaderProps) {
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
      {/* Left: breadcrumb + title + chip */}
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }}>
        {breadcrumb && (
          <Breadcrumbs sx={{ mb: 0.25, "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}>
            {breadcrumb}
            <Typography variant="caption" color="text.primary">{title}</Typography>
          </Breadcrumbs>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 500, color: "text.primary", lineHeight: 1.2 }}
          >
            {title}
          </Typography>
          {chip}
        </Box>
      </Box>

      {/* Right: actions */}
      {actions && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}

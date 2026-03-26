/**
 * PageHeader — content-area page toolbar.
 *
 * Sits at the top of each page's content area, replacing the removed global header.
 *
 * Left side:  breadcrumbs (parent pages) → title → optional chip/context
 * Right side: optional action buttons
 *
 * The current page title is always the last breadcrumb item (auto-added).
 * Pass parent pages via the breadcrumbs array — no need for a separate back button.
 *
 * Usage:
 *   <PageHeader
 *     title="Ulf Dahlstrand"
 *     breadcrumbs={[{ label: t("nav.employees"), to: "/employees" }]}
 *     chip={<Chip label="EN" size="small" />}
 *     actions={<Button>Save</Button>}
 *   />
 */
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  to: string;
}

interface PageHeaderProps {
  title: string;
  /** Parent pages rendered as links above the title. Current page is added automatically. */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional chip or badge rendered next to the title. */
  chip?: ReactNode;
  /** Optional right-aligned action buttons. */
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumbs, chip, actions }: PageHeaderProps) {
  const hasBreadcrumbs = breadcrumbs && breadcrumbs.length > 0;

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
      {/* Left: title + chip + breadcrumbs */}
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }}>
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
        {hasBreadcrumbs && (
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{ mt: 0.25, "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}
          >
            {breadcrumbs.map((item) => (
              <MuiLink
                key={item.to}
                component={Link}
                to={item.to}
                underline="hover"
                color="inherit"
                variant="caption"
              >
                {item.label}
              </MuiLink>
            ))}
            <Typography variant="caption" color="text.primary">
              {title}
            </Typography>
          </Breadcrumbs>
        )}
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

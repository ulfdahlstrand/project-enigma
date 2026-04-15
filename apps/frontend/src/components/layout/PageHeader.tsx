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
import React, { type ReactNode } from "react";

export type BreadcrumbItem =
  | { label: string; to: string }
  | { node: React.ReactNode; key: string };

interface PageHeaderProps {
  title: string;
  /** Parent pages rendered as links above the title. Current page is added automatically. */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional chip or badge rendered next to the title. */
  chip?: ReactNode;
  /** Optional centered content rendered between the title block and actions. */
  centerContent?: ReactNode;
  /** Optional right-aligned action buttons. */
  actions?: ReactNode;
  /**
   * When true, the title is NOT auto-appended as the last breadcrumb item.
   * Use this when you want to control the full breadcrumb path yourself
   * (e.g. when the title appears as a link in the middle of the breadcrumbs).
   */
  hideTitleBreadcrumb?: boolean;
}

export function PageHeader({ title, breadcrumbs, chip, centerContent, actions, hideTitleBreadcrumb = false }: PageHeaderProps) {
  const hasBreadcrumbs = breadcrumbs && breadcrumbs.length > 0;

  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto minmax(0, 1fr)" },
        gap: 2,
        minHeight: 56,
        alignItems: "center",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "clip",
      }}
    >
      {/* Left: title + chip + breadcrumbs */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
          gridColumn: { md: 1 },
        }}
      >
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
            sx={{ mt: 0.25, "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap", alignItems: "center" } }}
          >
            {breadcrumbs.map((item) =>
              "node" in item ? (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
              ) : (
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
              )
            )}
            {!hideTitleBreadcrumb && (
              <Typography variant="caption" color="text.primary">
                {title}
              </Typography>
            )}
          </Breadcrumbs>
        )}
      </Box>

      {centerContent && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 0,
            gridColumn: { md: 2 },
          }}
        >
          {centerContent}
        </Box>
      )}

      {/* Right: actions */}
      {actions && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            justifySelf: { md: "end" },
            gridColumn: { md: 3 },
            minWidth: 0,
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}

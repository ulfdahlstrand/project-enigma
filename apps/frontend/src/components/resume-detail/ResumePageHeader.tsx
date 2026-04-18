/**
 * ResumePageHeader — editorial dark topbar for all resume pages.
 *
 * Structure:  [breadcrumbs / title]  ·  [chip?]     [actions?]
 *
 * Slots:
 *   title     — replace the title node entirely (e.g. a custom element)
 *
 * SlotProps:
 *   root      — extra sx props on the topbar container
 *   crumbs    — extra sx props on the breadcrumbs flex row
 *   actions   — extra sx props on the actions flex row
 */
import Box from "@mui/material/Box";
import { Link } from "@tanstack/react-router";
import type { SxProps } from "@mui/material";
import type { ReactNode } from "react";
import { accent, fg, font, ink, line } from "../../routes/_authenticated/resumes/$id_/compare/compare-design";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResumePageHeaderBreadcrumb {
  label: string;
  /** When present the item renders as a link. */
  to?: string;
}

export interface ResumePageHeaderSlots {
  /** Completely replace the title node. Receives the default title string as children. */
  title?: ReactNode;
}

export interface ResumePageHeaderSlotProps {
  /** Extra sx props merged onto the root container. */
  root?: SxProps;
  /** Extra sx props merged onto the breadcrumbs row. */
  crumbs?: SxProps;
  /** Extra sx props merged onto the actions row. */
  actions?: SxProps;
}

export interface ResumePageHeaderProps {
  /** Page or entity title — rendered in display font at the end of the breadcrumb chain. */
  title: string;
  /** Parent pages rendered as links before the title. */
  breadcrumbs?: ResumePageHeaderBreadcrumb[];
  /** Optional badge rendered inline after the title. */
  chip?: ReactNode;
  /** Right-aligned action buttons / controls. */
  actions?: ReactNode;
  slots?: ResumePageHeaderSlots;
  slotProps?: ResumePageHeaderSlotProps;
}

// ---------------------------------------------------------------------------
// Shared style tokens
// ---------------------------------------------------------------------------

const sepSx = {
  color: fg[5],
  flexShrink: 0,
  userSelect: "none",
} as const;

const crumbLinkSx = {
  color: fg[4],
  fontSize: "13px",
  fontFamily: font.ui,
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
  transition: "color 120ms",
  "&:hover": { color: fg[2] },
} as const;

const crumbTextSx = {
  color: fg[4],
  fontSize: "13px",
  fontFamily: font.ui,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResumePageHeader({
  title,
  breadcrumbs,
  chip,
  actions,
  slots,
  slotProps,
}: ResumePageHeaderProps) {
  const titleNode = slots?.title ?? (
    <Box
      component="h1"
      sx={{
        fontFamily: font.display,
        fontSize: "22px",
        fontWeight: 400,
        color: fg[1],
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
        lineHeight: 1.2,
        margin: 0,
        padding: 0,
      }}
    >
      {title}
    </Box>
  );

  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 20px",
        background: ink[0],
        borderBottom: `1px solid ${line[1]}`,
        minHeight: "56px",
        ...(slotProps?.root as object),
      }}
    >
      {/* Breadcrumbs + title */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: fg[4],
          fontFamily: font.ui,
          minWidth: 0,
          flex: "1 1 auto",
          overflow: "hidden",
          ...(slotProps?.crumbs as object),
        }}
      >
        {breadcrumbs?.map((item, i) => (
          <Box key={i} sx={{ display: "contents" }}>
            {item.to ? (
              <Box component={Link} to={item.to} sx={crumbLinkSx}>
                {item.label}
              </Box>
            ) : (
              <Box component="span" sx={crumbTextSx}>
                {item.label}
              </Box>
            )}
            <Box component="span" sx={sepSx} aria-hidden="true">
              /
            </Box>
          </Box>
        ))}

        {titleNode}

        {chip && (
          <Box
            component="span"
            sx={{
              flexShrink: 0,
              fontFamily: font.mono,
              fontSize: "10px",
              padding: "2px 7px",
              borderRadius: "999px",
              background: accent.soft,
              color: accent.main,
              border: `1px solid ${accent.line}`,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {chip}
          </Box>
        )}
      </Box>

      {/* Actions */}
      {actions && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
            ...(slotProps?.actions as object),
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}

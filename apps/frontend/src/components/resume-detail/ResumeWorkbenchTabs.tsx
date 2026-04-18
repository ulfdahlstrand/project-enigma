/**
 * ResumeWorkbenchTabs — horizontal lens-tab bar for navigating between the
 * five resume workbench destinations.
 *
 * Styling matches the editorial dark design exactly: ink background, accent
 * underline indicator, Inter Tight UI font.
 */
import Box from "@mui/material/Box";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { accent, fg, font, ink, line } from "../../routes/_authenticated/resumes/$id_/compare/compare-design";
import { DiffIcon, EditIcon, EyeIcon, HistoryIcon, LayersIcon } from "../Icons";

export interface ResumeWorkbenchTabsProps {
  resumeId: string;
  activeBranchId: string | null;
  compareRef?: string | null;
}

type TabDef = {
  key: string;
  labelKey: string;
  href: string;
  icon: React.ReactElement;
};

function buildTabs(resumeId: string, activeBranchId: string | null, compareRef?: string | null): TabDef[] {
  const previewHref =
    activeBranchId !== null
      ? `/resumes/${resumeId}/branch/${activeBranchId}`
      : `/resumes/${resumeId}`;

  const editHref =
    activeBranchId !== null
      ? `/resumes/${resumeId}/edit/branch/${activeBranchId}`
      : `/resumes/${resumeId}/edit`;

  const historyHref =
    activeBranchId !== null
      ? `/resumes/${resumeId}/history?branchId=${activeBranchId}`
      : `/resumes/${resumeId}/history`;

  return [
    {
      key: "preview",
      labelKey: "resume.workbenchTabs.preview",
      href: previewHref,
      icon: <EyeIcon size={14} />,
    },
    {
      key: "edit",
      labelKey: "resume.workbenchTabs.edit",
      href: editHref,
      icon: <EditIcon size={14} />,
    },
    {
      key: "history",
      labelKey: "resume.workbenchTabs.history",
      href: historyHref,
      icon: <HistoryIcon size={14} />,
    },
    {
      key: "compare",
      labelKey: "resume.workbenchTabs.compare",
      href: compareRef
        ? `/resumes/${resumeId}/compare?compareRef=${encodeURIComponent(compareRef)}`
        : `/resumes/${resumeId}/compare`,
      icon: <DiffIcon size={14} />,
    },
    {
      key: "variants",
      labelKey: "resume.workbenchTabs.variants",
      href: `/resumes/${resumeId}/variants`,
      icon: <LayersIcon size={14} />,
    },
  ];
}

function resolveActiveTab(pathname: string, resumeId: string): string {
  const base = `/resumes/${resumeId}`;
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;

  if (relative.startsWith("/edit")) return "edit";
  if (relative.startsWith("/history")) return "history";
  if (relative.startsWith("/compare")) return "compare";
  if (relative.startsWith("/variants")) return "variants";
  return "preview";
}

export function ResumeWorkbenchTabs({
  resumeId,
  activeBranchId,
  compareRef,
}: ResumeWorkbenchTabsProps) {
  const { t } = useTranslation("common");
  const { location } = useRouterState();
  const activeKey = resolveActiveTab(location.pathname, resumeId);
  const tabs = buildTabs(resumeId, activeBranchId, compareRef);

  return (
    <Box
      component="nav"
      role="tablist"
      aria-label="Resume workbench"
      sx={{
        display: "flex",
        gap: "2px",
        px: "20px",
        background: ink[0],
        borderBottom: `1px solid ${line[1]}`,
        overflowX: "auto",
        scrollbarWidth: "none",
        flexShrink: 0,
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Box
            key={tab.key}
            component={Link}
            to={tab.href}
            role="tab"
            aria-selected={isActive}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 14px 14px",
              fontSize: "13px",
              fontFamily: font.ui,
              fontWeight: 400,
              color: isActive ? fg[1] : fg[4],
              position: "relative",
              transition: "color 120ms",
              whiteSpace: "nowrap",
              flexShrink: 0,
              textDecoration: "none",
              border: 0,
              background: "transparent",
              cursor: "pointer",
              "&:hover": { color: isActive ? fg[1] : fg[2] },
              "& svg": { opacity: 0.7, flexShrink: 0 },
              ...(isActive && {
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: "10px",
                  right: "10px",
                  bottom: "-1px",
                  height: "2px",
                  background: accent.main,
                  borderRadius: "2px 2px 0 0",
                },
              }),
            }}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </Box>
        );
      })}
    </Box>
  );
}

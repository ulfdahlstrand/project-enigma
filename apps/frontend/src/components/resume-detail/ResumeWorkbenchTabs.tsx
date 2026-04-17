/**
 * ResumeWorkbenchTabs — horizontal tab bar for navigating between the five
 * resume workbench destinations (Edit, Preview, History, Compare, Variants).
 *
 * Placed inside ResumeDetailLayout so it is visible on every child route under
 * `/resumes/$id`. Active tab is derived from the current pathname — no local
 * state needed.
 *
 * Styling: MUI sx prop only.
 * i18n: useTranslation("common") — keys under resume.workbenchTabs.*
 */
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export interface ResumeWorkbenchTabsProps {
  resumeId: string;
  /** The active branch id, used to build the Edit/Preview/History tab hrefs. */
  activeBranchId: string | null;
  /** The active branch name, used to pre-populate ?compareRef on the Compare tab. */
  compareRef?: string | null;
}

type TabDef = {
  key: string;
  labelKey: string;
  href: string;
  matchSegment: string;
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
      matchSegment: "/preview",
    },
    {
      key: "edit",
      labelKey: "resume.workbenchTabs.edit",
      href: editHref,
      matchSegment: "/edit",
    },
    {
      key: "history",
      labelKey: "resume.workbenchTabs.history",
      href: historyHref,
      matchSegment: "/history",
    },
    {
      key: "compare",
      labelKey: "resume.workbenchTabs.compare",
      href: compareRef
        ? `/resumes/${resumeId}/compare?compareRef=${encodeURIComponent(compareRef)}`
        : `/resumes/${resumeId}/compare`,
      matchSegment: "/compare",
    },
    {
      key: "variants",
      labelKey: "resume.workbenchTabs.variants",
      href: `/resumes/${resumeId}/variants`,
      matchSegment: "/variants",
    },
  ];
}

function resolveActiveTab(pathname: string, resumeId: string): string {
  const base = `/resumes/${resumeId}`;
  const relative = pathname.startsWith(base)
    ? pathname.slice(base.length)
    : pathname;

  if (relative.startsWith("/edit")) return "edit";
  if (relative.startsWith("/history")) return "history";
  if (relative.startsWith("/compare")) return "compare";
  if (relative.startsWith("/variants")) return "variants";
  // Everything else (root, /branch/:id, /commit/:id) is Preview
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
    <Tabs
      value={activeKey}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        minHeight: 40,
        flexShrink: 0,
        "& .MuiTab-root": {
          minHeight: 40,
          py: 0,
          fontSize: "0.8125rem",
          textTransform: "none",
          fontWeight: 400,
          "&.Mui-selected": {
            fontWeight: 600,
          },
        },
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.key}
          value={tab.key}
          label={t(tab.labelKey)}
          component={Link}
          to={tab.href}
        />
      ))}
    </Tabs>
  );
}

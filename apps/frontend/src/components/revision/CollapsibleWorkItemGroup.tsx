import { useState } from "react";
import AdjustIcon from "@mui/icons-material/Adjust";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { WorkItemGroup, PlanActionGroup } from "./group-work-items";

type CollapsibleWorkItemGroupProps = {
  group: WorkItemGroup | PlanActionGroup;
  children: React.ReactNode;
};

function GroupStatusIcon({ group }: { group: WorkItemGroup | PlanActionGroup }) {
  if (group.isAllDone) {
    return <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />;
  }
  if (group.hasInProgress) {
    return <CircularProgress size={16} thickness={5} />;
  }
  if (group.completedCount > 0) {
    return <AdjustIcon fontSize="small" sx={{ color: "primary.main" }} />;
  }
  return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
}

export function CollapsibleWorkItemGroup({ group, children }: CollapsibleWorkItemGroupProps) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(group.hasInProgress || group.completedCount > 0 && !group.isAllDone);

  const sectionLabel =
    t(`revision.inline.sectionLabel.${group.section}`, { defaultValue: "" }) ||
    t("revision.inline.sectionLabel.other");

  return (
    <Box>
      <Box
        onClick={() => setExpanded((prev) => !prev)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.85,
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <GroupStatusIcon group={group} />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, lineHeight: 1.35 }}>
          {sectionLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {t("revision.inline.groupProgress", {
            completed: group.completedCount,
            total: group.totalCount,
          })}
        </Typography>
        {expanded
          ? <ExpandLessIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
          : <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />}
      </Box>
      <Collapse in={expanded} timeout="auto">
        {children}
      </Collapse>
    </Box>
  );
}

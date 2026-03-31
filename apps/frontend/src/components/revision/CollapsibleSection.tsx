import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

type CollapsibleSectionProps = {
  title: string;
  completedCount: number;
  totalCount: number;
  isAllDone: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  completedCount,
  totalCount,
  isAllDone,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <>
      <Divider />
      <Box
        onClick={() => setExpanded((prev) => !prev)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {isAllDone
          ? <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />
          : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />}
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {t("revision.inline.groupProgress", { completed: completedCount, total: totalCount })}
        </Typography>
        {expanded
          ? <ExpandLessIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
          : <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />}
      </Box>
      <Collapse in={expanded} timeout="auto">
        {children}
      </Collapse>
    </>
  );
}

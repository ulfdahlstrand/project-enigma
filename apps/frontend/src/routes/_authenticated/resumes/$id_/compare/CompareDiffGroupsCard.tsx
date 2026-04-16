/**
 * CompareDiffGroupsCard — outlined card that lists all changed groups as
 * accordions. Header exposes the summary/split view-mode toggle and the
 * +/- diff stats badge.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DiffStatsBadge } from "../../../../../components/DiffStatsBadge";
import { UnifiedTextDiff } from "../../../../../components/ai-assistant/DiffReviewDialog";
import type { DiffGroup } from "../../../../../utils/diff-utils";
import { SideBySideTextDiff } from "./SideBySideTextDiff";
import { statusBorderColor, statusColor, type CompareViewMode } from "./compare-utils";

interface CompareDiffGroupsCardProps {
  diffGroups: DiffGroup[];
  totalPlusCount: number;
  totalMinusCount: number;
  viewMode: CompareViewMode;
  onViewModeChange: (event: MouseEvent<HTMLElement>, nextValue: CompareViewMode | null) => void;
}

export function CompareDiffGroupsCard({
  diffGroups,
  totalPlusCount,
  totalMinusCount,
  viewMode,
  onViewModeChange,
}: CompareDiffGroupsCardProps) {
  const { t } = useTranslation("common");

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="h6">
              {t("resume.compare.changedGroups", { count: diffGroups.length })}
            </Typography>
            <DiffStatsBadge
              plusCount={totalPlusCount}
              minusCount={totalMinusCount}
              size="medium"
            />
          </Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            size="small"
            onChange={onViewModeChange}
            aria-label={t("resume.compare.viewModeLabel")}
          >
            <ToggleButton value="summary" aria-label={t("resume.compare.summaryView")}>
              {t("resume.compare.summaryView")}
            </ToggleButton>
            <ToggleButton value="split" aria-label={t("resume.compare.splitView")}>
              {t("resume.compare.splitView")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Divider />
        {diffGroups.map((group, index) => (
          <Accordion
            key={group.key}
            disableGutters
            elevation={0}
            defaultExpanded={index === 0}
            sx={{
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                <Typography fontWeight={500}>{group.label}</Typography>
                <Typography color="success.main" fontWeight={600}>
                  +{group.plusCount}
                </Typography>
                <Typography color="error.main" fontWeight={600}>
                  -{group.minusCount}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack spacing={1.5}>
                {group.items.map((item) => (
                  <Card
                    key={item.key}
                    variant="outlined"
                    sx={{ borderLeftWidth: 3, borderLeftColor: statusBorderColor(item.status) }}
                  >
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Chip
                          label={t(
                            `resume.compare.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`,
                          )}
                          color={statusColor(item.status)}
                          size="small"
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {item.title}
                        </Typography>
                      </Box>
                      {viewMode === "summary" ? (
                        <UnifiedTextDiff original={item.before} suggested={item.after} />
                      ) : (
                        <SideBySideTextDiff original={item.before} suggested={item.after} />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  );
}

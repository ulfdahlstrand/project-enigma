import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChecklistIcon from "@mui/icons-material/Checklist";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { VariantSwitcher } from "../VariantSwitcher";

interface ResumeStatusBarProps {
  resumeId: string;
  activeBranchId: string | null;
  language: string | null;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange: (value: number) => void;
  isSuggestionsOpen: boolean;
  onToggleSuggestions: () => void;
  isAiOpen: boolean;
  onToggleAi: () => void;
}

export function ResumeStatusBar({
  resumeId,
  activeBranchId,
  language,
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  isSuggestionsOpen,
  onToggleSuggestions,
  isAiOpen,
  onToggleAi,
}: ResumeStatusBarProps) {
  const { t } = useTranslation("common");
  const zoomPercent = Math.round(zoom * 100);

  return (
    <Paper
      square
      elevation={0}
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        backdropFilter: "blur(10px)",
      }}
    >
      <Box
        sx={{
          minHeight: 38,
          px: { xs: 1, md: 1.5 },
          py: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flexWrap: "wrap" }}>
          <Button
            size="small"
            variant={isSuggestionsOpen ? "contained" : "text"}
            startIcon={<ChecklistIcon sx={{ fontSize: 16 }} />}
            onClick={onToggleSuggestions}
            sx={{
              minWidth: 0,
              px: 1,
              py: 0.35,
              borderRadius: 1,
              textTransform: "none",
              fontSize: 12,
            }}
          >
            {t("revision.inline.suggestionsButton")}
          </Button>

          <VariantSwitcher resumeId={resumeId} currentBranchId={activeBranchId} compact />

          {language ? (
            <Chip
              size="small"
              variant="outlined"
              label={language.toUpperCase()}
              sx={{ height: 24, fontSize: 12, borderRadius: 1 }}
            />
          ) : null}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flexWrap: "wrap" }}>
          <IconButton
            size="small"
            aria-label={t("resume.detail.zoomOutLabel")}
            onClick={() => onZoomChange(zoom - 0.1)}
            sx={{ width: 24, height: 24 }}
          >
            <RemoveIcon fontSize="inherit" />
          </IconButton>
          <Slider
            aria-label={t("resume.detail.zoomLabel")}
            min={minZoom}
            max={maxZoom}
            step={0.1}
            value={zoom}
            onChange={(_event, value) => onZoomChange(value as number)}
            sx={{ width: { xs: 92, md: 120 } }}
          />
          <IconButton
            size="small"
            aria-label={t("resume.detail.zoomInLabel")}
            onClick={() => onZoomChange(zoom + 0.1)}
            sx={{ width: 24, height: 24 }}
          >
            <AddIcon fontSize="inherit" />
          </IconButton>
          <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40, textAlign: "right" }}>
            {zoomPercent}%
          </Typography>
          <Button
            size="small"
            variant={isAiOpen ? "contained" : "text"}
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            onClick={onToggleAi}
            sx={{
              minWidth: 0,
              px: 1,
              py: 0.35,
              borderRadius: 1,
              textTransform: "none",
              fontSize: 12,
            }}
          >
            {t("revision.inline.aiHelpButton")}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

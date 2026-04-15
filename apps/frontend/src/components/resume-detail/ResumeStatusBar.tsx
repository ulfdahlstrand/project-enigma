import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChecklistIcon from "@mui/icons-material/Checklist";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { RevisionsMenu } from "../RevisionsMenu";

interface ResumeStatusBarProps {
  isEditing: boolean;
  resumeId: string;
  activeBranchType: "variant" | "translation" | "revision" | null;
  /** ID of the variant that is the parent of the current branch (or the branch itself if variant). */
  variantBranchId: string | null;
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
  isEditing,
  resumeId,
  activeBranchType,
  variantBranchId,
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
        borderRadius: 0,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.100",
      }}
    >
      <Box
        sx={{
          minHeight: 32,
          px: { xs: 0.75, md: 1 },
          py: 0.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.75,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flexWrap: "wrap" }}>
          {activeBranchType === "variant" && variantBranchId !== null ? (
            <RevisionsMenu resumeId={resumeId} variantBranchId={variantBranchId} />
          ) : null}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, flexWrap: "wrap" }}>
          <IconButton
            size="small"
            aria-label={t("resume.detail.zoomOutLabel")}
            onClick={() => onZoomChange(zoom - 0.1)}
            sx={{ width: 20, height: 20, color: "text.secondary" }}
          >
            <RemoveIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Slider
            aria-label={t("resume.detail.zoomLabel")}
            min={minZoom}
            max={maxZoom}
            step={0.1}
            value={zoom}
            onChange={(_event, value) => onZoomChange(value as number)}
            sx={{
              width: { xs: 72, md: 96 },
              color: "grey.600",
              py: 0,
              "& .MuiSlider-thumb": {
                width: 10,
                height: 10,
              },
              "& .MuiSlider-rail": {
                opacity: 1,
                bgcolor: "grey.400",
              },
            }}
          />
          <IconButton
            size="small"
            aria-label={t("resume.detail.zoomInLabel")}
            onClick={() => onZoomChange(zoom + 0.1)}
            sx={{ width: 20, height: 20, color: "text.secondary" }}
          >
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 32, textAlign: "right", fontSize: 10.5 }}>
            {zoomPercent}%
          </Typography>
          {isEditing ? (
            <Button
              size="small"
              variant="text"
              startIcon={<ChecklistIcon sx={{ fontSize: 16 }} />}
              onClick={onToggleSuggestions}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 24,
                borderRadius: 0,
                color: isSuggestionsOpen ? "text.primary" : "text.secondary",
                bgcolor: isSuggestionsOpen ? "grey.300" : "transparent",
                textTransform: "none",
                fontSize: 11,
                lineHeight: 1.2,
                "&:hover": {
                  bgcolor: isSuggestionsOpen ? "grey.400" : "grey.200",
                },
              }}
            >
              {t("revision.inline.suggestionsButton")}
            </Button>
          ) : null}
          {isEditing ? (
            <Button
              size="small"
              variant="text"
              startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
              onClick={onToggleAi}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 24,
                borderRadius: 0,
                color: isAiOpen ? "text.primary" : "text.secondary",
                bgcolor: isAiOpen ? "grey.300" : "transparent",
                textTransform: "none",
                fontSize: 11,
                lineHeight: 1.2,
                "&:hover": {
                  bgcolor: isAiOpen ? "grey.400" : "grey.200",
                },
              }}
            >
              {t("revision.inline.aiHelpButton")}
            </Button>
          ) : null}
        </Box>
      </Box>
    </Paper>
  );
}

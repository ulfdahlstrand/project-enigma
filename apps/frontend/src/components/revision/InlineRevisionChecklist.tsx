import AdjustIcon from "@mui/icons-material/Adjust";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { RevisionSuggestions } from "../../lib/ai-tools/registries/resume-tool-schemas";
import type { InlineRevisionStage } from "./inline-revision";

function renderStatusIcon(
  status: "pending" | "done" | "accepted" | "dismissed",
  isSelected = false,
) {
  if (status === "done" || status === "accepted") {
    return <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />;
  }
  if (status === "dismissed") {
    return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
  }
  if (isSelected) {
    return <AdjustIcon fontSize="small" sx={{ color: "primary.main" }} />;
  }
  return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
}

type InlineRevisionChecklistProps = {
  stage: InlineRevisionStage;
  sourceBranchName: string;
  branchName: string;
  suggestions: RevisionSuggestions["suggestions"];
  selectedSuggestionId: string | null;
  onSelectSuggestion: (suggestionId: string) => void;
  onReviewSuggestion: (suggestionId: string) => void;
  onMoveToFinalize: () => void;
  isReadyToFinalize: boolean;
  isPreparingFinalize: boolean;
  onBackToRevision: () => void;
};

export function InlineRevisionChecklist({
  stage,
  sourceBranchName,
  branchName,
  suggestions,
  selectedSuggestionId,
  onSelectSuggestion,
  onReviewSuggestion,
  onMoveToFinalize,
  isReadyToFinalize,
  isPreparingFinalize,
  onBackToRevision,
}: InlineRevisionChecklistProps) {
  const { t } = useTranslation("common");
  const reviewedSuggestions = suggestions.filter((s) => s.status !== "pending");
  const acceptedSuggestions = suggestions.filter((s) => s.status === "accepted");
  const progressWidth = suggestions.length > 0 ? (reviewedSuggestions.length / suggestions.length) * 100 : 0;

  return (
    <Paper
      sx={{
        width: "100%",
        flexShrink: 0,
        borderRadius: 0,
        boxShadow: 0,
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
          {`${reviewedSuggestions.length}/${suggestions.length} ${t("revision.inline.suggestionsTitle").toLowerCase()}`}
        </Typography>
        <Box sx={{ height: 4, bgcolor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${progressWidth}%`,
              bgcolor: "primary.main",
              borderRadius: 2,
              transition: "width 0.2s ease",
            }}
          />
        </Box>
        <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography variant="subtitle2">{t("revision.inline.checklistTitle")}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {`${sourceBranchName} -> ${branchName}`}
        </Typography>
      </Box>
      <Divider />
      {stage === "finalize" ? (
        <>
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2">{t("revision.inline.finalizeTitle")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t("revision.inline.finalizeDescription", {
                accepted: acceptedSuggestions.length,
                reviewed: reviewedSuggestions.length,
                total: suggestions.length,
              })}
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Button variant="contained" size="small" onClick={onBackToRevision}>
              {t("revision.inline.backToActionsButton")}
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t("revision.inline.suggestionsTitle")}
            </Typography>
          </Box>
          {suggestions.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", p: 0.5 }}>
              {suggestions.map((suggestion, index) => (
                <Box
                  key={suggestion.id}
                  sx={{
                    display: "block",
                    px: 1,
                    py: 0.85,
                    borderLeft: "2px solid",
                    borderBottom: index < suggestions.length - 1 ? "1px solid" : "none",
                    borderBottomColor: "divider",
                    borderLeftColor:
                      selectedSuggestionId === suggestion.id
                        ? "primary.main"
                        : suggestion.status === "accepted"
                          ? "success.main"
                          : "transparent",
                    bgcolor: selectedSuggestionId === suggestion.id ? "action.selected" : "transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <Button
                      fullWidth
                      variant="text"
                      onClick={() => onSelectSuggestion(suggestion.id)}
                      sx={{
                        justifyContent: "flex-start",
                        alignItems: "center",
                        textAlign: "left",
                        minWidth: 0,
                        px: 0,
                        py: 0.35,
                        textTransform: "none",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, width: "100%" }}>
                        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                          {renderStatusIcon(
                            suggestion.status === "accepted"
                              ? "accepted"
                              : suggestion.status === "dismissed"
                                ? "dismissed"
                                : "pending",
                            selectedSuggestionId === suggestion.id,
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            minWidth: 0,
                            fontWeight: selectedSuggestionId === suggestion.id ? 700 : 600,
                            color: selectedSuggestionId === suggestion.id ? "primary.main" : "text.primary",
                            lineHeight: 1.35,
                          }}
                        >
                          {suggestion.title}
                        </Typography>
                      </Box>
                    </Button>
                    <Button
                      size="small"
                      variant={selectedSuggestionId === suggestion.id ? "contained" : "text"}
                      onClick={() => onReviewSuggestion(suggestion.id)}
                      sx={{ flexShrink: 0, minWidth: 0 }}
                    >
                      {t("revision.inline.reviewSuggestion")}
                    </Button>
                  </Box>
                  {selectedSuggestionId === suggestion.id ? (
                    <Box sx={{ mt: 0.75, pl: 4 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", whiteSpace: "normal" }}
                      >
                        {suggestion.section}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5, whiteSpace: "normal" }}
                      >
                        {suggestion.description}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Box>
          ) : (
            <List disablePadding>
              <ListItem>
                <ListItemText
                  primary={t("revision.inline.checklistWaitingTitle")}
                  secondary={t("revision.inline.suggestionsWaitingDescription")}
                />
              </ListItem>
            </List>
          )}
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              disabled={!isReadyToFinalize || isPreparingFinalize}
              onClick={onMoveToFinalize}
            >
              {isPreparingFinalize
                ? t("revision.inline.preparingFinalizeButton")
                : t("revision.inline.toFinalizeButton")}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}

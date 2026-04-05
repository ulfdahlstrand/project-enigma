import { useState, type MouseEvent } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
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
    return <DeleteOutlineIcon fontSize="small" sx={{ color: "error.main" }} />;
  }
  if (isSelected) {
    return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "primary.main" }} />;
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
  onDismissSuggestion: (suggestionId: string) => void;
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
  onDismissSuggestion,
  onMoveToFinalize,
  isReadyToFinalize,
  isPreparingFinalize,
  onBackToRevision,
}: InlineRevisionChecklistProps) {
  const { t } = useTranslation("common");
  const reviewedSuggestions = suggestions.filter((s) => s.status !== "pending");
  const acceptedSuggestions = suggestions.filter((s) => s.status === "accepted");
  const progressWidth = suggestions.length > 0 ? (reviewedSuggestions.length / suggestions.length) * 100 : 0;
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuSuggestionId, setMenuSuggestionId] = useState<string | null>(null);

  const closeMenu = () => {
    setMenuAnchorEl(null);
    setMenuSuggestionId(null);
  };

  const openMenu = (event: MouseEvent<HTMLElement>, suggestionId: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuSuggestionId(suggestionId);
  };

  const handleReview = () => {
    if (!menuSuggestionId) {
      return;
    }

    onReviewSuggestion(menuSuggestionId);
    closeMenu();
  };

  const handleDismiss = () => {
    if (!menuSuggestionId) {
      return;
    }

    onDismissSuggestion(menuSuggestionId);
    closeMenu();
  };

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
              {suggestions.map((suggestion, index) => {
                const isSelected = selectedSuggestionId === suggestion.id;
                const isDismissed = suggestion.status === "dismissed";

                return (
                  <Box
                    key={suggestion.id}
                    sx={{
                      display: "block",
                      px: 1,
                      py: 0.5,
                      borderLeft: "2px solid",
                      borderBottom: index < suggestions.length - 1 ? "1px solid" : "none",
                      borderBottomColor: "divider",
                      borderLeftColor:
                        isSelected
                          ? "primary.main"
                          : suggestion.status === "accepted"
                            ? "success.main"
                            : isDismissed
                              ? "error.main"
                              : "transparent",
                      bgcolor: isSelected ? "action.selected" : "transparent",
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
                          py: 0.4,
                          textTransform: "none",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, width: "100%" }}>
                          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            {renderStatusIcon(
                              suggestion.status === "accepted"
                                ? "accepted"
                                : isDismissed
                                  ? "dismissed"
                                  : "pending",
                              isSelected,
                            )}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: isSelected ? 700 : 600,
                              color:
                                isDismissed
                                  ? "text.secondary"
                                  : isSelected
                                    ? "primary.main"
                                    : "text.primary",
                              textDecoration: isDismissed ? "line-through" : "none",
                              lineHeight: 1.35,
                            }}
                          >
                            {suggestion.title}
                          </Typography>
                        </Box>
                      </Button>
                      {suggestion.status === "pending" ? (
                        <IconButton
                          size="small"
                          onClick={() => onReviewSuggestion(suggestion.id)}
                          sx={{ flexShrink: 0 }}
                          aria-label={t("revision.inline.reviewSuggestion")}
                        >
                          <RateReviewOutlinedIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                      <IconButton
                        size="small"
                        onClick={(event) => openMenu(event, suggestion.id)}
                        sx={{ flexShrink: 0 }}
                        aria-label={t("revision.inline.suggestionMenu")}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
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
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={closeMenu}
          >
            <MenuItem onClick={handleReview}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <RateReviewOutlinedIcon fontSize="small" />
                <Typography variant="inherit">{t("revision.inline.reviewSuggestion")}</Typography>
              </Box>
            </MenuItem>
            <MenuItem onClick={handleDismiss}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.main" }}>
                <DeleteOutlineIcon fontSize="small" />
                <Typography variant="inherit">{t("revision.inline.dismissSuggestion")}</Typography>
              </Box>
            </MenuItem>
          </Menu>
        </>
      )}
    </Paper>
  );
}

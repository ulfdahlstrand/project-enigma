import AdjustIcon from "@mui/icons-material/Adjust";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { RevisionPlan, RevisionSuggestions, RevisionWorkItems } from "../../lib/ai-tools/registries/resume-tool-schemas";
import type { InlineRevisionStage } from "./inline-revision";
import { CollapsibleWorkItemGroup } from "./CollapsibleWorkItemGroup";
import { CollapsibleSection } from "./CollapsibleSection";
import { groupWorkItems, groupPlanActions } from "./group-work-items";

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
  plan: RevisionPlan | null;
  workItems: RevisionWorkItems | null;
  suggestions: RevisionSuggestions["suggestions"];
  selectedSuggestionId: string | null;
  onSelectSuggestion: (suggestionId: string) => void;
  onReviewSuggestion: (suggestionId: string) => void;
  onMoveToActions: () => void;
  isMovingToActions: boolean;
  onMoveToFinalize: () => void;
  isReadyToFinalize: boolean;
  isPreparingFinalize: boolean;
  onBackToActions: () => void;
};

export function InlineRevisionChecklist({
  stage,
  sourceBranchName,
  branchName,
  plan,
  workItems,
  suggestions,
  selectedSuggestionId,
  onSelectSuggestion,
  onReviewSuggestion,
  onMoveToActions,
  isMovingToActions,
  onMoveToFinalize,
  isReadyToFinalize,
  isPreparingFinalize,
  onBackToActions,
}: InlineRevisionChecklistProps) {
  const { t } = useTranslation("common");
  const reviewedSuggestions = suggestions.filter((suggestion) => suggestion.status !== "pending");
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted");
  const completedWorkItems =
    workItems?.items.filter((item) => item.status !== "pending" && item.status !== "in_progress") ?? [];
  const planDoneCount = plan?.actions.filter((action) => action.status === "done").length ?? 0;
  const suggestionHandledCount = suggestions.filter((suggestion) => suggestion.status !== "pending").length;
  const progressCount =
    stage === "actions"
      ? workItems?.items.length
        ? completedWorkItems.length
        : suggestionHandledCount
      : planDoneCount;
  const progressTotal =
    stage === "actions" ? (workItems?.items.length ?? suggestions.length) : (plan?.actions.length ?? 0);
  const progressWidth = progressTotal > 0 ? (progressCount / progressTotal) * 100 : 0;
  const getPlanStatusKey = (status: RevisionPlan["actions"][number]["status"]) => {
    if (status === "pending" && stage !== "planning") {
      return "planned";
    }

    return status;
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
          {stage === "actions"
            ? `${reviewedSuggestions.length}/${suggestions.length} ${t("revision.inline.suggestionsTitle").toLowerCase()}`
            : `${planDoneCount}/${plan?.actions.length ?? 0} ${t("revision.inline.checklistTitle").toLowerCase()}`}
        </Typography>
        <Box sx={{ height: 4, bgcolor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${progressWidth}%`,
              bgcolor: stage === "actions" ? "primary.main" : "success.main",
              borderRadius: 2,
              transition: "width 0.2s ease",
            }}
          />
        </Box>
        <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography variant="subtitle2">{t("revision.inline.checklistTitle")}</Typography>
          <Chip
            size="small"
            color="primary"
            variant={stage === "planning" ? "filled" : "outlined"}
            label={t(`revision.inline.stage.${stage}`)}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {stage === "planning" ? sourceBranchName : `${sourceBranchName} -> ${branchName}`}
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
          {plan ? (
            <>
              <Divider />
              <Box sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("revision.inline.planSummaryTitle")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {plan.summary}
                </Typography>
              </Box>
            </>
          ) : null}
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Button variant="contained" size="small" onClick={onBackToActions}>
              {t("revision.inline.backToActionsButton")}
            </Button>
          </Box>
        </>
      ) : plan ? (
        <>
          {/* Goal summary — always visible, minimal height */}
          <Box sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("revision.inline.goalTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.4 }}>
              {plan.summary}
            </Typography>
          </Box>

          {/* Planerat arbete — top-level collapsible */}
          {(() => {
            const planGroups = groupPlanActions(plan.actions);
            const planCompleted = planGroups.reduce((sum, g) => sum + g.completedCount, 0);
            const planTotal = planGroups.reduce((sum, g) => sum + g.totalCount, 0);
            const planAllDone = planGroups.every((g) => g.isAllDone);
            return (
              <CollapsibleSection
                title={t("revision.inline.planSummaryTitle")}
                completedCount={planCompleted}
                totalCount={planTotal}
                isAllDone={planAllDone}
              >
                {planGroups.map((group) => (
                  <CollapsibleWorkItemGroup key={group.section} group={group}>
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      {group.items.map((action, index) => (
                        <Box
                          key={action.id}
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            pl: 5,
                            pr: 1,
                            py: 0.85,
                            borderBottom: index < group.items.length - 1 ? "1px solid" : "none",
                            borderColor: "divider",
                          }}
                        >
                          <Box sx={{ mt: 0.1, display: "flex", alignItems: "center" }}>
                            {renderStatusIcon(action.status === "done" ? "done" : "pending")}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                              {action.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                              {action.description}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                mt: 0.4,
                                color: getPlanStatusKey(action.status) === "done" ? "success.main" : "text.disabled",
                              }}
                            >
                              {t(`revision.inline.planStatus.${getPlanStatusKey(action.status)}`)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </CollapsibleWorkItemGroup>
                ))}
              </CollapsibleSection>
            );
          })()}

          {stage === "planning" ? (
            <>
              <Divider />
              <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                <Button variant="contained" size="small" disabled={isMovingToActions} onClick={onMoveToActions}>
                  {isMovingToActions
                    ? t("revision.inline.preparingActionsButton")
                    : t("revision.inline.toActionsButton")}
                </Button>
              </Box>
            </>
          ) : null}
          {stage === "actions" ? (
            <>
              {workItems?.items.length ? (
                (() => {
                  const workGroups = groupWorkItems(workItems.items);
                  const workCompleted = workGroups.reduce((sum, g) => sum + g.completedCount, 0);
                  const workTotal = workGroups.reduce((sum, g) => sum + g.totalCount, 0);
                  const workAllDone = workGroups.every((g) => g.isAllDone);
                  return (
                    <CollapsibleSection
                      title={t("revision.inline.workItemsTitle")}
                      completedCount={workCompleted}
                      totalCount={workTotal}
                      isAllDone={workAllDone}
                      defaultExpanded
                    >
                      {workGroups.map((group) => (
                        <CollapsibleWorkItemGroup key={group.section} group={group}>
                          <Box sx={{ display: "flex", flexDirection: "column" }}>
                            {group.items.map((item, index) => (
                              <Box
                                key={item.id}
                                sx={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 1,
                                  pl: 5,
                                  pr: 1,
                                  py: 0.85,
                                  borderBottom: index < group.items.length - 1 ? "1px solid" : "none",
                                  borderColor: "divider",
                                }}
                              >
                                <Box sx={{ mt: 0.1, display: "flex", alignItems: "center" }}>
                                  {renderStatusIcon(
                                    item.status === "completed"
                                      ? "accepted"
                                      : item.status === "no_changes_needed"
                                        ? "done"
                                        : "pending",
                                  )}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                                    {item.title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                                    {item.description}
                                  </Typography>
                                  {item.note ? (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                                      {item.note}
                                    </Typography>
                                  ) : null}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </CollapsibleWorkItemGroup>
                      ))}
                    </CollapsibleSection>
                  );
                })()
              ) : null}
              <Divider />
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
                <Box sx={{ px: 2, pb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("revision.inline.suggestionsWaitingDescription")}
                  </Typography>
                </Box>
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
          ) : null}
        </>
      ) : (
        <List disablePadding>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.checklistWaitingTitle")}
              secondary={t("revision.inline.checklistWaitingDescription")}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.intentStatusTitle")}
              secondary={t("revision.inline.intentStatusDescription")}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.branchStatusTitle")}
              secondary={t("revision.inline.branchStatusDescription")}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t("revision.inline.diffStatusTitle")}
              secondary={t("revision.inline.diffStatusDescription")}
            />
          </ListItem>
        </List>
      )}
    </Paper>
  );
}

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { parseAsString, useQueryState } from "nuqs";

import type { ResumeDetailPageBundle } from "../pages/useResumeDetailPage";
import { AssistantToggles } from "./AssistantToggles";
import { CommandPalette } from "./CommandPalette";
import { UnsavedChip } from "./UnsavedChip";
import { ZoomControl } from "./ZoomControl";
import { useCommandPaletteActions } from "./useCommandPaletteActions";

// ---------------------------------------------------------------------------
// Bundle type — only the fields this bar actually needs from the page bundle
// ---------------------------------------------------------------------------

export type ResumeCommandBarBundle = Pick<
  ResumeDetailPageBundle,
  | "id"
  | "isEditRoute"
  | "isEditing"
  | "zoom"
  | "minZoom"
  | "maxZoom"
  | "setZoom"
  | "showSuggestionsPanel"
  | "showChatPanel"
  | "handleToggleAssistant"
  | "handleToggleSuggestions"
  | "inlineRevision"
  | "draftTitle"
  | "consultantTitle"
  | "draftPresentation"
  | "presentationText"
  | "draftSummary"
  | "summary"
  | "draftHighlightedItems"
  | "highlightedItemsText"
  | "handleSave"
  | "setCreateVariantDialogOpen"
  | "onDeleteResume"
  | "navigate"
  | "activeBranchId"
  | "activeBranchType"
  | "variantBranchId"
>;

interface ResumeCommandBarProps {
  bundle: ResumeCommandBarBundle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResumeCommandBar({ bundle }: ResumeCommandBarProps) {
  const { t } = useTranslation("common");
  const [, setCmdParam] = useQueryState("cmd", parseAsString);

  const {
    id,
    isEditRoute,
    isEditing,
    zoom,
    minZoom,
    maxZoom,
    setZoom,
    showSuggestionsPanel,
    showChatPanel,
    handleToggleAssistant,
    handleToggleSuggestions,
    inlineRevision,
    draftTitle,
    consultantTitle,
    draftPresentation,
    presentationText,
    draftSummary,
    summary,
    draftHighlightedItems,
    highlightedItemsText,
  } = bundle;

  const isSuggestionsOpen = inlineRevision.isOpen && showSuggestionsPanel;
  const isAiOpen =
    inlineRevision.isOpen &&
    showChatPanel &&
    inlineRevision.stage !== "finalize";

  // ⌘K / Ctrl+K global keydown listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        void setCmdParam("open");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setCmdParam]);

  const actions = useCommandPaletteActions({
    bundle,
    onClose: () => void setCmdParam(null),
  });

  return (
    <>
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
            minHeight: 40,
            px: { xs: 0.75, md: 1 },
            py: 0.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.75,
            flexWrap: "wrap",
          }}
        >
          {/* Left: ⌘K chip + UnsavedChip */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void setCmdParam("open")}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 24,
                height: 24,
                borderRadius: 1,
                textTransform: "none",
                fontSize: 11,
                lineHeight: 1,
                color: "text.secondary",
                borderColor: "divider",
                "&:hover": { borderColor: "text.secondary" },
              }}
            >
              {t("resume.commandBar.openPalette")}
            </Button>
            <UnsavedChip
              isEditRoute={isEditRoute}
              draftTitle={draftTitle}
              consultantTitle={consultantTitle}
              draftPresentation={draftPresentation}
              presentationText={presentationText}
              draftSummary={draftSummary}
              summary={summary}
              draftHighlightedItems={draftHighlightedItems}
              highlightedItemsText={highlightedItemsText}
            />
          </Box>

          {/* Right: ZoomControl + AssistantToggles */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, flexWrap: "wrap" }}>
            <ZoomControl
              zoom={zoom}
              minZoom={minZoom}
              maxZoom={maxZoom}
              setZoom={setZoom}
            />
            <AssistantToggles
              isEditing={isEditing}
              isSuggestionsOpen={isSuggestionsOpen}
              isAiOpen={isAiOpen}
              onToggleSuggestions={handleToggleSuggestions}
              onToggleAi={handleToggleAssistant}
            />
          </Box>
        </Box>
      </Paper>

      <CommandPalette actions={actions} resumeId={id} />
    </>
  );
}

/**
 * DraftStatusChip — shows "Synced" (preview mode or no pending edits) or
 * "Unsaved changes" (edit mode with at least one draft field differing from saved).
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Typography from "@mui/material/Typography";
import { isDraftSynced } from "../draft-status";

interface DraftStatusChipProps {
  isEditRoute: boolean;
  draftTitle: string;
  consultantTitle: string | null;
  draftPresentation: string;
  presentationText: string;
  draftSummary: string;
  summary: string | null;
  draftHighlightedItems: string;
  highlightedItemsText: string;
}

export function DraftStatusChip({
  isEditRoute,
  draftTitle,
  consultantTitle,
  draftPresentation,
  presentationText,
  draftSummary,
  summary,
  draftHighlightedItems,
  highlightedItemsText,
}: DraftStatusChipProps) {
  const { t } = useTranslation("common");

  const unsaved = !isDraftSynced({
    isEditRoute,
    draftTitle,
    consultantTitle,
    draftPresentation,
    presentationText,
    draftSummary,
    summary,
    draftHighlightedItems,
    highlightedItemsText,
  });

  if (!isEditRoute && !unsaved) return null;

  const label = unsaved
    ? t("resume.contextStrip.draftUnsaved")
    : t("resume.contextStrip.draftSynced");

  return (
    <Typography
      variant="caption"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 0.75,
        height: 28,
        borderRadius: 1,
        border: "1px solid",
        borderColor: unsaved ? "warning.light" : "divider",
        color: unsaved ? "warning.dark" : "text.disabled",
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {label}
    </Typography>
  );
}

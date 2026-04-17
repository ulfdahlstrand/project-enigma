/**
 * useCommandPaletteActions — returns the action list for the command palette.
 *
 * Actions are derived from the current bundle state and TanStack navigate fn.
 * Disabled actions are kept in the list so the user can see them (greyed out)
 * but their onSelect is a no-op.
 */
import { useTranslation } from "react-i18next";
import type { ResumeCommandBarBundle } from "./ResumeCommandBar";
import { isDraftSynced } from "../draft-status";

export interface PaletteAction {
  id: string;
  label: string;
  group: string;
  disabled: boolean;
  onSelect: () => void;
}

interface UseCommandPaletteActionsInput {
  bundle: ResumeCommandBarBundle;
  onClose: () => void;
}

export function useCommandPaletteActions({
  bundle,
  onClose,
}: UseCommandPaletteActionsInput): PaletteAction[] {
  const { t } = useTranslation("common");
  const {
    id,
    navigate,
    activeBranchId,
    isEditRoute,
    handleSave,
    handleToggleAssistant,
    handleToggleSuggestions,
    zoom,
    minZoom,
    maxZoom,
    setZoom,
    setCreateVariantDialogOpen,
    onDeleteResume,
    draftTitle,
    consultantTitle,
    draftPresentation,
    presentationText,
    draftSummary,
    summary,
    draftHighlightedItems,
    highlightedItemsText,
  } = bundle;

  const synced = isDraftSynced({
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

  const navigationGroup = "Navigation";
  const actionsGroup = "Actions";

  return [
    {
      id: "go-edit",
      label: t("resume.commandBar.action.goEdit"),
      group: navigationGroup,
      disabled: false,
      onSelect: () => {
        if (activeBranchId) {
          void navigate({ to: "/resumes/$id/edit/branch/$branchId", params: { id, branchId: activeBranchId } });
        } else {
          void navigate({ to: "/resumes/$id/edit", params: { id } });
        }
        onClose();
      },
    },
    {
      id: "go-preview",
      label: t("resume.commandBar.action.goPreview"),
      group: navigationGroup,
      disabled: false,
      onSelect: () => {
        if (activeBranchId) {
          void navigate({ to: "/resumes/$id/branch/$branchId", params: { id, branchId: activeBranchId } });
        } else {
          void navigate({ to: "/resumes/$id", params: { id } });
        }
        onClose();
      },
    },
    {
      id: "go-history",
      label: t("resume.commandBar.action.goHistory"),
      group: navigationGroup,
      disabled: false,
      onSelect: () => {
        void navigate({
          to: "/resumes/$id/history",
          params: { id },
          search: activeBranchId ? { branchId: activeBranchId } : {},
        });
        onClose();
      },
    },
    {
      id: "go-compare",
      label: t("resume.commandBar.action.goCompare"),
      group: navigationGroup,
      disabled: false,
      onSelect: () => {
        void navigate({ to: "/resumes/$id/compare", params: { id } });
        onClose();
      },
    },
    {
      id: "go-variants",
      label: t("resume.commandBar.action.goVariants"),
      group: navigationGroup,
      disabled: false,
      onSelect: () => {
        void navigate({ to: "/resumes/$id/variants", params: { id } });
        onClose();
      },
    },
    {
      id: "save",
      label: t("resume.commandBar.action.save"),
      group: actionsGroup,
      disabled: synced,
      onSelect: () => {
        if (!synced) {
          void handleSave();
          onClose();
        }
      },
    },
    {
      id: "toggle-ai",
      label: t("resume.commandBar.action.toggleAi"),
      group: actionsGroup,
      disabled: false,
      onSelect: () => {
        handleToggleAssistant();
        onClose();
      },
    },
    {
      id: "toggle-suggestions",
      label: t("resume.commandBar.action.toggleSuggestions"),
      group: actionsGroup,
      disabled: false,
      onSelect: () => {
        handleToggleSuggestions();
        onClose();
      },
    },
    {
      id: "zoom-in",
      label: t("resume.commandBar.action.zoomIn"),
      group: actionsGroup,
      disabled: zoom >= maxZoom,
      onSelect: () => {
        setZoom(Math.min(zoom + 0.1, maxZoom));
        onClose();
      },
    },
    {
      id: "zoom-out",
      label: t("resume.commandBar.action.zoomOut"),
      group: actionsGroup,
      disabled: zoom <= minZoom,
      onSelect: () => {
        setZoom(Math.max(zoom - 0.1, minZoom));
        onClose();
      },
    },
    {
      id: "zoom-reset",
      label: t("resume.commandBar.action.zoomReset"),
      group: actionsGroup,
      disabled: zoom === 1.0,
      onSelect: () => {
        setZoom(1.0);
        onClose();
      },
    },
    {
      id: "create-variant",
      label: t("resume.commandBar.action.createVariant"),
      group: actionsGroup,
      disabled: false,
      onSelect: () => {
        setCreateVariantDialogOpen(true);
        onClose();
      },
    },
    {
      id: "delete-resume",
      label: t("resume.commandBar.action.deleteResume"),
      group: actionsGroup,
      disabled: false,
      onSelect: () => {
        onDeleteResume();
        onClose();
      },
    },
  ];
}

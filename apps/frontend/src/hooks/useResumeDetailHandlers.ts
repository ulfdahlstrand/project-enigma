/**
 * useResumeDetailHandlers — navigation + mutation event handlers for the
 * resume detail/edit page. Kept separate so ResumeDetailPage stays focused
 * on data wiring and rendering.
 */
import { useNavigate } from "@tanstack/react-router";
import type { DraftPatch } from "./useResumeDraftState";

interface InlineRevisionHandle {
  isOpen: boolean;
  open: () => void | Promise<void>;
  close: () => void;
  reset: () => void;
  stage: string;
}

interface UseResumeDetailHandlersInput {
  id: string;
  isEditRoute: boolean;
  activeBranchId: string | null;
  mainBranchId: string | null;
  baseCommitId: string | null;
  currentViewedCommitId: string | null;
  navigate: ReturnType<typeof useNavigate>;
  inlineRevision: InlineRevisionHandle;
  showSuggestionsPanel: boolean;
  showChatPanel: boolean;
  setShowSuggestionsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowChatPanel: React.Dispatch<React.SetStateAction<boolean>>;
  onSaveVersion: (input: { branchId: string } & DraftPatch) => Promise<unknown>;
  onForkBranch: (input: {
    fromCommitId: string;
    name: string;
    resumeId: string;
  }) => Promise<{ id: string }>;
  onUpdateResume: (patch: DraftPatch) => void;
  buildDraftPatch: () => DraftPatch;
}

export interface ResumeDetailHandlers {
  handleSave: () => Promise<void>;
  handleSaveAsNewVersion: (name: string) => Promise<void>;
  handleCreateBranchFromCommit: (name: string) => Promise<void>;
  handleExitEditing: () => void;
  handleToggleAssistant: () => void;
  handleToggleSuggestions: () => void;
  handleCloseRevision: () => void;
}

export function useResumeDetailHandlers({
  id,
  isEditRoute,
  activeBranchId,
  mainBranchId,
  baseCommitId,
  currentViewedCommitId,
  navigate,
  inlineRevision,
  showSuggestionsPanel,
  showChatPanel,
  setShowSuggestionsPanel,
  setShowChatPanel,
  onSaveVersion,
  onForkBranch,
  onUpdateResume,
  buildDraftPatch,
}: UseResumeDetailHandlersInput): ResumeDetailHandlers {
  const isBranchBackedMode = activeBranchId !== null && activeBranchId !== mainBranchId;

  const handleSave = async (): Promise<void> => {
    const patch = buildDraftPatch();

    if (isBranchBackedMode && activeBranchId) {
      await onSaveVersion({ branchId: activeBranchId, ...patch });
      return;
    }

    if (!mainBranchId) {
      onUpdateResume(patch);
      return;
    }

    await onSaveVersion({ branchId: mainBranchId, ...patch });
  };

  const handleSaveAsNewVersion = async (name: string): Promise<void> => {
    if (!baseCommitId) throw new Error("Missing base commit");

    const patch = buildDraftPatch();
    const newBranch = await onForkBranch({ fromCommitId: baseCommitId, name, resumeId: id });
    await onSaveVersion({ branchId: newBranch.id, ...patch });

    if (isEditRoute) {
      await navigate({
        to: "/resumes/$id/edit/branch/$branchId",
        params: { id, branchId: newBranch.id },
      });
      return;
    }

    await navigate({
      to: "/resumes/$id/branch/$branchId",
      params: { id, branchId: newBranch.id },
    });
  };

  const handleCreateBranchFromCommit = async (name: string): Promise<void> => {
    if (!currentViewedCommitId) throw new Error("Missing current commit");

    const newBranch = await onForkBranch({
      fromCommitId: currentViewedCommitId,
      name,
      resumeId: id,
    });

    await navigate({
      to: "/resumes/$id/branch/$branchId",
      params: { id, branchId: newBranch.id },
    });
  };

  const handleExitEditing = (): void => {
    if (isEditRoute) {
      if (activeBranchId && activeBranchId !== mainBranchId) {
        void navigate({
          to: "/resumes/$id/branch/$branchId",
          params: { id, branchId: activeBranchId },
        });
        return;
      }

      void navigate({ to: "/resumes/$id", params: { id } });
      return;
    }

    inlineRevision.reset();
  };

  const navigateToEditWithAssistant = (): void => {
    if (activeBranchId && activeBranchId !== mainBranchId) {
      void navigate({
        to: "/resumes/$id/edit/branch/$branchId",
        params: { id, branchId: activeBranchId },
        search: { assistant: "true" },
      });
      return;
    }

    void navigate({
      to: "/resumes/$id/edit",
      params: { id },
      search: { assistant: "true" },
    });
  };

  const handleToggleAssistant = (): void => {
    if (!isEditRoute) {
      navigateToEditWithAssistant();
      return;
    }

    if (!inlineRevision.isOpen) {
      setShowSuggestionsPanel(false);
      setShowChatPanel(true);
      void inlineRevision.open();
      return;
    }

    if (showSuggestionsPanel) {
      setShowChatPanel((current) => !current);
      return;
    }

    setShowChatPanel((current) => {
      const next = !current;
      if (!next) inlineRevision.close();
      return next;
    });
  };

  const handleToggleSuggestions = (): void => {
    if (!isEditRoute) {
      navigateToEditWithAssistant();
      return;
    }

    if (!inlineRevision.isOpen) {
      setShowSuggestionsPanel(true);
      setShowChatPanel(false);
      void inlineRevision.open();
      return;
    }

    if (showChatPanel) {
      setShowSuggestionsPanel((current) => !current);
      return;
    }

    setShowSuggestionsPanel((current) => {
      const next = !current;
      if (!next) inlineRevision.close();
      return next;
    });
  };

  const handleCloseRevision = (): void => {
    if (isEditRoute) {
      if (activeBranchId && activeBranchId !== mainBranchId) {
        void navigate({
          to: "/resumes/$id/edit/branch/$branchId",
          params: { id, branchId: activeBranchId },
        });
      } else {
        void navigate({ to: "/resumes/$id/edit", params: { id } });
      }
    }

    setShowSuggestionsPanel(false);
    setShowChatPanel(false);
    inlineRevision.close();
  };

  return {
    handleSave,
    handleSaveAsNewVersion,
    handleCreateBranchFromCommit,
    handleExitEditing,
    handleToggleAssistant,
    handleToggleSuggestions,
    handleCloseRevision,
  };
}

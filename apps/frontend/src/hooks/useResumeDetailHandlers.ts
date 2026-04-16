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

export type AiPanel = "suggestions" | "chat" | "both";

export type SetAiPanel = (
  next: AiPanel | null | ((current: AiPanel | null) => AiPanel | null),
) => unknown;

interface UseResumeDetailHandlersInput {
  id: string;
  isEditRoute: boolean;
  activeBranchId: string | null;
  mainBranchId: string | null;
  currentViewedCommitId: string | null;
  navigate: ReturnType<typeof useNavigate>;
  inlineRevision: InlineRevisionHandle;
  aiPanel: AiPanel | null;
  setAiPanel: SetAiPanel;
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
  currentViewedCommitId,
  navigate,
  inlineRevision,
  aiPanel,
  setAiPanel,
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
      void setAiPanel("chat");
      void inlineRevision.open();
      return;
    }

    if (aiPanel === "suggestions") {
      void setAiPanel("both");
      return;
    }

    if (aiPanel === "both") {
      void setAiPanel("suggestions");
      return;
    }

    // aiPanel === "chat" or null → closing chat closes revision
    void setAiPanel(null);
    inlineRevision.close();
  };

  const handleToggleSuggestions = (): void => {
    if (!isEditRoute) {
      navigateToEditWithAssistant();
      return;
    }

    if (!inlineRevision.isOpen) {
      void setAiPanel("suggestions");
      void inlineRevision.open();
      return;
    }

    if (aiPanel === "chat") {
      void setAiPanel("both");
      return;
    }

    if (aiPanel === "both") {
      void setAiPanel("chat");
      return;
    }

    // aiPanel === "suggestions" or null → closing suggestions closes revision
    void setAiPanel(null);
    inlineRevision.close();
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

    void setAiPanel(null);
    inlineRevision.close();
  };

  return {
    handleSave,
    handleCreateBranchFromCommit,
    handleExitEditing,
    handleToggleAssistant,
    handleToggleSuggestions,
    handleCloseRevision,
  };
}

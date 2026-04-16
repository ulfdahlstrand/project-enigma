import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import { orpc } from "../orpc-client";
import {
  AssignmentRowEditor,
  type AssignmentDraftState,
} from "./assignment-editor/AssignmentRowEditor";
import { AssignmentRowView } from "./assignment-editor/AssignmentRowView";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignmentRow {
  /** Row id used by the current caller. May or may not equal assignmentId. */
  id: string;
  /** Stable assignment identity id used for branch-scoped content updates. */
  assignmentId: string;
  clientName: string;
  role: string;
  description: string;
  startDate: string | Date;
  endDate: string | Date | null;
  technologies: string[];
  isCurrent: boolean;
  keywords: string | null;
}

interface AssignmentEditorProps {
  assignments: AssignmentRow[];
  branchId: string;
  queryKey: readonly unknown[];
  /** When set, immediately opens this assignment id in edit mode. */
  autoEditId?: string | null;
  /** Called after autoEditId has been consumed so the parent can clear it. */
  onAutoEditConsumed?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function buildDraft(a: AssignmentRow): AssignmentDraftState {
  return {
    role: a.role,
    clientName: a.clientName,
    startDate: toDateInput(a.startDate),
    endDate: toDateInput(a.endDate),
    isCurrent: a.isCurrent,
    description: a.description,
    technologies: a.technologies.join(", "),
    keywords: a.keywords ?? "",
  };
}

// ---------------------------------------------------------------------------
// AssignmentEditor
// ---------------------------------------------------------------------------

export function AssignmentEditor({
  assignments,
  branchId,
  queryKey,
  autoEditId,
  onAutoEditConsumed,
}: AssignmentEditorProps) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssignmentDraftState | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!autoEditId) return;
    const target = assignments.find((a) => a.id === autoEditId || a.assignmentId === autoEditId);
    if (!target) return;
    startEdit(target);
    onAutoEditConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEditId, assignments]);

  // Delete uses the assignment identity id (cascades across branches)
  const deleteMutation = useMutation({
    mutationFn: (assignmentId: string) => orpc.deleteAssignment({ id: assignmentId }),
    onSuccess: async () => {
      setConfirmDeleteId(null);
      cancelEdit();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        queryClient.invalidateQueries({ queryKey: ["getResume"] }),
      ]);
    },
  });

  // All content edits are scoped to the active branch and assignment identity.
  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof orpc.updateBranchAssignment>[0]) =>
      orpc.updateBranchAssignment(input),
    onSuccess: async () => {
      setEditingId(null);
      setDraft(null);
      setSaveError(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        queryClient.invalidateQueries({ queryKey: ["getResume"] }),
      ]);
    },
    onError: () => setSaveError(true),
  });

  const startEdit = (a: AssignmentRow) => {
    setEditingId(a.id);
    setDraft(buildDraft(a));
    setSaveError(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setSaveError(false);
  };

  const handleSave = (original: AssignmentRow) => {
    if (!draft) return;
    const patch: Parameters<typeof orpc.updateBranchAssignment>[0] = {
      branchId,
      id: original.assignmentId,
    };

    if (draft.role !== original.role) patch.role = draft.role;
    if (draft.clientName !== original.clientName) patch.clientName = draft.clientName;
    if (draft.description !== original.description) patch.description = draft.description;
    if (draft.isCurrent !== original.isCurrent) patch.isCurrent = draft.isCurrent;

    const newTechs = draft.technologies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(newTechs) !== JSON.stringify(original.technologies)) {
      patch.technologies = newTechs;
    }

    const newKeywords = draft.keywords.trim() || null;
    if (newKeywords !== original.keywords) patch.keywords = newKeywords;

    const origStart = toDateInput(original.startDate);
    if (draft.startDate !== origStart) patch.startDate = draft.startDate;

    const origEnd = toDateInput(original.endDate);
    const newEnd = draft.isCurrent ? null : draft.endDate || null;
    if (String(newEnd) !== String(origEnd)) patch.endDate = newEnd;

    updateMutation.mutate(patch);
  };

  const setDraftField = <K extends keyof AssignmentDraftState>(
    field: K,
    value: AssignmentDraftState[K],
  ) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {assignments.map((a) => {
        const isEditing = editingId === a.id;

        return (
          <Box
            key={a.id}
            sx={{ position: "relative" }}
          >
            {!isEditing && (
              <IconButton
                size="small"
                onClick={() => startEdit(a)}
                aria-label={t("resume.edit.assignment.editButton")}
                sx={{ position: "absolute", top: 0, right: 0 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}

            {isEditing && draft ? (
              <AssignmentRowEditor
                draft={draft}
                saveError={saveError}
                confirmDelete={confirmDeleteId === a.assignmentId}
                isSaving={updateMutation.isPending}
                isDeleting={deleteMutation.isPending}
                onDraftChange={setDraftField}
                onSave={() => handleSave(a)}
                onCancel={cancelEdit}
                onStartConfirmDelete={() => setConfirmDeleteId(a.assignmentId)}
                onCancelConfirmDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={() => deleteMutation.mutate(a.assignmentId)}
              />
            ) : (
              <AssignmentRowView assignment={a} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

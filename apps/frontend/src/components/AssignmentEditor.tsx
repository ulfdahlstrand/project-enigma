import { useState, useRef, useLayoutEffect } from "react";
import { toQuarter } from "@cv-tool/utils";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import EditIcon from "@mui/icons-material/Edit";
import { orpc } from "../orpc-client";
import { ImproveAssignmentFab } from "./ai-assistant/ImproveAssignmentFab";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignmentRow {
  /** branch_assignment id — used for content updates */
  id: string;
  /** assignment identity id — used for deletion */
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
  queryKey: readonly unknown[];
  /** Canvas element (position:relative) used to portal AI FABs outside the paper. */
  canvasEl?: HTMLElement | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}


// ---------------------------------------------------------------------------
// Draft state shape
// ---------------------------------------------------------------------------

interface DraftState {
  role: string;
  clientName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  technologies: string;
}

function buildDraft(a: AssignmentRow): DraftState {
  return {
    role: a.role,
    clientName: a.clientName,
    startDate: toDateInput(a.startDate),
    endDate: toDateInput(a.endDate),
    isCurrent: a.isCurrent,
    description: a.description,
    technologies: a.technologies.join(", "),
  };
}

// ---------------------------------------------------------------------------
// AssignmentEditor
// ---------------------------------------------------------------------------

export function AssignmentEditor({ assignments, queryKey, canvasEl }: AssignmentEditorProps) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveError, setSaveError] = useState(false);

  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [cardTops, setCardTops] = useState<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    if (!canvasEl) return;
    const canvasTop = canvasEl.getBoundingClientRect().top;
    const tops = new Map<string, number>();
    cardRefs.current.forEach((el, id) => {
      if (el) tops.set(id, el.getBoundingClientRect().top - canvasTop);
    });
    setCardTops(tops);
  }, [canvasEl, assignments, editingId]);

  // All content edits go through updateBranchAssignment (id = branch_assignment id)
  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof orpc.updateBranchAssignment>[0]) =>
      orpc.updateBranchAssignment(input),
    onSuccess: async () => {
      setEditingId(null);
      setDraft(null);
      setSaveError(false);
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
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
    // id here is the branch_assignment id
    const patch: Parameters<typeof orpc.updateBranchAssignment>[0] = { id: original.id };

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

    const origStart = toDateInput(original.startDate);
    if (draft.startDate !== origStart) patch.startDate = draft.startDate;

    const origEnd = toDateInput(original.endDate);
    const newEnd = draft.isCurrent ? null : draft.endDate || null;
    if (String(newEnd) !== String(origEnd)) patch.endDate = newEnd;

    updateMutation.mutate(patch);
  };

  const handleAiAccept = (a: AssignmentRow) => (improvedText: string) => {
    if (editingId === a.id && draft) {
      setDraft((prev) => (prev ? { ...prev, description: improvedText } : prev));
    } else {
      // id is branch_assignment id
      updateMutation.mutate({ id: a.id, description: improvedText });
    }
  };

  const setDraftField = <K extends keyof DraftState>(field: K, value: DraftState[K]) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {assignments.map((a) => {
          const isEditing = editingId === a.id;
          const startQ = a.startDate ? toQuarter(a.startDate) : "";
          const endQ = a.isCurrent
            ? t("resume.detail.assignmentPresent")
            : a.endDate
            ? toQuarter(a.endDate)
            : "—";
          const paragraphs = a.description.split(/\n+/).filter(Boolean);

          return (
            <Box
              key={a.id}
              ref={(el: HTMLDivElement | null) => { cardRefs.current.set(a.id, el); }}
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <TextField
                      label={t("assignment.detail.roleLabel")}
                      value={draft.role}
                      onChange={(e) => setDraftField("role", e.target.value)}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label={t("assignment.detail.clientNameLabel")}
                      value={draft.clientName}
                      onChange={(e) => setDraftField("clientName", e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Box>

                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <TextField
                      label={t("assignment.detail.startDateLabel")}
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => setDraftField("startDate", e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label={t("assignment.detail.endDateLabel")}
                      type="date"
                      value={draft.endDate}
                      onChange={(e) => setDraftField("endDate", e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      disabled={draft.isCurrent}
                      sx={{ flex: 1 }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={draft.isCurrent}
                          onChange={(e) => {
                            setDraftField("isCurrent", e.target.checked);
                            if (e.target.checked) setDraftField("endDate", "");
                          }}
                          size="small"
                        />
                      }
                      label={t("assignment.detail.isCurrentLabel")}
                    />
                  </Box>

                  <TextField
                    label={t("assignment.detail.descriptionLabel")}
                    value={draft.description}
                    onChange={(e) => setDraftField("description", e.target.value)}
                    multiline
                    minRows={4}
                    size="small"
                    fullWidth
                  />

                  <TextField
                    label={t("assignment.detail.technologiesLabel")}
                    value={draft.technologies}
                    onChange={(e) => setDraftField("technologies", e.target.value)}
                    size="small"
                    fullWidth
                  />

                  {saveError && (
                    <Alert severity="error">{t("resume.edit.assignment.saveError")}</Alert>
                  )}

                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={updateMutation.isPending}
                      onClick={() => handleSave(a)}
                    >
                      {updateMutation.isPending
                        ? t("resume.edit.assignment.saving")
                        : t("assignment.detail.saveButton")}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={updateMutation.isPending}
                      onClick={cancelEdit}
                    >
                      {t("resume.edit.assignment.cancelButton")}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", mb: 0.5, pr: 5 }}
                  >
                    {a.role}
                  </Typography>

                  <Typography variant="subtitle1" sx={{ fontWeight: 400, mb: 1.5 }}>
                    {a.clientName} {startQ} – {endQ}
                  </Typography>

                  {paragraphs.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      {paragraphs.map((para, i) => (
                        <Typography
                          key={i}
                          variant="body2"
                          sx={{ textAlign: "justify", mb: i < paragraphs.length - 1 ? 1.5 : 0 }}
                        >
                          {para}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {(a.technologies.length > 0 || a.keywords) && (
                    <Box sx={{ bgcolor: "action.hover", borderRadius: 0, px: 1.5, py: 1, mt: 2 }}>
                      {a.technologies.length > 0 && (
                        <Typography variant="body2" sx={{ mb: a.keywords ? 0.5 : 0 }}>
                          <Box
                            component="span"
                            sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}
                          >
                            {t("resume.detail.assignmentTechnologies")}:{" "}
                          </Box>
                          {a.technologies.join(", ")}
                        </Typography>
                      )}
                      {a.keywords && (
                        <Typography variant="body2">
                          <Box
                            component="span"
                            sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}
                          >
                            {t("assignment.new.keywordsLabel")}:{" "}
                          </Box>
                          {a.keywords}
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
              )}
            </Box>
          );
        })}
      </Box>

      {canvasEl && assignments.map((a) => {
        if (editingId === a.id) return null;
        const top = cardTops.get(a.id);
        if (top === undefined) return null;
        return createPortal(
          <ImproveAssignmentFab
            key={a.id}
            assignmentId={a.id}
            role={a.role}
            clientName={a.clientName}
            description={a.description}
            top={top}
            onAccept={handleAiAccept(a)}
          />,
          canvasEl
        );
      })}
    </>
  );
}

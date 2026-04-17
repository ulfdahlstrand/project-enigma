/**
 * AssignmentRowEditor — edit-mode form for a single assignment. Renders the
 * draft fields, save/cancel controls, and the inline delete-confirm flow.
 * The parent hook owns draft state, mutations, and the save diff builder.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField, { type TextFieldProps } from "@mui/material/TextField";

export interface AssignmentDraftState {
  role: string;
  clientName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  technologies: string[];
  keywords: string;
}

interface AssignmentRowEditorProps {
  draft: AssignmentDraftState;
  saveError: boolean;
  confirmDelete: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onDraftChange: <K extends keyof AssignmentDraftState>(
    field: K,
    value: AssignmentDraftState[K],
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartConfirmDelete: () => void;
  onCancelConfirmDelete: () => void;
  onConfirmDelete: () => void;
}

export function AssignmentRowEditor({
  draft,
  saveError,
  confirmDelete,
  isSaving,
  isDeleting,
  onDraftChange,
  onSave,
  onCancel,
  onStartConfirmDelete,
  onCancelConfirmDelete,
  onConfirmDelete,
}: AssignmentRowEditorProps) {
  const { t } = useTranslation("common");
  const disableActions = isSaving || isDeleting;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <TextField
          label={t("assignment.detail.roleLabel")}
          value={draft.role}
          onChange={(event) => onDraftChange("role", event.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label={t("assignment.detail.clientNameLabel")}
          value={draft.clientName}
          onChange={(event) => onDraftChange("clientName", event.target.value)}
          size="small"
          fullWidth
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        <TextField
          label={t("assignment.detail.startDateLabel")}
          type="date"
          value={draft.startDate}
          onChange={(event) => onDraftChange("startDate", event.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
        <TextField
          label={t("assignment.detail.endDateLabel")}
          type="date"
          value={draft.endDate}
          onChange={(event) => onDraftChange("endDate", event.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          disabled={draft.isCurrent}
          sx={{ flex: 1 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={draft.isCurrent}
              onChange={(event) => {
                onDraftChange("isCurrent", event.target.checked);
                if (event.target.checked) onDraftChange("endDate", "");
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
        onChange={(event) => onDraftChange("description", event.target.value)}
        multiline
        minRows={4}
        size="small"
        fullWidth
      />

      <Autocomplete
        multiple
        freeSolo
        options={[] as string[]}
        value={draft.technologies}
        onChange={(_, value) => onDraftChange("technologies", value)}
        size="small"
        fullWidth
        renderInput={(params) => (
          <TextField
            {...(params as TextFieldProps)}
            label={t("assignment.detail.technologiesLabel")}
          />
        )}
      />

      <TextField
        label={t("assignment.new.keywordsLabel")}
        value={draft.keywords}
        onChange={(event) => onDraftChange("keywords", event.target.value)}
        size="small"
        fullWidth
      />

      {saveError && <Alert severity="error">{t("resume.edit.assignment.saveError")}</Alert>}

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            disabled={disableActions}
            onClick={onSave}
          >
            {isSaving ? t("resume.edit.assignment.saving") : t("assignment.detail.saveButton")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={disableActions}
            onClick={onCancel}
          >
            {t("resume.edit.assignment.cancelButton")}
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          {confirmDelete ? (
            <>
              <Button
                variant="contained"
                color="error"
                size="small"
                disabled={isDeleting}
                onClick={onConfirmDelete}
              >
                {t("resume.edit.assignment.confirmDelete")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={isDeleting}
                onClick={onCancelConfirmDelete}
              >
                {t("resume.edit.assignment.cancelButton")}
              </Button>
            </>
          ) : (
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={disableActions}
              onClick={onStartConfirmDelete}
            >
              {t("resume.edit.assignment.deleteButton")}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

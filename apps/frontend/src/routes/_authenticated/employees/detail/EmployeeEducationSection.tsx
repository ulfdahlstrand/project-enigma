/**
 * EmployeeEducationSection — the right-hand column of the employee detail
 * page. Lists degrees / certifications / languages and handles add + delete
 * per section through callbacks supplied by the parent route.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

export type EducationType = "degree" | "certification" | "language";

export interface EducationEntry {
  id: string;
  type: EducationType;
  value: string;
}

interface EducationSection {
  type: EducationType;
  label: string;
  entries: EducationEntry[];
}

interface EmployeeEducationSectionProps {
  sections: EducationSection[];
  addingToSection: EducationType | null;
  newEntryValue: string;
  createError: boolean;
  deleteError: boolean;
  isDeleting: boolean;
  isCreating: boolean;
  onStartAdd: (type: EducationType) => void;
  onCancelAdd: () => void;
  onCommitAdd: (type: EducationType) => void;
  onEntryValueChange: (value: string) => void;
  onDeleteEntry: (entryId: string) => void;
}

export function EmployeeEducationSection({
  sections,
  addingToSection,
  newEntryValue,
  createError,
  deleteError,
  isDeleting,
  isCreating,
  onStartAdd,
  onCancelAdd,
  onCommitAdd,
  onEntryValueChange,
  onDeleteEntry,
}: EmployeeEducationSectionProps) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ flex: 1, minWidth: 320 }}>
      <Typography variant="h5" gutterBottom>
        {t("employee.detail.educationHeading")}
      </Typography>

      {createError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.detail.educationAddError")}
        </Alert>
      )}
      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.detail.educationDeleteError")}
        </Alert>
      )}

      <Box
        data-testid="education-grid"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
      {sections.map(({ type, label, entries }) => (
        <Box key={type}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              bgcolor: "action.hover",
              px: 1.5,
              py: 0.75,
              mb: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: "0.06em", flex: 1 }}
            >
              {label.toUpperCase()}
            </Typography>
            <Tooltip title={t("employee.detail.educationAddButton")}>
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onStartAdd(type)}>
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {entries.length === 0 && addingToSection !== type && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              {t("employee.detail.educationEmpty")}
            </Typography>
          )}
          {entries.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.5,
                px: 0.5,
              }}
            >
              <Typography variant="body2">{entry.value}</Typography>
              <IconButton
                size="small"
                color="error"
                disabled={isDeleting}
                onClick={() => onDeleteEntry(entry.id)}
                aria-label={t("employee.detail.educationDeleteButton")}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}

          {addingToSection === type && (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.5, px: 0.5 }}>
              <TextField
                value={newEntryValue}
                onChange={(event) => onEntryValueChange(event.target.value)}
                size="small"
                autoFocus
                fullWidth
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCommitAdd(type);
                  if (event.key === "Escape") onCancelAdd();
                }}
                sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem", py: 0.75 } }}
              />
              <IconButton
                size="small"
                color="primary"
                onClick={() => onCommitAdd(type)}
                disabled={!newEntryValue.trim() || isCreating}
              >
                <CheckIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" onClick={onCancelAdd}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
        </Box>
      ))}
      </Box>
    </Box>
  );
}

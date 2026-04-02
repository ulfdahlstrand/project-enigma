import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";

interface SkillsAddCategoryFormProps {
  adding: boolean;
  categoryName: string;
  skillName: string;
  isPending: boolean;
  onCategoryNameChange: (v: string) => void;
  onSkillNameChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onStartAdding: () => void;
}

export function SkillsAddCategoryForm({
  adding,
  categoryName,
  skillName,
  isPending,
  onCategoryNameChange,
  onSkillNameChange,
  onCommit,
  onCancel,
  onStartAdding,
}: SkillsAddCategoryFormProps) {
  const { t } = useTranslation("common");

  if (!adding) {
    return (
      <Button startIcon={<AddIcon />} size="small" onClick={onStartAdding}>
        {t("resume.edit.skillAddCategoryButton")}
      </Button>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
      <TextField
        label={t("resume.edit.skillCategoryLabel")}
        value={categoryName}
        onChange={(e) => onCategoryNameChange(e.target.value)}
        size="small"
        autoFocus
        sx={{ flex: "1 1 160px" }}
      />
      <TextField
        label={t("resume.edit.skillNameLabel")}
        value={skillName}
        onChange={(e) => onSkillNameChange(e.target.value)}
        size="small"
        onKeyDown={(e) => { if (e.key === "Enter") onCommit(); }}
        sx={{ flex: "1 1 160px" }}
      />
      <Button
        variant="contained"
        size="small"
        onClick={onCommit}
        disabled={!categoryName.trim() || !skillName.trim() || isPending}
      >
        {t("resume.edit.skillSaveButton")}
      </Button>
      <Button variant="outlined" size="small" onClick={onCancel}>
        {t("resume.edit.skillCancelButton")}
      </Button>
    </Box>
  );
}

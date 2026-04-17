import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useCreateTranslationResume } from "../../hooks/versioning";

const LANGUAGES = ["sv", "en"] as const;

interface CreateTranslationDialogProps {
  open: boolean;
  sourceResumeId: string;
  sourceLanguage: string;
  sourceTitle: string;
  onClose: () => void;
}

export function CreateTranslationDialog({
  open,
  sourceResumeId,
  sourceLanguage,
  sourceTitle,
  onClose,
}: CreateTranslationDialogProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const createTranslation = useCreateTranslationResume();

  const availableLanguages = LANGUAGES.filter((l) => l !== sourceLanguage);
  const [targetLanguage, setTargetLanguage] = useState<string>(availableLanguages[0] ?? "en");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (createTranslation.isPending) return;
    setError(null);
    setName("");
    setTargetLanguage(availableLanguages[0] ?? "en");
    onClose();
  }

  async function handleCreate() {
    setError(null);
    try {
      const trimmedName = name.trim();
      const result = await createTranslation.mutateAsync({
        sourceResumeId,
        targetLanguage,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
      handleClose();
      void navigate({ to: "/resumes/$id", params: { id: result.resumeId } });
    } catch {
      setError(t("resume.createTranslationDialog.error"));
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("resume.createTranslationDialog.title")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <FormControl fullWidth>
          <InputLabel id="translation-language-label">
            {t("resume.createTranslationDialog.languageLabel")}
          </InputLabel>
          <Select
            labelId="translation-language-label"
            value={targetLanguage}
            label={t("resume.createTranslationDialog.languageLabel")}
            onChange={(e) => setTargetLanguage(e.target.value)}
          >
            {availableLanguages.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {t(`resume.createTranslationDialog.language_${lang}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label={t("resume.createTranslationDialog.titleLabel")}
          placeholder={sourceTitle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createTranslation.isPending}>
          {t("resume.createTranslationDialog.cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={createTranslation.isPending}
          onClick={() => void handleCreate()}
        >
          {createTranslation.isPending
            ? t("resume.createTranslationDialog.creating")
            : t("resume.createTranslationDialog.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

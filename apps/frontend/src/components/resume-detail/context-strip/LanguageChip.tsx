/**
 * LanguageChip — shows the active language and lets the user navigate to
 * linked resumes (translations) or create a new translation resume.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { useNavigate } from "@tanstack/react-router";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Alert from "@mui/material/Alert";
import MuiMenuItem from "@mui/material/MenuItem";
import { useListCommitTags, useCreateTranslationResume } from "../../../hooks/versioning";
import type { LinkedResumeMeta } from "@cv-tool/contracts";

const SUPPORTED_LANGUAGES = ["sv", "en"] as const;

interface LanguageChipProps {
  resumeId: string;
  language: string | null | undefined;
  navigate: ReturnType<typeof useNavigate>;
}

export function LanguageChip({ resumeId, language, navigate }: LanguageChipProps) {
  const { t } = useTranslation("common");
  const { data: commitTags } = useListCommitTags(resumeId);
  const createTranslationResume = useCreateTranslationResume();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const label = language?.toUpperCase() ?? "—";

  const linkedResumes: LinkedResumeMeta[] = (commitTags ?? []).map((tag) =>
    tag.source.resumeId === resumeId ? tag.target : tag.source,
  );

  function openCreateDialog() {
    setSelectedLang("");
    setCreateError(null);
    setAnchor(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!selectedLang || createTranslationResume.isPending) return;
    setCreateError(null);
    try {
      const result = await createTranslationResume.mutateAsync({
        sourceResumeId: resumeId,
        targetLanguage: selectedLang,
      });
      setDialogOpen(false);
      await navigate({ to: "/resumes/$id", params: { id: result.resumeId } });
    } catch {
      setCreateError(t("resume.languageSwitcher.createDialog.error"));
    }
  }

  function navigateToResume(linked: LinkedResumeMeta) {
    setAnchor(null);
    if (linked.branchId) {
      void navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: linked.resumeId, branchId: linked.branchId },
      });
    } else {
      void navigate({ to: "/resumes/$id", params: { id: linked.resumeId } });
    }
  }

  return (
    <>
      <Button
        aria-label={label}
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={
          <KeyboardArrowDownIcon sx={{ fontSize: "0.8em !important", ml: "-2px" }} />
        }
        size="small"
        disableRipple
        sx={{
          typography: "caption",
          color: "text.primary",
          fontWeight: 500,
          px: 0.75,
          py: 0,
          height: 28,
          minWidth: 0,
          background: "transparent",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          textTransform: "none",
          letterSpacing: "inherit",
          "&:hover": {
            background: (theme) => theme.palette.action.hover,
            borderColor: "text.disabled",
          },
          "& .MuiButton-endIcon": { ml: 0.25, mr: "-2px", color: "text.disabled" },
        }}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { elevation: 3, sx: { mt: 0.5 } } }}
      >
        <MenuItem
          dense
          onClick={openCreateDialog}
          sx={{ fontStyle: "italic", color: "text.secondary" }}
        >
          {t("resume.languageSwitcher.addTranslation")}
        </MenuItem>
        <Divider />
        {linkedResumes.map((linked) => (
          <MenuItem
            key={linked.resumeId}
            dense
            onClick={() => navigateToResume(linked)}
          >
            {linked.language.toUpperCase()}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("resume.languageSwitcher.createDialog.title")}</DialogTitle>
        <DialogContent>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t("resume.languageSwitcher.createDialog.languageLabel")}</InputLabel>
            <Select
              autoFocus
              value={selectedLang}
              label={t("resume.languageSwitcher.createDialog.languageLabel")}
              onChange={(e) => setSelectedLang(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MuiMenuItem key={lang} value={lang}>
                  {lang}
                </MuiMenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("resume.languageSwitcher.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!selectedLang || createTranslationResume.isPending}
            onClick={() => void handleCreate()}
          >
            {createTranslationResume.isPending
              ? t("resume.languageSwitcher.createDialog.creating")
              : t("resume.languageSwitcher.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

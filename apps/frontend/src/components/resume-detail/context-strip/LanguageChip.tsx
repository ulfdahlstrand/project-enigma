/**
 * LanguageChip — shows the active language and lets the user switch languages
 * by delegating to the existing LanguageSwitcher in ghost mode, or renders a
 * plain ghost button when variantBranchId is unavailable.
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
import { useCreateTranslationBranch, useResumeBranches } from "../../../hooks/versioning";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Alert from "@mui/material/Alert";
import MuiMenuItem from "@mui/material/MenuItem";

const SUPPORTED_LANGUAGES = ["sv", "en"] as const;

interface LanguageChipProps {
  resumeId: string;
  currentBranchId: string | null;
  variantBranchId: string | null;
  language: string | null | undefined;
  navigate: ReturnType<typeof useNavigate>;
}

export function LanguageChip({
  resumeId,
  currentBranchId,
  variantBranchId,
  language,
  navigate,
}: LanguageChipProps) {
  const { t } = useTranslation("common");
  const { data: branches } = useResumeBranches(resumeId);
  const createTranslationBranch = useCreateTranslationBranch();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const label = language?.toUpperCase() ?? "—";

  const variantBranch = variantBranchId ? branches?.find((b) => b.id === variantBranchId) : null;
  const translations = variantBranchId
    ? (branches?.filter((b) => b.branchType === "translation" && b.sourceBranchId === variantBranchId) ?? [])
    : [];

  function openCreateDialog() {
    setSelectedLang("");
    setCreateError(null);
    setAnchor(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!selectedLang || !variantBranchId || createTranslationBranch.isPending) return;
    setCreateError(null);
    try {
      const newBranch = await createTranslationBranch.mutateAsync({
        sourceBranchId: variantBranchId,
        language: selectedLang,
        resumeId,
      });
      setDialogOpen(false);
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId: newBranch.id },
      });
    } catch {
      setCreateError(t("resume.languageSwitcher.createDialog.error"));
    }
  }

  function navigateToBranch(branchId: string) {
    if (branchId !== currentBranchId) {
      void navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId },
      });
    }
    setAnchor(null);
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
        {variantBranch && (
          <MenuItem
            dense
            selected={currentBranchId === variantBranchId}
            onClick={() => navigateToBranch(variantBranch.id)}
          >
            {variantBranch.language || variantBranch.name}
          </MenuItem>
        )}
        {translations.map((b) => (
          <MenuItem
            key={b.id}
            dense
            selected={b.id === currentBranchId}
            onClick={() => navigateToBranch(b.id)}
          >
            {b.language || b.name}
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("resume.languageSwitcher.createDialog.title")}</DialogTitle>
        <DialogContent>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>
              {t("resume.languageSwitcher.createDialog.languageLabel")}
            </InputLabel>
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
            disabled={!selectedLang || createTranslationBranch.isPending}
            onClick={() => void handleCreate()}
          >
            {createTranslationBranch.isPending
              ? t("resume.languageSwitcher.createDialog.creating")
              : t("resume.languageSwitcher.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

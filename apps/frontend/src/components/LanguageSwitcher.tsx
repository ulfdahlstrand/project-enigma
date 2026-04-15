/**
 * LanguageSwitcher — dropdown showing translation branches for the current variant.
 *
 * Two render modes:
 *   ghost=false (default): MUI FormControl + Select (compact footer style)
 *   ghost=true: Button + Menu (no border, breadcrumb style)
 *
 * Both modes include an "Add translation" action that opens a create dialog.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useCreateTranslationBranch, useResumeBranches } from "../hooks/versioning";

const SUPPORTED_LANGUAGES = ["sv", "en"] as const;

interface LanguageSwitcherProps {
  resumeId: string;
  /** ID of the currently active branch (could be variant or translation). */
  currentBranchId: string | null | undefined;
  /** ID of the current variant (parent). */
  variantBranchId: string;
  compact?: boolean;
  /**
   * When true, renders as a ghost button + Menu (no border, breadcrumb style).
   * When false (default), renders as a MUI FormControl + Select.
   */
  ghost?: boolean;
}

export function LanguageSwitcher({
  resumeId,
  currentBranchId,
  variantBranchId,
  compact = false,
  ghost = false,
}: LanguageSwitcherProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: branches } = useResumeBranches(resumeId);
  const createTranslationBranch = useCreateTranslationBranch();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [language, setLanguage] = useState<string>("");
  const [createError, setCreateError] = useState<string | null>(null);

  if (!branches) return null;

  const variantBranch = branches.find((b) => b.id === variantBranchId) ?? null;
  const translations = branches.filter(
    (b) => b.branchType === "translation" && b.sourceBranchId === variantBranchId,
  );
  const activeTranslation = translations.find((b) => b.id === currentBranchId) ?? null;
  const currentLabel =
    activeTranslation?.language ??
    activeTranslation?.name ??
    variantBranch?.language ??
    variantBranch?.name ??
    "";

  // The select value for the boxed mode: active translation id, or fall back to variant.
  const selectValue = activeTranslation?.id ?? variantBranchId;
  const ADD_VALUE = "__add__";

  function openCreateDialog() {
    setLanguage("");
    setCreateError(null);
    setMenuAnchor(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!language || createTranslationBranch.isPending) return;
    setCreateError(null);
    try {
      const newBranch = await createTranslationBranch.mutateAsync({
        sourceBranchId: variantBranchId,
        language,
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
  }

  const createDialog = (
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
            value={language}
            label={t("resume.languageSwitcher.createDialog.languageLabel")}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {lang}
              </MenuItem>
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
          disabled={!language || createTranslationBranch.isPending}
          onClick={() => void handleCreate()}
        >
          {createTranslationBranch.isPending
            ? t("resume.languageSwitcher.createDialog.creating")
            : t("resume.languageSwitcher.createDialog.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ── Ghost mode: breadcrumb-style button + Menu ────────────────────────────
  if (ghost) {
    return (
      <>
        <Button
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          endIcon={<KeyboardArrowDownIcon sx={{ fontSize: "0.85em !important", ml: "-2px" }} />}
          disableRipple
          sx={{
            typography: "caption",
            color: "text.primary",
            fontWeight: 500,
            px: 0,
            py: 0,
            minWidth: 0,
            height: "auto",
            lineHeight: "inherit",
            background: "transparent",
            border: "none",
            textTransform: "none",
            letterSpacing: "inherit",
            "&:hover": {
              background: "transparent",
              textDecoration: "underline",
            },
            "& .MuiButton-endIcon": {
              ml: 0.25,
              mr: "-4px",
              color: "text.disabled",
              opacity: 0,
              transition: "opacity 0.15s",
            },
            "&:hover .MuiButton-endIcon": {
              opacity: 1,
            },
          }}
        >
          {currentLabel}
        </Button>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { elevation: 3, sx: { mt: 0.5 } } }}
        >
          <MenuItem onClick={openCreateDialog} sx={{ fontStyle: "italic" }} dense>
            {t("resume.languageSwitcher.addTranslation")}
          </MenuItem>
          <Divider />
          {variantBranch && (
            <MenuItem
              dense
              selected={selectValue === variantBranchId}
              onClick={() => { setMenuAnchor(null); navigateToBranch(variantBranchId); }}
            >
              {variantBranch.language || variantBranch.name}
            </MenuItem>
          )}
          {translations.map((branch) => (
            <MenuItem
              key={branch.id}
              dense
              selected={branch.id === currentBranchId}
              onClick={() => { setMenuAnchor(null); navigateToBranch(branch.id); }}
            >
              {branch.language || branch.name}
            </MenuItem>
          ))}
        </Menu>

        {createDialog}
      </>
    );
  }

  // ── Boxed mode: MUI FormControl + Select ─────────────────────────────────
  return (
    <>
      <FormControl size="small" sx={{ minWidth: compact ? 118 : 180 }}>
        {!compact ? <InputLabel>{t("resume.languageSwitcher.label")}</InputLabel> : null}
        <Select
          value={selectValue}
          {...(!compact ? { label: t("resume.languageSwitcher.label") } : {})}
          onChange={(e) => {
            const val = e.target.value;
            if (val === ADD_VALUE) {
              openCreateDialog();
              return;
            }
            navigateToBranch(val);
          }}
          displayEmpty={compact}
          {...(compact
            ? {
                sx: {
                  bgcolor: "grey.200",
                  borderRadius: 0,
                  minHeight: 24,
                  fontSize: 11,
                  color: "text.secondary",
                  "& .MuiSelect-select": {
                    py: 0.25,
                    px: 0.75,
                    pr: "24px !important",
                    minHeight: "unset",
                  },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
                  "& .MuiSvgIcon-root": { fontSize: 16, right: 4 },
                },
              }
            : {})}
        >
          <MenuItem value={ADD_VALUE}>
            <Box sx={{ fontStyle: "italic", color: "text.primary", fontSize: "0.875rem" }}>
              {t("resume.languageSwitcher.addTranslation")}
            </Box>
          </MenuItem>
          <Divider />
          {variantBranch && (
            <MenuItem value={variantBranchId}>
              {variantBranch.language || variantBranch.name}
            </MenuItem>
          )}
          {translations.map((branch) => (
            <MenuItem key={branch.id} value={branch.id}>
              {branch.language || branch.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {createDialog}
    </>
  );
}

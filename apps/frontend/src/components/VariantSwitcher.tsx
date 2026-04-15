/**
 * VariantSwitcher — dropdown showing all branches for a resume.
 * Branch selection navigates to the branch route, which resolves the branch's
 * head commit under the hood.
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
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useForkResumeBranch, useResumeBranches } from "../hooks/versioning";

interface VariantSwitcherProps {
  resumeId: string;
  /** ID of the currently active branch. */
  currentBranchId: string | null | undefined;
  compact?: boolean;
}

export function VariantSwitcher({ resumeId, currentBranchId, compact = false }: VariantSwitcherProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: branches } = useResumeBranches(resumeId);
  const forkResumeBranch = useForkResumeBranch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedBaseBranchId, setSelectedBaseBranchId] = useState("");
  const [forkError, setForkError] = useState<string | null>(null);

  if (!branches) return null;
  const availableBranches = branches.filter((b) => b.branchType === "variant");

  const activeBranch = availableBranches.find((branch) => branch.id === currentBranchId) ?? null;
  const MANAGE_VALUE = "__manage__";
  const CREATE_VALUE = "__create__";

  function openCreateDialog() {
    const fallbackBranchId = activeBranch?.id ?? availableBranches[0]?.id ?? "";
    setSelectedBaseBranchId(fallbackBranchId);
    setNewName("");
    setForkError(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    const baseBranch = availableBranches.find((branch) => branch.id === selectedBaseBranchId);
    const fromCommitId = baseBranch?.headCommitId ?? null;

    if (!fromCommitId || !newName.trim()) {
      return;
    }

    setForkError(null);

    try {
      const newBranch = await forkResumeBranch.mutateAsync({
        fromCommitId,
        name: newName.trim(),
        resumeId,
      });
      setDialogOpen(false);
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId: newBranch.id },
      });
    } catch {
      setForkError(t("resume.variants.createDialog.error"));
    }
  }

  const selectedBaseBranch = availableBranches.find((branch) => branch.id === selectedBaseBranchId) ?? null;
  const selectedBaseCommitId = selectedBaseBranch?.headCommitId ?? null;

  return (
    <>
      <FormControl size="small" sx={{ minWidth: compact ? 118 : 180 }}>
        {!compact ? <InputLabel>{t("resume.variantSwitcher.label")}</InputLabel> : null}
        <Select
          value={currentBranchId ?? ""}
          {...(!compact ? { label: t("resume.variantSwitcher.label") } : {})}
          onChange={(e) => {
            const val = e.target.value;
            if (val === CREATE_VALUE) {
              openCreateDialog();
              return;
            }
            if (val === MANAGE_VALUE) {
              void navigate({ to: "/resumes/$id/variants", params: { id: resumeId } });
              return;
            }
            if (val !== currentBranchId) {
              void navigate({
                to: "/resumes/$id/branch/$branchId",
                params: { id: resumeId, branchId: val },
              });
            }
          }}
          displayEmpty={compact}
          {...(compact ? {
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
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "divider",
              },
              "& .MuiSvgIcon-root": {
                fontSize: 16,
                right: 4,
              },
            },
          } : {})}
        >
          <MenuItem value={CREATE_VALUE}>
            <Box sx={{ fontStyle: "italic", color: "text.primary", fontSize: "0.875rem" }}>
              {t("resume.variants.createButton")}
            </Box>
          </MenuItem>
          <MenuItem value={MANAGE_VALUE}>
            <Box sx={{ fontStyle: "italic", color: "text.secondary", fontSize: "0.875rem" }}>
              {t("resume.variantSwitcher.manageVariants")}
            </Box>
          </MenuItem>
          <Divider />
          {availableBranches.map((branch) => (
            <MenuItem key={branch.id} value={branch.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {branch.name}
                {branch.isMain && (
                  <Chip label={t("resume.variants.mainBadge")} size="small" color="primary" />
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("resume.variants.createDialog.title")}</DialogTitle>
        <DialogContent>
          {forkError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {forkError}
            </Alert>
          )}
          <TextField
            autoFocus
            label={t("resume.variants.createDialog.nameLabel")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>{t("resume.variants.createDialog.basedOnLabel")}</InputLabel>
            <Select
              value={selectedBaseBranchId}
              label={t("resume.variants.createDialog.basedOnLabel")}
              onChange={(e) => {
                setSelectedBaseBranchId(e.target.value);
                setForkError(null);
              }}
            >
              {availableBranches.map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!selectedBaseCommitId && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t("resume.variants.createDialog.noVersions")}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("resume.variants.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!newName.trim() || !selectedBaseCommitId || forkResumeBranch.isPending}
            onClick={() => void handleCreate()}
          >
            {forkResumeBranch.isPending
              ? t("resume.variants.createDialog.creating")
              : t("resume.variants.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

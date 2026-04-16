/**
 * VariantChip — shows the active variant name and lets the user switch variants
 * or trigger "Add variant" from an inline dropdown.
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

type Branch = {
  id: string;
  name: string;
  branchType: string;
  isArchived: boolean;
  headCommitId: string | null;
  isMain: boolean;
};

interface VariantChipProps {
  resumeId: string;
  branches: Branch[];
  variantBranchId: string;
  activeBranchName: string;
  mergedCommitIds: Set<string>;
  navigate: ReturnType<typeof useNavigate>;
  onAddVariant: () => void;
}

export function VariantChip({
  resumeId,
  branches,
  variantBranchId,
  activeBranchName,
  mergedCommitIds,
  navigate,
  onAddVariant,
}: VariantChipProps) {
  const { t } = useTranslation("common");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const variantBranch = branches.find((b) => b.id === variantBranchId);
  const label = variantBranch?.name ?? activeBranchName;

  const variantOptions = branches.filter(
    (b) =>
      b.branchType === "variant" &&
      !b.isArchived &&
      !(b.headCommitId !== null && !b.isMain && mergedCommitIds.has(b.headCommitId)),
  );

  function handleSelect(branchId: string) {
    setAnchor(null);
    void navigate({
      to: "/resumes/$id/branch/$branchId",
      params: { id: resumeId, branchId },
    });
  }

  function handleAddVariant() {
    setAnchor(null);
    onAddVariant();
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
          onClick={handleAddVariant}
          sx={{ fontStyle: "italic", color: "text.secondary" }}
        >
          {t("resume.variants.addVariant")}
        </MenuItem>
        <Divider />
        {variantOptions.map((b) => (
          <MenuItem
            key={b.id}
            dense
            selected={b.id === variantBranchId}
            onClick={() => handleSelect(b.id)}
          >
            {b.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

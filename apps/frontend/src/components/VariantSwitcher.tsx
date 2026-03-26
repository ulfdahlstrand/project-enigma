/**
 * VariantSwitcher — dropdown showing all branches for a resume.
 * Clicking a variant navigates to /resumes/$id (the same page; future work
 * can thread branchId through as a search param).
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useResumeBranches } from "../hooks/versioning";

interface VariantSwitcherProps {
  resumeId: string;
  /** ID of the currently active branch. */
  currentBranchId: string | null | undefined;
}

export function VariantSwitcher({ resumeId, currentBranchId }: VariantSwitcherProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: branches } = useResumeBranches(resumeId);

  if (!branches) return null;

  const MANAGE_VALUE = "__manage__";

  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel>{t("resume.variantSwitcher.label")}</InputLabel>
      <Select
        value={currentBranchId ?? ""}
        label={t("resume.variantSwitcher.label")}
        onChange={(e) => {
          const val = e.target.value;
          if (val === MANAGE_VALUE) {
            void navigate({ to: "/resumes/$id/variants", params: { id: resumeId } });
            return;
          }
          if (val !== currentBranchId) {
            void navigate({
              to: "/resumes/$id",
              params: { id: resumeId },
              search: { branchId: val },
            });
          }
        }}
      >
        <MenuItem value={MANAGE_VALUE}>
          <Box sx={{ fontStyle: "italic", color: "text.secondary", fontSize: "0.875rem" }}>
            {t("resume.variantSwitcher.manageVariants")}
          </Box>
        </MenuItem>
        <Divider />
        {branches.map((branch) => (
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
  );
}

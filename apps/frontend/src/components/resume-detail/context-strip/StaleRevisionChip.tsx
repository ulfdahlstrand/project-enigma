/**
 * StaleRevisionChip — informational pill shown when the current branch is
 * a revision: "Revision of {sourceName}"
 *
 * Intentionally read-only (no CTA). Action buttons remain in the existing
 * RevisionActionBanner component above the workspace.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Typography from "@mui/material/Typography";

type BranchType = "variant" | "translation" | "revision" | null;

interface Branch {
  name: string;
}

interface StaleRevisionChipProps {
  activeBranchType: BranchType;
  sourceBranch: Branch | null;
}

export function StaleRevisionChip({
  activeBranchType,
  sourceBranch,
}: StaleRevisionChipProps) {
  const { t } = useTranslation("common");

  if (activeBranchType === "revision" && sourceBranch) {
    return (
      <Typography
        variant="caption"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: 0.75,
          height: 28,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "info.light",
          color: "info.dark",
          fontWeight: 500,
          lineHeight: 1,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {t("resume.contextStrip.revisionOf", { source: sourceBranch.name })}
      </Typography>
    );
  }

  return null;
}

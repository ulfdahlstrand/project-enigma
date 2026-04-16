/**
 * UnsavedChip — shows "Unsaved changes" when the draft diverges from the saved
 * resume, hidden when synced or when not in edit mode.
 *
 * Uses the shared isDraftSynced helper so the comparison logic stays consistent
 * with DraftStatusChip in the context strip.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Typography from "@mui/material/Typography";
import { isDraftSynced, type DraftStatusFields } from "../draft-status";

type UnsavedChipProps = DraftStatusFields;

export function UnsavedChip(props: UnsavedChipProps) {
  const { t } = useTranslation("common");

  if (isDraftSynced(props)) return null;

  return (
    <Typography
      variant="caption"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 0.75,
        height: 24,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "warning.light",
        color: "warning.dark",
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {t("resume.commandBar.unsaved")}
    </Typography>
  );
}

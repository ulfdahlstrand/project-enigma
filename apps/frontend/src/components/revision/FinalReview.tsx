/**
 * FinalReview — shown when all steps are approved.
 * Lets the user choose to merge or keep the revision branch.
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MergeIcon from "@mui/icons-material/CallMerge";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

interface FinalReviewProps {
  workflowId: string;
  onMerge: () => void;
  onKeep: () => void;
  isMerging: boolean;
  isKeeping: boolean;
}

export function FinalReview({
  onMerge,
  onKeep,
  isMerging,
  isKeeping,
}: FinalReviewProps) {
  const { t } = useTranslation("common");
  const isBusy = isMerging || isKeeping;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 3,
        px: 4,
        py: 6,
      }}
    >
      <CheckCircleIcon sx={{ fontSize: 56, color: "success.main" }} />

      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {t("revision.finalReview.title")}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("revision.finalReview.subtitle")}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", maxWidth: 600 }}>
        {/* Merge option */}
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            flex: 1,
            minWidth: 240,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            borderColor: "primary.main",
            borderWidth: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <MergeIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t("revision.finalReview.mergeButton")}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", flex: 1 }}>
            {t("revision.finalReview.mergeDescription")}
          </Typography>
          <Button
            variant="contained"
            onClick={onMerge}
            disabled={isBusy}
            startIcon={<MergeIcon />}
          >
            {isMerging ? t("revision.finalReview.merging") : t("revision.finalReview.mergeButton")}
          </Button>
        </Paper>

        {/* Keep as branch option */}
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            flex: 1,
            minWidth: 240,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AccountTreeIcon color="action" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t("revision.finalReview.keepButton")}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", flex: 1 }}>
            {t("revision.finalReview.keepDescription")}
          </Typography>
          <Button
            variant="outlined"
            onClick={onKeep}
            disabled={isBusy}
            startIcon={<AccountTreeIcon />}
          >
            {isKeeping ? t("revision.finalReview.keeping") : t("revision.finalReview.keepButton")}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { diffWords } from "diff";

export type ReviewViewMode = "side-by-side" | "unified";

export type ReviewRenderArgs<TValue> = {
  mode: ReviewViewMode;
  value: TValue;
  updateValue: (next: TValue) => void;
};

interface DiffReviewDialogProps<TValue, TResult> {
  open: boolean;
  value: TValue;
  renderReview: (args: ReviewRenderArgs<TValue>) => ReactNode;
  formatResult: (value: TValue) => TResult;
  onApply: (result: TResult) => void | Promise<void>;
  onKeepEditing: () => void;
  onDiscard: () => void;
  title?: string;
  applyLabel?: string;
  keepEditingLabel?: string;
  discardLabel?: string;
}

export type TextDiffReviewValue = {
  original: string;
  suggested: string;
};

function SideBySideTextReview({ value }: { value: TextDiffReviewValue }) {
  const { t } = useTranslation("common");
  return (
    <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          {t("aiAssistant.diff.original")}
        </Typography>
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: "error.light",
            color: "error.contrastText",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            minHeight: 100,
            opacity: 0.85,
          }}
        >
          {value.original}
        </Box>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          {t("aiAssistant.diff.suggested")}
        </Typography>
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: "success.light",
            color: "success.contrastText",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            minHeight: 100,
          }}
        >
          {value.suggested}
        </Box>
      </Box>
    </Box>
  );
}

function UnifiedTextReview({ value }: { value: TextDiffReviewValue }) {
  const parts = diffWords(value.original, value.suggested);

  return (
    <Box
      sx={{
        mt: 1,
        p: 2,
        borderRadius: 1,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        fontSize: "0.875rem",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "monospace",
      }}
    >
      {parts.map((part, i) => {
        if (part.removed) {
          return (
            <Box
              key={i}
              component="span"
              sx={{
                bgcolor: "error.light",
                color: "error.contrastText",
                textDecoration: "line-through",
                px: 0.25,
                borderRadius: 0.5,
              }}
            >
              {part.value}
            </Box>
          );
        }

        if (part.added) {
          return (
            <Box
              key={i}
              component="span"
              sx={{
                bgcolor: "success.light",
                color: "success.contrastText",
                px: 0.25,
                borderRadius: 0.5,
              }}
            >
              {part.value}
            </Box>
          );
        }

        return <span key={i}>{part.value}</span>;
      })}
    </Box>
  );
}

export function renderTextDiffReview({ mode, value }: ReviewRenderArgs<TextDiffReviewValue>) {
  return mode === "side-by-side"
    ? <SideBySideTextReview value={value} />
    : <UnifiedTextReview value={value} />;
}

export function DiffReviewDialog<TValue, TResult>({
  open,
  value,
  renderReview,
  formatResult,
  onApply,
  onKeepEditing,
  onDiscard,
  title,
  applyLabel,
  keepEditingLabel,
  discardLabel,
}: DiffReviewDialogProps<TValue, TResult>) {
  const { t } = useTranslation("common");
  const [viewMode, setViewMode] = useState<ReviewViewMode>("unified");
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (open) {
      setDraftValue(value);
    }
  }, [open, value]);

  const handleViewChange = (_: React.MouseEvent, next: ReviewViewMode | null) => {
    if (next !== null) {
      setViewMode(next);
    }
  };

  const handleApply = async () => {
    await onApply(formatResult(draftValue));
  };

  return (
    <Dialog open={open} fullWidth maxWidth="md" onClose={onKeepEditing}>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          pb: 1,
        }}
      >
        {title ?? t("aiAssistant.diff.title")}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={handleViewChange}
          aria-label={t("aiAssistant.diff.title")}
        >
          <ToggleButton value="unified">{t("aiAssistant.diff.unified")}</ToggleButton>
          <ToggleButton value="side-by-side">{t("aiAssistant.diff.sideBySide")}</ToggleButton>
        </ToggleButtonGroup>
      </DialogTitle>

      <DialogContent dividers>
        {renderReview({
          mode: viewMode,
          value: draftValue,
          updateValue: setDraftValue,
        })}
      </DialogContent>

      <DialogActions>
        <Button onClick={onDiscard} color="error" variant="outlined">
          {discardLabel ?? t("aiAssistant.diff.discard")}
        </Button>
        <Button onClick={onKeepEditing} color="inherit">
          {keepEditingLabel ?? t("aiAssistant.diff.keepEditing")}
        </Button>
        <Button onClick={handleApply} variant="contained" color="primary">
          {applyLabel ?? t("aiAssistant.diff.apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

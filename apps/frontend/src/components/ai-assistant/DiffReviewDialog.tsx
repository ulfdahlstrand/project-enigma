import { useState } from "react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "side-by-side" | "unified";

interface Props {
  open: boolean;
  original: string;
  suggested: string;
  onApply: () => void;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

// ---------------------------------------------------------------------------
// Side-by-side view
// ---------------------------------------------------------------------------

function SideBySideView({ original, suggested }: { original: string; suggested: string }) {
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
          {original}
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
          {suggested}
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Unified diff view
// ---------------------------------------------------------------------------

function UnifiedView({ original, suggested }: { original: string; suggested: string }) {
  const parts = diffWords(original, suggested);

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

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

export function DiffReviewDialog({ open, original, suggested, onApply, onKeepEditing, onDiscard }: Props) {
  const { t } = useTranslation("common");
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");

  const handleViewChange = (_: React.MouseEvent, next: ViewMode | null) => {
    if (next !== null) setViewMode(next);
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
        {t("aiAssistant.diff.title")}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={handleViewChange}
          aria-label={t("aiAssistant.diff.title")}
        >
          <ToggleButton value="side-by-side">{t("aiAssistant.diff.sideBySide")}</ToggleButton>
          <ToggleButton value="unified">{t("aiAssistant.diff.unified")}</ToggleButton>
        </ToggleButtonGroup>
      </DialogTitle>

      <DialogContent dividers>
        {viewMode === "side-by-side" ? (
          <SideBySideView original={original} suggested={suggested} />
        ) : (
          <UnifiedView original={original} suggested={suggested} />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onDiscard} color="error" variant="outlined">
          {t("aiAssistant.diff.discard")}
        </Button>
        <Button onClick={onKeepEditing} color="inherit">
          {t("aiAssistant.diff.keepEditing")}
        </Button>
        <Button onClick={onApply} variant="contained" color="primary">
          {t("aiAssistant.diff.apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

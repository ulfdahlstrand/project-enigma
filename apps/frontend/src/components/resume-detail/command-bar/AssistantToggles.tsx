import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChecklistIcon from "@mui/icons-material/Checklist";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useTranslation } from "react-i18next";

interface AssistantTogglesProps {
  isEditing: boolean;
  isSuggestionsOpen: boolean;
  isAiOpen: boolean;
  onToggleSuggestions: () => void;
  onToggleAi: () => void;
}

export function AssistantToggles({
  isEditing,
  isSuggestionsOpen,
  isAiOpen,
  onToggleSuggestions,
  onToggleAi,
}: AssistantTogglesProps) {
  const { t } = useTranslation("common");

  if (!isEditing) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      <Button
        size="small"
        variant="text"
        startIcon={<ChecklistIcon sx={{ fontSize: 16 }} />}
        onClick={onToggleSuggestions}
        sx={{
          minWidth: 0,
          px: 0.75,
          minHeight: 24,
          borderRadius: 0,
          color: isSuggestionsOpen ? "text.primary" : "text.secondary",
          bgcolor: isSuggestionsOpen ? "grey.300" : "transparent",
          textTransform: "none",
          fontSize: 11,
          lineHeight: 1.2,
          "&:hover": {
            bgcolor: isSuggestionsOpen ? "grey.400" : "grey.200",
          },
        }}
      >
        {t("revision.inline.suggestionsButton")}
      </Button>
      <Button
        size="small"
        variant="text"
        startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
        onClick={onToggleAi}
        sx={{
          minWidth: 0,
          px: 0.75,
          minHeight: 24,
          borderRadius: 0,
          color: isAiOpen ? "text.primary" : "text.secondary",
          bgcolor: isAiOpen ? "grey.300" : "transparent",
          textTransform: "none",
          fontSize: 11,
          lineHeight: 1.2,
          "&:hover": {
            bgcolor: isAiOpen ? "grey.400" : "grey.200",
          },
        }}
      >
        {t("revision.inline.aiHelpButton")}
      </Button>
    </Box>
  );
}

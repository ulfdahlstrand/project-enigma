/**
 * ImprovePresentationFab — circular AI button sitting to the right of the
 * resume document, vertically aligned with the presentation section.
 *
 * The parent canvas must have `position: relative`. The `top` value is
 * measured by the parent and passed in so the button aligns precisely with
 * the presentation text block.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { useAIAssistantContext } from "../../lib/ai-assistant-context";
import {
  buildPresentationPrompt,
  buildPresentationKickoff,
} from "./lib/build-presentation-prompt";

// A4 page width in px — must match the document canvas constant
const PAGE_WIDTH = 794;

interface Props {
  resumeId: string;
  presentation: string[];
  consultantTitle?: string | null;
  employeeName?: string | undefined;
  /** Distance from the top of the `position:relative` canvas to the presentation section. */
  top: number;
  onAccept: (improvedText: string) => void;
}

export function ImprovePresentationFab({
  resumeId,
  presentation,
  consultantTitle,
  employeeName,
  top,
  onAccept,
}: Props) {
  const { t } = useTranslation("common");
  const { openAssistant } = useAIAssistantContext();

  const presentationText = presentation.join("\n\n");

  const handleClick = () => {
    const title = consultantTitle ?? employeeName ?? "Presentation";
    openAssistant({
      entityType: "resume",
      entityId: resumeId,
      title,
      systemPrompt: buildPresentationPrompt({
        presentation: presentationText,
        ...(consultantTitle != null && { consultantTitle }),
        ...(employeeName !== undefined && { employeeName }),
      }),
      kickoffMessage: buildPresentationKickoff(),
      originalContent: presentationText,
      onAccept,
    });
  };

  return (
    <Tooltip title={t("resume.detail.ai.improvePresentation")} placement="left">
      <Fab
        size="small"
        aria-label={t("resume.detail.ai.improvePresentation")}
        onClick={handleClick}
        sx={{
          position: "absolute",
          left: `calc(50% + ${PAGE_WIDTH / 2}px + 16px)`,
          top: (theme) => `calc(${top}px + ${theme.spacing(6)})`,
          zIndex: 10,
          bgcolor: "transparent",
          color: "action.active",
          boxShadow: 0,
          opacity: 0.5,
          transition: "opacity 0.2s, box-shadow 0.2s, background-color 0.2s",
          "&:hover": {
            bgcolor: "action.selected",
            boxShadow: 1,
            opacity: 1,
          },
        }}
      >
        <AutoFixHighIcon fontSize="small" />
      </Fab>
    </Tooltip>
  );
}

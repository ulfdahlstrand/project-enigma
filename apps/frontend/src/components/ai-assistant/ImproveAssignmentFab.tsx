/**
 * ImproveAssignmentFab — circular AI button sitting to the right of the
 * resume document, vertically aligned with a specific assignment card.
 *
 * Uses the same absolute-positioning approach as ImprovePresentationFab.
 * The parent canvas must have `position: relative`. The `top` value is
 * measured by AssignmentEditor relative to the canvas element.
 */
import { useTranslation } from "react-i18next";
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { useAIAssistantContext } from "../../lib/ai-assistant-context";
import { buildAssignmentPrompt, buildAssignmentKickoff } from "./lib/build-assignment-prompt";

// Must match the DocumentPage / canvas constant
const PAGE_WIDTH = 794;

interface Props {
  assignmentId: string;
  role: string;
  clientName: string;
  description: string;
  /** Distance in px from the top of the `position:relative` canvas to this card. */
  top: number;
  onAccept: (improvedText: string) => void;
}

export function ImproveAssignmentFab({
  assignmentId,
  role,
  clientName,
  description,
  top,
  onAccept,
}: Props) {
  const { t } = useTranslation("common");
  const { openAssistant } = useAIAssistantContext();

  const handleClick = () => {
    openAssistant({
      entityType: "assignment",
      entityId: assignmentId,
      title: `${role} @ ${clientName}`,
      systemPrompt: buildAssignmentPrompt({ description, role, clientName }),
      kickoffMessage: buildAssignmentKickoff(),
      originalContent: description,
      onAccept,
    });
  };

  return (
    <Tooltip title={t("assignment.detail.ai.improveButton")} placement="left">
      <Fab
        size="small"
        aria-label={t("assignment.detail.ai.improveButton")}
        onClick={handleClick}
        sx={{
          position: "absolute",
          left: `calc(50% + ${PAGE_WIDTH / 2}px + 16px)`,
          top: (theme) => `calc(${top}px + ${theme.spacing(3)})`,
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

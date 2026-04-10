/**
 * ImproveDescriptionButton — opens the AI assistant panel pre-configured
 * for improving an assignment description. The diff review dialog is handled
 * inside the panel; when the user accepts, `onAccept` is called with the
 * suggested text.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import { buildAssignmentPrompt, buildAssignmentKickoff } from "./ai-assistant/lib/build-assignment-prompt";
import { loadPromptFragments } from "../features/admin/prompt-config-client";

interface Props {
  assignmentId: string;
  description: string;
  role?: string | undefined;
  clientName?: string | undefined;
  onAccept: (improvedText: string) => void;
}

export function ImproveDescriptionButton({
  assignmentId,
  description,
  role,
  clientName,
  onAccept,
}: Props) {
  const { t } = useTranslation("common");
  const { openAssistant } = useAIAssistantContext();

  const handleClick = async () => {
    const titleParts = [role, clientName].filter(Boolean);
    const title = titleParts.length > 0 ? titleParts.join(" @ ") : undefined;
    const fragments = await loadPromptFragments("frontend.assignment-assistant");
    openAssistant({
      entityType: "assignment",
      entityId: assignmentId,
      ...(title !== undefined && { title }),
      systemPrompt: buildAssignmentPrompt({
        description,
        ...(role !== undefined && { role }),
        ...(clientName !== undefined && { clientName }),
      }, fragments.system_template !== undefined ? {
        systemTemplate: fragments.system_template,
      } : undefined),
      kickoffMessage: buildAssignmentKickoff(fragments.kickoff_message),
      originalContent: description,
      onAccept,
    });
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<AutoAwesomeIcon fontSize="small" />}
      onClick={handleClick}
    >
      {t("assignment.detail.ai.improveButton")}
    </Button>
  );
}

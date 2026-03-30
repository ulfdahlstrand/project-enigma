import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { AIAssistantChat } from "../ai-assistant/AIAssistantChat";
import type { AIToolContext, AIToolRegistry } from "../../lib/ai-tools/types";
import type { InlineRevisionStage } from "./inline-revision";

type InlineRevisionChatPanelProps = {
  stage: InlineRevisionStage;
  sourceBranchName: string;
  branchName: string;
  onClose: () => void;
  toolCount: number;
  toolRegistry: AIToolRegistry;
  toolContext: AIToolContext;
  autoStartMessage?: string | null;
  automation?: {
    key: string;
    message: string;
  } | null;
  guardrail: {
    isSatisfied: boolean;
    reminderMessage: string;
  };
};

export function InlineRevisionChatPanel({
  stage,
  sourceBranchName,
  branchName,
  onClose,
  toolCount,
  toolRegistry,
  toolContext,
  autoStartMessage,
  automation,
  guardrail,
}: InlineRevisionChatPanelProps) {
  const { t } = useTranslation("common");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2, display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6">{t("revision.inline.chatTitle")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("revision.inline.chatDescription")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {stage === "planning"
              ? t("revision.inline.chatPlanningContext", { sourceBranchName })
              : t("revision.inline.chatActionContext", {
                  sourceBranchName,
                  branchName,
                })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {t("revision.inline.toolsReady", { count: toolCount })}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t("revision.inline.closeButton")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <AIAssistantChat
          toolRegistry={toolRegistry}
          toolContext={toolContext}
          autoStartMessage={autoStartMessage}
          automation={automation}
          guardrail={guardrail}
        />
      </Box>
    </Box>
  );
}

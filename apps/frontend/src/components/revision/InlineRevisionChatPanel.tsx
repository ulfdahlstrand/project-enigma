import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { AIAssistantChat } from "../ai-assistant/AIAssistantChat";
import type { AIToolContext, AIToolRegistry } from "../../lib/ai-tools/types";

type InlineRevisionChatPanelProps = {
  toolRegistry: AIToolRegistry;
  toolContext: AIToolContext;
};

export function InlineRevisionChatPanel({
  toolRegistry,
  toolContext,
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
        </Box>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <AIAssistantChat
          toolRegistry={toolRegistry}
          toolContext={toolContext}
          showApplyChanges={false}
        />
      </Box>
    </Box>
  );
}

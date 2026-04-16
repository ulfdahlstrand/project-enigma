import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import AddIcon from "@mui/icons-material/Add";
import { AIAssistantChat } from "../ai-assistant/AIAssistantChat";
import { ConversationHistoryList } from "../ai-assistant/ConversationHistoryList";
import type { AIToolContext, AIToolRegistry } from "../../lib/ai-tools/types";
import { useAIAssistantContext } from "../../lib/ai-assistant-context";
import { useAIConversation, useCloseAIConversation } from "../../hooks/ai-assistant";

type InlineRevisionChatPanelProps = {
  toolRegistry: AIToolRegistry;
  toolContext: AIToolContext;
};

type TabValue = "chat" | "history";

export function InlineRevisionChatPanel({
  toolRegistry,
  toolContext,
}: InlineRevisionChatPanelProps) {
  const { t } = useTranslation("common");
  const {
    entityType,
    entityId,
    activeConversationId,
    setActiveConversationId,
    selectHistoryConversation,
  } = useAIAssistantContext();
  const [activeTab, setActiveTab] = useState<TabValue>("chat");
  const { data: activeConversation } = useAIConversation(activeConversationId, {
    pollingEnabled: activeTab === "chat",
  });
  const closeConversation = useCloseAIConversation(entityType, entityId);

  const handleTabChange = (_event: SyntheticEvent, nextTab: TabValue) => {
    setActiveTab(nextTab);
  };

  const handleSelectConversation = (conversationId: string) => {
    selectHistoryConversation(conversationId);
    setActiveTab("chat");
  };

  const handleNewConversation = async () => {
    if (activeConversationId && !activeConversation?.isClosed) {
      await closeConversation.mutateAsync({ conversationId: activeConversationId });
    }

    setActiveConversationId(null);
    setActiveTab("chat");
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab label={t("aiAssistant.chatTab")} value="chat" />
          <Tab label={t("aiAssistant.historyTab")} value="history" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {activeTab === "chat" ? (
          <AIAssistantChat
            toolRegistry={toolRegistry}
            toolContext={toolContext}
            showApplyChanges={false}
          />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Box sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => void handleNewConversation()}
                size="small"
                variant="outlined"
                fullWidth
              >
                {t("aiAssistant.newConversation")}
              </Button>
            </Box>
            <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
              <ConversationHistoryList onSelectConversation={handleSelectConversation} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

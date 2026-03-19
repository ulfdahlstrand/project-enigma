import { useState } from "react";
import { useTranslation } from "react-i18next";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { useAIAssistantContext } from "../../lib/ai-assistant-context";
import { useCloseAIConversation } from "../../hooks/ai-assistant";
import { AIAssistantChat } from "./AIAssistantChat";
import { ConversationHistoryList } from "./ConversationHistoryList";

const DRAWER_WIDTH = 420;

type TabValue = "chat" | "history";

export function AIAssistantDrawer() {
  const { t } = useTranslation("common");
  const {
    isOpen,
    entityType,
    entityId,
    activeConversationId,
    hideDrawer,
    setActiveConversationId,
    selectHistoryConversation,
  } = useAIAssistantContext();

  const closeConversation = useCloseAIConversation(entityType, entityId);

  const [activeTab, setActiveTab] = useState<TabValue>("chat");

  const handleTabChange = (_: React.SyntheticEvent, next: TabValue) => {
    setActiveTab(next);
  };

  const handleSelectConversation = (conversationId: string) => {
    selectHistoryConversation(conversationId);
    setActiveTab("chat");
  };

  const handleNewConversation = async () => {
    if (activeConversationId) {
      // Await close before creating — the backend resumes existing open conversations,
      // so the old one must be closed first or it would be returned instead of a new one.
      await closeConversation.mutateAsync({ conversationId: activeConversationId });
    }
    setActiveConversationId(null);
    setActiveTab("chat");
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={hideDrawer}
      variant="temporary"
      sx={{
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          {t("aiAssistant.drawerTitle")}
        </Typography>
        <IconButton onClick={hideDrawer} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab label={t("aiAssistant.chatTab")} value="chat" />
          <Tab label={t("aiAssistant.historyTab")} value="history" />
        </Tabs>
      </Box>

      {/* Tab content */}
      <Box sx={{ flexGrow: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "chat" ? (
          <AIAssistantChat />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Box sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}>
              <Button
                startIcon={<AddIcon />}
                onClick={handleNewConversation}
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
    </Drawer>
  );
}

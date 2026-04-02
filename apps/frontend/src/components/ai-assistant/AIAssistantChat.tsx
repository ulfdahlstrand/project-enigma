import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SendIcon from "@mui/icons-material/Send";
import { DiffReviewDialog, renderTextDiffReview, type TextDiffReviewValue } from "./DiffReviewDialog";
import type { AIToolContext, AIToolRegistry } from "../../lib/ai-tools/types";
import { MessageBubble } from "./AIAssistantMessageBubble";
import { useAIAssistantChat } from "../../hooks/useAIAssistantChat";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AIAssistantChatProps {
  toolRegistry?: AIToolRegistry | null;
  toolContext?: AIToolContext | null;
  showApplyChanges?: boolean;
  autoStartMessage?: string | null | undefined;
  automation?: { key: string; message: string } | null | undefined;
  guardrail?: { isSatisfied: boolean; reminderMessage: string } | null;
}

// ---------------------------------------------------------------------------
// ToolingNotice
// ---------------------------------------------------------------------------

function ToolingNotice({
  toolRegistry,
  toolContext,
  isAnalysing,
}: {
  toolRegistry: AIToolRegistry | null;
  toolContext: AIToolContext | null;
  isAnalysing: boolean;
}) {
  const { t } = useTranslation("common");

  if (!toolRegistry || toolRegistry.tools.length === 0 || !toolContext) {
    return null;
  }

  return (
    <Box
      sx={{
        px: 2,
        py: 1.25,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {isAnalysing && (
        <Typography variant="caption" sx={{ display: "block", color: "warning.main", mb: 0.5 }}>
          {t("aiAssistant.analysisInProgress")}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {t("aiAssistant.toolsContext", {
          count: toolRegistry.tools.length,
          entityType: toolContext.entityType,
        })}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AIAssistantChat
// ---------------------------------------------------------------------------

export function AIAssistantChat({
  toolRegistry: toolRegistryProp,
  toolContext: toolContextProp,
  showApplyChanges = true,
  autoStartMessage = null,
  automation = null,
  guardrail = null,
}: AIAssistantChatProps = {}) {
  const { t } = useTranslation("common");
  const chat = useAIAssistantChat({
    toolRegistry: toolRegistryProp,
    toolContext: toolContextProp,
    autoStartMessage,
    automation,
    guardrail,
  });

  if (chat.createConversation.isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {t("aiAssistant.errorCreating")}
      </Alert>
    );
  }

  if (chat.isLoadError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {t("aiAssistant.errorLoading")}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Message list */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", px: 2, pt: 2, pb: 1 }}>
        {chat.isInitialising ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : chat.visibleMessages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", pt: 4 }}>
            {t("aiAssistant.emptyConversation")}
          </Typography>
        ) : (
          chat.visibleMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {chat.sendMessage.isPending && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1.5 }}>
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CircularProgress size={16} />
            </Box>
          </Box>
        )}
        {chat.sendMessage.isError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {t("aiAssistant.errorSending")}
          </Alert>
        )}
        <div ref={chat.messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box sx={{ px: 2, pb: 2, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder={t("aiAssistant.inputPlaceholder")}
            value={chat.inputValue}
            onChange={(e) => chat.setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chat.handleSend(chat.inputValue);
                chat.setInputValue("");
              }
            }}
            disabled={chat.isInitialising || chat.sendMessage.isPending}
          />
          <IconButton
            color="primary"
            onClick={() => {
              chat.handleSend(chat.inputValue);
              chat.setInputValue("");
            }}
            disabled={!chat.inputValue.trim() || chat.isInitialising || chat.sendMessage.isPending}
            aria-label={t("aiAssistant.sendButton")}
          >
            <SendIcon />
          </IconButton>
        </Box>
        {showApplyChanges && (
          <Button
            fullWidth
            variant="contained"
            color="success"
            sx={{ mt: 1.5 }}
            disabled={!chat.latestSuggestion || chat.isInitialising}
            onClick={chat.handleApplyClick}
          >
            {t("aiAssistant.applyChanges")}
          </Button>
        )}
      </Box>

      <ToolingNotice
        toolRegistry={chat.toolRegistry ?? null}
        toolContext={chat.toolContext ?? null}
        isAnalysing={chat.isAnalysing}
      />
      {showApplyChanges && chat.pendingSuggestion && (
        <DiffReviewDialog<TextDiffReviewValue, string>
          open={chat.diffOpen}
          value={chat.pendingSuggestion}
          renderReview={renderTextDiffReview}
          formatResult={(value) => value.suggested}
          onApply={chat.handleDiffApply}
          onKeepEditing={chat.handleDiffKeepEditing}
          onDiscard={chat.handleDiffDiscard}
        />
      )}
    </Box>
  );
}

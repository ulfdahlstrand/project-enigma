import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SendIcon from "@mui/icons-material/Send";
import { useAIAssistantContext } from "../../lib/ai-assistant-context";
import {
  useAIConversation,
  useCreateAIConversation,
  useSendAIMessage,
  useCloseAIConversation,
} from "../../hooks/ai-assistant";
import { DiffReviewDialog } from "./DiffReviewDialog";
import type { AIMessage } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Suggestion parsing
//
// The AI can embed a JSON suggestion block anywhere in its reply:
//   ```json
//   {"type":"suggestion","content":"...improved text..."}
//   ```
// If found, the "Apply changes" button becomes active.
// ---------------------------------------------------------------------------

interface SuggestionPayload {
  type: "suggestion";
  content: string;
}

function extractSuggestion(text: string): string | null {
  const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (!match || !match[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as SuggestionPayload).type === "suggestion" &&
      typeof (parsed as SuggestionPayload).content === "string"
    ) {
      return (parsed as SuggestionPayload).content;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function SuggestionCard({ content }: { content: string }) {
  const { t } = useTranslation("common");
  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
        fontSize: "0.8rem",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontStyle: "italic",
        color: "text.secondary",
      }}
    >
      <Typography variant="caption" sx={{ display: "block", fontWeight: 600, mb: 0.5, fontStyle: "normal", color: "text.primary" }}>
        {t("aiAssistant.suggestion")}
      </Typography>
      {content}
    </Box>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // Render paragraphs without extra margin
        p: ({ children }) => (
          <Typography variant="body2" sx={{ mb: 1, "&:last-child": { mb: 0 } }}>
            {children}
          </Typography>
        ),
        // Intercept code blocks — replace the suggestion JSON with a card
        code: ({ className, children }) => {
          const isJsonBlock = className === "language-json";
          if (isJsonBlock) {
            try {
              const parsed = JSON.parse(String(children).trim()) as unknown;
              if (
                typeof parsed === "object" &&
                parsed !== null &&
                (parsed as SuggestionPayload).type === "suggestion" &&
                typeof (parsed as SuggestionPayload).content === "string"
              ) {
                return <SuggestionCard content={(parsed as SuggestionPayload).content} />;
              }
            } catch {
              // not a suggestion block — fall through to plain code
            }
          }
          return (
            <Box
              component="code"
              sx={{
                px: 0.5,
                borderRadius: 0.5,
                bgcolor: "action.hover",
                fontFamily: "monospace",
                fontSize: "0.8em",
              }}
            >
              {children}
            </Box>
          );
        },
        pre: ({ children }) => <Box component="pre" sx={{ m: 0 }}>{children}</Box>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: "80%",
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser ? "primary.main" : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: isUser ? "none" : "1px solid",
          borderColor: "divider",
          fontSize: "0.875rem",
          wordBreak: "break-word",
        }}
      >
        {isUser ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
        ) : (
          <AssistantMessageContent content={message.content} />
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Chat component
// ---------------------------------------------------------------------------

export function AIAssistantChat() {
  const { t } = useTranslation("common");
  const {
    entityType,
    entityId,
    systemPrompt,
    conversationTitle,
    kickoffMessage,
    originalContent,
    activeConversationId,
    pendingSuggestion,
    setActiveConversationId,
    setPendingSuggestion,
    applyAndClose,
    closeAssistant,
  } = useAIAssistantContext();

  const [inputValue, setInputValue] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const createInitiated = useRef(false);

  const { data: conversation, isError: isLoadError } = useAIConversation(activeConversationId);
  const createConversation = useCreateAIConversation();
  const sendMessage = useSendAIMessage(activeConversationId);
  const closeConversation = useCloseAIConversation(entityType, entityId);

  const messages = conversation?.messages ?? [];

  // Find the latest suggestion from assistant messages
  const latestAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const latestSuggestion = latestAssistantMsg ? extractSuggestion(latestAssistantMsg.content) : null;

  // Auto-create a conversation when there is no active one.
  // Runs on mount AND whenever activeConversationId becomes null (e.g. "New conversation").
  // Guards:
  // 1. The ref prevents a second mutateAsync call in React Strict Mode (same instance,
  //    effects run twice but ref persists across the simulated unmount/remount).
  // 2. The ref is reset when a conversation becomes active so that a subsequent
  //    null-transition (new conversation) will trigger creation again.
  // 3. mutateAsync is used (not mutate) so the .then() fires even after Strict Mode's
  //    simulated unmount destroys the mutation observer.
  useEffect(() => {
    if (activeConversationId !== null) {
      createInitiated.current = false;
      return;
    }
    if (createInitiated.current) return;
    if (entityType && entityId && systemPrompt) {
      createInitiated.current = true;
      void createConversation
        .mutateAsync({
          entityType,
          entityId,
          systemPrompt,
          ...(kickoffMessage !== null && { kickoffMessage }),
        })
        .then((conv) => {
          setActiveConversationId(conv.id);
        })
        .catch(() => {
          // Error surfaced via createConversation.isError
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !activeConversationId || sendMessage.isPending) return;
    setInputValue("");
    sendMessage.mutate({ conversationId: activeConversationId, userMessage: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyClick = () => {
    if (latestSuggestion) {
      setPendingSuggestion({ original: originalContent ?? "", suggested: latestSuggestion });
      setDiffOpen(true);
    }
  };

  const handleDiffApply = () => {
    if (pendingSuggestion) {
      if (activeConversationId) {
        closeConversation.mutate({ conversationId: activeConversationId });
      }
      applyAndClose(pendingSuggestion.suggested);
    }
    setDiffOpen(false);
  };

  const handleDiffKeepEditing = () => {
    setDiffOpen(false);
  };

  const handleDiffDiscard = () => {
    setDiffOpen(false);
    setPendingSuggestion(null);
    if (activeConversationId) {
      closeConversation.mutate({ conversationId: activeConversationId });
    }
    closeAssistant();
  };

  if (createConversation.isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {t("aiAssistant.errorCreating")}
      </Alert>
    );
  }

  if (isLoadError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {t("aiAssistant.errorLoading")}
      </Alert>
    );
  }

  const isInitialising = !activeConversationId;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Message list */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", px: 2, pt: 2, pb: 1 }}>
        {isInitialising ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", pt: 4 }}>
            {t("aiAssistant.emptyConversation")}
          </Typography>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {sendMessage.isPending && (
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
        {sendMessage.isError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {t("aiAssistant.errorSending")}
          </Alert>
        )}
        <div ref={messagesEndRef} />
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isInitialising || sendMessage.isPending}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!inputValue.trim() || isInitialising || sendMessage.isPending}
            aria-label={t("aiAssistant.sendButton")}
          >
            <SendIcon />
          </IconButton>
        </Box>

        {/* Apply changes button — active when AI has a suggestion */}
        <Button
          fullWidth
          variant="contained"
          color="success"
          sx={{ mt: 1.5 }}
          disabled={!latestSuggestion || isInitialising}
          onClick={handleApplyClick}
        >
          {t("aiAssistant.applyChanges")}
        </Button>
      </Box>

      {/* Diff review dialog */}
      {pendingSuggestion && (
        <DiffReviewDialog
          open={diffOpen}
          original={pendingSuggestion.original}
          suggested={pendingSuggestion.suggested}
          onApply={handleDiffApply}
          onKeepEditing={handleDiffKeepEditing}
          onDiscard={handleDiffDiscard}
        />
      )}
    </Box>
  );
}

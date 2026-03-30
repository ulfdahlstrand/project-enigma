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
import { executeAIToolCall } from "../../lib/ai-tools/runtime";
import type { AIToolContext, AIToolRegistry } from "../../lib/ai-tools/types";

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

interface ToolCallPayload {
  type: "tool_call";
  toolName: string;
  input?: unknown;
}

interface ToolResultPayload {
  type: "tool_result";
  toolName: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}

const MAX_TOOL_RESULT_MESSAGE_LENGTH = 9000;
const MAX_TOOL_STRING_LENGTH = 500;
const MAX_TOOL_ARRAY_ITEMS = 12;
const MAX_TOOL_OBJECT_KEYS = 20;
const INTERNAL_GUARDRAIL_PREFIX = "[[internal_guardrail]]";
const INTERNAL_AUTOSTART_PREFIX = "[[internal_autostart]]";

function extractJsonBlocks(text: string): unknown[] {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)\s*```/g)];

  return matches.flatMap((match) => {
    const block = match[1];
    if (!block) return [];

    try {
      return [JSON.parse(block.trim()) as unknown];
    } catch {
      return [];
    }
  });
}

function extractToolCalls(text: string): ToolCallPayload[] {
  return extractJsonBlocks(text).flatMap((parsed) => {
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as ToolCallPayload).type === "tool_call" &&
      typeof (parsed as ToolCallPayload).toolName === "string"
    ) {
      return [parsed as ToolCallPayload];
    }

    return [];
  });
}

function extractToolResult(text: string): ToolResultPayload | null {
  for (const parsed of extractJsonBlocks(text)) {
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as ToolResultPayload).type === "tool_result" &&
      typeof (parsed as ToolResultPayload).toolName === "string" &&
      typeof (parsed as ToolResultPayload).ok === "boolean"
    ) {
      return parsed as ToolResultPayload;
    }
  }

  return null;
}

function isToolResultMessage(text: string): boolean {
  return extractToolResult(text) !== null;
}

function isInternalGuardrailMessage(text: string): boolean {
  return text.startsWith(INTERNAL_GUARDRAIL_PREFIX);
}

function isInternalAutoStartMessage(text: string): boolean {
  return text.startsWith(INTERNAL_AUTOSTART_PREFIX);
}

function stripToolBlocks(text: string): string {
  return text
    .replace(/```json\s*([\s\S]*?)\s*```/g, (block, jsonContent) => {
      try {
        const parsed = JSON.parse(String(jsonContent).trim()) as unknown;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          (((parsed as ToolCallPayload).type === "tool_call") ||
            ((parsed as ToolResultPayload).type === "tool_result"))
        ) {
          return "";
        }
      } catch {
        return block;
      }

      return block;
    })
    .trim();
}

function compactToolValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    if (value.length <= MAX_TOOL_STRING_LENGTH) {
      return value;
    }

    return `${value.slice(0, MAX_TOOL_STRING_LENGTH)}…`;
  }

  if (Array.isArray(value)) {
    const compactedItems = value
      .slice(0, MAX_TOOL_ARRAY_ITEMS)
      .map((item) => compactToolValue(item, depth + 1));

    if (value.length > MAX_TOOL_ARRAY_ITEMS) {
      compactedItems.push(`[${value.length - MAX_TOOL_ARRAY_ITEMS} more items]`);
    }

    return compactedItems;
  }

  if (value && typeof value === "object") {
    if (depth >= 4) {
      return "[truncated object]";
    }

    const entries = Object.entries(value).slice(0, MAX_TOOL_OBJECT_KEYS);
    const compactedEntries = entries.map(([key, nestedValue]) => [key, compactToolValue(nestedValue, depth + 1)]);

    if (Object.keys(value).length > MAX_TOOL_OBJECT_KEYS) {
      compactedEntries.push(["_truncated", true]);
    }

    return Object.fromEntries(compactedEntries);
  }

  return value;
}

function buildToolResultMessage(result: Awaited<ReturnType<typeof executeAIToolCall>>): string {
  const basePayload = {
    type: "tool_result",
    toolName: result.meta.toolName,
    ok: result.ok,
    ...(result.ok ? { output: result.output } : { error: result.error }),
  };

  let payload = basePayload;
  let serialized = JSON.stringify(payload);

  if (serialized.length > MAX_TOOL_RESULT_MESSAGE_LENGTH) {
    payload = {
      type: "tool_result",
      toolName: result.meta.toolName,
      ok: result.ok,
      ...(result.ok ? { output: compactToolValue(result.output) } : { error: result.error }),
    };
    serialized = JSON.stringify(payload);
  }

  if (serialized.length > MAX_TOOL_RESULT_MESSAGE_LENGTH) {
    payload = {
      type: "tool_result",
      toolName: result.meta.toolName,
      ok: result.ok,
      ...(result.ok
        ? { output: "[tool result truncated]" }
        : { error: typeof result.error === "string" ? result.error.slice(0, 300) : "Tool execution failed" }),
    };
    serialized = JSON.stringify(payload);
  }

  return [
    "Tool execution result:",
    "```json",
    serialized,
    "```",
    "Continue the conversation using this result. Do not ask the user to execute the tool manually.",
  ].join("\n");
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

function ToolStatusMessage({ toolName }: { toolName: string }) {
  const { t } = useTranslation("common");

  return (
    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
      {t(`aiAssistant.toolStatus.${toolName}`)}
    </Typography>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  const { t } = useTranslation("common");
  const visibleContent = stripToolBlocks(content);
  const normalizeStatusText = (text: string) => text.trim().toLowerCase().replace(/[.!…]+$/g, "");

  if (!visibleContent) {
    const toolCalls = extractToolCalls(content);
    if (toolCalls.length > 0) {
      return <ToolStatusMessage toolName={toolCalls[0]!.toolName} />;
    }

    return null;
  }

  const redundantToolStatuses = [
    t("aiAssistant.toolStatus.inspect_resume"),
    t("aiAssistant.toolStatus.inspect_revision_plan"),
    t("aiAssistant.toolStatus.list_resume_assignments"),
    t("aiAssistant.toolStatus.inspect_assignment"),
    t("aiAssistant.toolStatus.inspect_resume_section"),
    t("aiAssistant.toolStatus.inspect_resume_sections"),
    t("aiAssistant.toolStatus.inspect_resume_skills"),
    t("aiAssistant.toolStatus.set_revision_work_items"),
    t("aiAssistant.toolStatus.mark_revision_work_item_no_changes_needed"),
    t("aiAssistant.toolStatus.set_assignment_suggestions"),
    t("aiAssistant.toolStatus.set_revision_plan"),
    t("aiAssistant.toolStatus.set_revision_suggestions"),
  ];

  if (redundantToolStatuses.some((status) => normalizeStatusText(status) === normalizeStatusText(visibleContent))) {
    return null;
  }

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
      {visibleContent}
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

interface AIAssistantChatProps {
  toolRegistry?: AIToolRegistry | null;
  toolContext?: AIToolContext | null;
  autoStartMessage?: string | null | undefined;
  automation?: {
    key: string;
    message: string;
  } | null | undefined;
  guardrail?: {
    isSatisfied: boolean;
    reminderMessage: string;
  } | null;
}

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

export function AIAssistantChat({
  toolRegistry: toolRegistryProp,
  toolContext: toolContextProp,
  autoStartMessage = null,
  automation = null,
  guardrail = null,
}: AIAssistantChatProps = {}) {
  const { t } = useTranslation("common");
  const {
    entityType,
    entityId,
    systemPrompt,
    kickoffMessage,
    originalContent,
    toolRegistry: toolRegistryFromContext,
    toolContext: toolContextFromContext,
    activeConversationId,
    pendingSuggestion,
    setActiveConversationId,
    setPendingSuggestion,
    applyAndClose,
    closeAssistant,
  } = useAIAssistantContext();

  const toolRegistry = toolRegistryProp ?? toolRegistryFromContext;
  const toolContext = toolContextProp ?? toolContextFromContext;

  const [inputValue, setInputValue] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const createInitiated = useRef(false);
  const processedToolCallsRef = useRef<Set<string>>(new Set());
  const processedGuardrailMessagesRef = useRef<Set<string>>(new Set());
  const processedAutoStartConversationsRef = useRef<Set<string>>(new Set());
  const processedAutomationKeysRef = useRef<Set<string>>(new Set());
  const [activeToolExecutionCount, setActiveToolExecutionCount] = useState(0);

  const { data: conversation, isError: isLoadError } = useAIConversation(activeConversationId);
  const createConversation = useCreateAIConversation();
  const sendMessage = useSendAIMessage(activeConversationId);
  const closeConversation = useCloseAIConversation(entityType, entityId);

  const messages = conversation?.messages ?? [];
  const visibleMessages = messages.filter(
    (message) =>
      !isToolResultMessage(message.content) &&
      !isInternalGuardrailMessage(message.content) &&
      !isInternalAutoStartMessage(message.content),
  );
  const latestRawAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const hasPendingToolCall = messages.some(
    (message) =>
      message.role === "assistant" &&
      extractToolCalls(message.content).some((_, index) => !processedToolCallsRef.current.has(`${message.id}:${index}:${extractToolCalls(message.content)[index]?.toolName}`)),
  );
  const isAnalysing =
    sendMessage.isPending ||
    activeToolExecutionCount > 0 ||
    Boolean(latestRawAssistantMessage && extractToolCalls(latestRawAssistantMessage.content).length > 0);

  // Find the latest suggestion from assistant messages
  const latestAssistantMsg = [...visibleMessages].reverse().find((m) => m.role === "assistant");
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
  }, [visibleMessages.length]);

  useEffect(() => {
    if (!activeConversationId || !toolRegistry || !toolContext || sendMessage.isPending) {
      return;
    }

    const nextToolCall = [...messages]
      .reverse()
      .flatMap((message) =>
        message.role === "assistant"
          ? extractToolCalls(message.content).map((toolCall, index) => ({
              message,
              toolCall,
              key: `${message.id}:${index}:${toolCall.toolName}`,
            }))
          : [],
      )
      .find(({ key }) => !processedToolCallsRef.current.has(key));

    if (!nextToolCall) {
      return;
    }

    processedToolCallsRef.current.add(nextToolCall.key);

    void (async () => {
      setActiveToolExecutionCount((count) => count + 1);
      try {
        const result = await executeAIToolCall(
          toolRegistry,
          {
            toolName: nextToolCall.toolCall.toolName,
            input: nextToolCall.toolCall.input ?? {},
          },
          toolContext,
        );

        await sendMessage.mutateAsync({
          conversationId: activeConversationId,
          userMessage: buildToolResultMessage(result),
        });
      } finally {
        setActiveToolExecutionCount((count) => Math.max(0, count - 1));
      }
    })();
  }, [
    activeConversationId,
    messages,
    sendMessage,
    toolContext,
    toolRegistry,
  ]);

  useEffect(() => {
    if (
      !autoStartMessage ||
      !activeConversationId ||
      sendMessage.isPending ||
      activeToolExecutionCount > 0 ||
      processedAutoStartConversationsRef.current.has(activeConversationId)
    ) {
      return;
    }

    const hasUserMessages = messages.some((message) => message.role === "user");
    if (hasUserMessages) {
      return;
    }

    processedAutoStartConversationsRef.current.add(activeConversationId);

    void sendMessage.mutateAsync({
      conversationId: activeConversationId,
      userMessage: `${INTERNAL_AUTOSTART_PREFIX} ${autoStartMessage}`,
    });
  }, [
    activeConversationId,
    activeToolExecutionCount,
    autoStartMessage,
    messages,
    sendMessage,
  ]);

  useEffect(() => {
    if (
      !automation ||
      !activeConversationId ||
      sendMessage.isPending ||
      hasPendingToolCall ||
      activeToolExecutionCount > 0
    ) {
      return;
    }

    const scopedKey = `${activeConversationId}:${automation.key}`;
    if (processedAutomationKeysRef.current.has(scopedKey)) {
      return;
    }

    processedAutomationKeysRef.current.add(scopedKey);

    void sendMessage.mutateAsync({
      conversationId: activeConversationId,
      userMessage: `${INTERNAL_AUTOSTART_PREFIX} ${automation.message}`,
    });
  }, [
    activeConversationId,
    activeToolExecutionCount,
    automation,
    hasPendingToolCall,
    sendMessage,
  ]);

  useEffect(() => {
    if (
      !guardrail ||
      guardrail.isSatisfied ||
      !activeConversationId ||
      !latestRawAssistantMessage ||
      !latestUserMessage ||
      hasPendingToolCall ||
      activeToolExecutionCount > 0 ||
      isInternalGuardrailMessage(latestUserMessage.content) ||
      sendMessage.isPending
    ) {
      return;
    }

    if (processedGuardrailMessagesRef.current.has(latestRawAssistantMessage.id)) {
      return;
    }

    if (extractToolCalls(latestRawAssistantMessage.content).length > 0) {
      return;
    }

    processedGuardrailMessagesRef.current.add(latestRawAssistantMessage.id);

    void sendMessage.mutateAsync({
      conversationId: activeConversationId,
      userMessage: `${INTERNAL_GUARDRAIL_PREFIX} ${guardrail.reminderMessage}`,
    });
  }, [
    activeConversationId,
    activeToolExecutionCount,
    guardrail,
    latestRawAssistantMessage,
    latestUserMessage,
    sendMessage,
  ]);

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
        ) : visibleMessages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", pt: 4 }}>
            {t("aiAssistant.emptyConversation")}
          </Typography>
        ) : (
          visibleMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
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

      <ToolingNotice toolRegistry={toolRegistry} toolContext={toolContext} isAnalysing={isAnalysing} />

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

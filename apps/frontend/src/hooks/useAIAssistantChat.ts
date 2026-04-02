import { useState, useRef, useEffect } from "react";
import {
  useAIConversation,
  useCreateAIConversation,
  useSendAIMessage,
  useCloseAIConversation,
} from "./ai-assistant";
import { executeAIToolCall } from "../lib/ai-tools/runtime";
import type { AIToolContext, AIToolRegistry } from "../lib/ai-tools/types";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import {
  buildToolResultMessage,
  extractToolCalls,
  extractSuggestion,
  isToolResultMessage,
  isInternalGuardrailMessage,
  isInternalAutoStartMessage,
} from "../components/ai-assistant/ai-message-parsing";

export interface UseAIAssistantChatOptions {
  toolRegistry?: AIToolRegistry | null | undefined;
  toolContext?: AIToolContext | null | undefined;
}

export function useAIAssistantChat({
  toolRegistry: toolRegistryProp,
  toolContext: toolContextProp,
}: UseAIAssistantChatOptions = {}) {
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
  const [activeToolExecutionCount, setActiveToolExecutionCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const createInitiated = useRef(false);
  const processedToolCallsRef = useRef<Set<string>>(new Set());

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
      extractToolCalls(message.content).some(
        (_, index) =>
          !processedToolCallsRef.current.has(
            `${message.id}:${index}:${extractToolCalls(message.content)[index]?.toolName}`,
          ),
      ),
  );
  const isAnalysing =
    sendMessage.isPending ||
    activeToolExecutionCount > 0 ||
    Boolean(latestRawAssistantMessage && extractToolCalls(latestRawAssistantMessage.content).length > 0);
  const latestAssistantMsg = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const latestSuggestion = latestAssistantMsg ? extractSuggestion(latestAssistantMsg.content) : null;

  // Auto-create conversation
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
    const target = messagesEndRef.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, [visibleMessages.length]);

  // Process tool calls
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

    if (!nextToolCall) return;

    processedToolCallsRef.current.add(nextToolCall.key);

    void (async () => {
      setActiveToolExecutionCount((count) => count + 1);
      try {
        const result = await executeAIToolCall(
          toolRegistry,
          { toolName: nextToolCall.toolCall.toolName, input: nextToolCall.toolCall.input ?? {} },
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
  }, [activeConversationId, messages, sendMessage, toolContext, toolRegistry]);

  // Handlers
  const handleSend = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !activeConversationId || sendMessage.isPending) return;
    sendMessage.mutate({ conversationId: activeConversationId, userMessage: trimmed });
  };

  const handleApplyClick = () => {
    if (latestSuggestion) {
      setPendingSuggestion({ original: originalContent ?? "", suggested: latestSuggestion });
      setDiffOpen(true);
    }
  };

  const handleDiffApply = (suggested: string) => {
    if (pendingSuggestion) {
      if (activeConversationId) {
        closeConversation.mutate({ conversationId: activeConversationId });
      }
      applyAndClose(suggested);
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

  return {
    toolRegistry,
    toolContext,
    inputValue,
    setInputValue,
    diffOpen,
    messagesEndRef,
    visibleMessages,
    isAnalysing,
    isLoadError,
    isInitialising: !activeConversationId,
    latestSuggestion,
    pendingSuggestion,
    sendMessage,
    createConversation,
    handleSend,
    handleApplyClick,
    handleDiffApply,
    handleDiffKeepEditing,
    handleDiffDiscard,
  };
}

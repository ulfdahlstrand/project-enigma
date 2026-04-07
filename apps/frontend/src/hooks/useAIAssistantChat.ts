import { useState, useRef, useEffect } from "react";
import {
  useAIConversation,
  useCreateAIConversation,
  useSendAIMessage,
  useCloseAIConversation,
} from "./ai-assistant";
import type { AIToolContext, AIToolRegistry } from "../lib/ai-tools/types";
import { useAIAssistantContext } from "../lib/ai-assistant-context";
import {
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
    isOpen,
    entityType,
    entityId,
    systemPrompt,
    kickoffMessage,
    autoStartMessage,
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

  const { data: conversation, isError: isLoadError } = useAIConversation(activeConversationId, {
    pollingEnabled: isOpen,
  });
  const createConversation = useCreateAIConversation();
  const sendMessage = useSendAIMessage(activeConversationId);
  const closeConversation = useCloseAIConversation(entityType, entityId);

  const messages = conversation?.messages ?? [];
  const isConversationClosed = conversation?.isClosed ?? false;
  const visibleMessages = messages.filter(
    (message) =>
      !isToolResultMessage(message.content) &&
      !isInternalGuardrailMessage(message.content) &&
      !isInternalAutoStartMessage(message.content),
  );
  const isAnalysing =
    sendMessage.isPending;
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
          ...(autoStartMessage !== null && { autoStartMessage }),
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

  // Handlers
  const handleSend = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !activeConversationId || sendMessage.isPending || isConversationClosed) return;
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
    conversation,
    isConversationClosed,
    handleSend,
    handleApplyClick,
    handleDiffApply,
    handleDiffKeepEditing,
    handleDiffDiscard,
  };
}

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { AIToolContext, AIToolRegistry } from "./ai-tools/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingSuggestion {
  /** The original text before AI changes. */
  original: string;
  /** The AI-suggested replacement text. */
  suggested: string;
}

export interface OpenAssistantOptions {
  entityType: string;
  entityId: string;
  systemPrompt: string;
  /** Short label stored on the conversation and shown in the history list (2–4 words). */
  title?: string;
  /** Hidden message sent to the AI on creation to trigger an opening greeting. Not shown in the UI. */
  kickoffMessage?: string;
  /** The original content being edited — shown as "before" in the diff dialog. */
  originalContent?: string;
  /** Optional tool registry available to the active AI chat session. */
  toolRegistry?: AIToolRegistry;
  /** Explicit execution context for any registered tools. */
  toolContext?: AIToolContext;
  /** Reopen a specific existing conversation instead of auto-creating one. */
  initialConversationId?: string | null | undefined;
  /** Called with the suggested text when the user clicks Apply in the diff dialog. */
  onAccept: (suggested: string) => void;
}

interface AIAssistantState {
  isOpen: boolean;
  entityType: string | null;
  entityId: string | null;
  systemPrompt: string | null;
  conversationTitle: string | null;
  kickoffMessage: string | null;
  originalContent: string | null;
  toolRegistry: AIToolRegistry | null;
  toolContext: AIToolContext | null;
  activeConversationId: string | null;
  pendingSuggestion: PendingSuggestion | null;
  onAccept: ((suggested: string) => void) | null;
}

interface AIAssistantContextValue extends AIAssistantState {
  openAssistant: (options: OpenAssistantOptions) => void;
  /** Full reset — clears entity, conversation, and suggestions. */
  closeAssistant: () => void;
  /** Just hides the drawer without resetting state so the conversation can be resumed. */
  hideDrawer: () => void;
  setActiveConversationId: (id: string | null) => void;
  /** Select a conversation from history — sets the ID and clears conversationTitle so the
   *  frontend placeholder doesn't bleed onto historical conversations with no DB title. */
  selectHistoryConversation: (id: string) => void;
  setPendingSuggestion: (suggestion: PendingSuggestion | null) => void;
  applyAndClose: (suggested: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AIAssistantContext = createContext<AIAssistantContextValue | null>(null);

const INITIAL_STATE: AIAssistantState = {
  isOpen: false,
  entityType: null,
  entityId: null,
  systemPrompt: null,
  conversationTitle: null,
  kickoffMessage: null,
  originalContent: null,
  toolRegistry: null,
  toolContext: null,
  activeConversationId: null,
  pendingSuggestion: null,
  onAccept: null,
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AIAssistantState>(INITIAL_STATE);

  const openAssistant = useCallback((options: OpenAssistantOptions) => {
    setState({
      isOpen: true,
      entityType: options.entityType,
      entityId: options.entityId,
      systemPrompt: options.systemPrompt,
      conversationTitle: options.title ?? null,
      kickoffMessage: options.kickoffMessage ?? null,
      originalContent: options.originalContent ?? null,
      toolRegistry: options.toolRegistry ?? null,
      toolContext: options.toolContext ?? null,
      activeConversationId: options.initialConversationId ?? null,
      pendingSuggestion: null,
      onAccept: options.onAccept,
    });
  }, []);

  const closeAssistant = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const hideDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const setActiveConversationId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, activeConversationId: id }));
  }, []);

  const selectHistoryConversation = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeConversationId: id, conversationTitle: null }));
  }, []);

  const setPendingSuggestion = useCallback((suggestion: PendingSuggestion | null) => {
    setState((prev) => ({ ...prev, pendingSuggestion: suggestion }));
  }, []);

  const applyAndClose = useCallback((suggested: string) => {
    setState((prev) => {
      prev.onAccept?.(suggested);
      return INITIAL_STATE;
    });
  }, []);

  return (
    <AIAssistantContext.Provider
      value={{
        ...state,
        openAssistant,
        closeAssistant,
        hideDrawer,
        setActiveConversationId,
        selectHistoryConversation,
        setPendingSuggestion,
        applyAndClose,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAIAssistantContext(): AIAssistantContextValue {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) {
    throw new Error("useAIAssistantContext must be used within AIAssistantProvider");
  }
  return ctx;
}

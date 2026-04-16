import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore } from "zustand";
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
  /** Hidden autostart instruction sent right after conversation creation. */
  autoStartMessage?: string;
  /** The original content being edited — shown as "before" in the diff dialog. */
  originalContent?: string;
  /** Optional tool registry available to the active AI chat session. */
  toolRegistry?: AIToolRegistry;
  /** Explicit execution context for any registered tools. */
  toolContext?: AIToolContext;
  /** Reopen a specific existing conversation instead of auto-creating one. */
  initialConversationId?: string | null | undefined;
  /** Called with the suggested text when the user clicks Apply in the diff dialog.
   *  Omit when the assistant is opened in revision mode (suggestions are applied per-item). */
  onAccept?: (suggested: string) => void;
}

interface AIAssistantState {
  isOpen: boolean;
  entityType: string | null;
  entityId: string | null;
  systemPrompt: string | null;
  conversationTitle: string | null;
  kickoffMessage: string | null;
  autoStartMessage: string | null;
  originalContent: string | null;
  toolRegistry: AIToolRegistry | null;
  toolContext: AIToolContext | null;
  activeConversationId: string | null;
  pendingSuggestion: PendingSuggestion | null;
  onAccept: ((suggested: string) => void) | null;
}

interface AIAssistantActions {
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

export type AIAssistantStoreState = AIAssistantState & AIAssistantActions;

// Back-compat: existing consumers import `AIAssistantContextValue` shape implicitly
// via the return type of `useAIAssistantContext()`. The store state is the same shape.

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL_STATE: AIAssistantState = {
  isOpen: false,
  entityType: null,
  entityId: null,
  systemPrompt: null,
  conversationTitle: null,
  kickoffMessage: null,
  autoStartMessage: null,
  originalContent: null,
  toolRegistry: null,
  toolContext: null,
  activeConversationId: null,
  pendingSuggestion: null,
  onAccept: null,
};

function createAIAssistantStore() {
  return createStore<AIAssistantStoreState>((set, get) => ({
    ...INITIAL_STATE,

    openAssistant: (options) => {
      set({
        isOpen: true,
        entityType: options.entityType,
        entityId: options.entityId,
        systemPrompt: options.systemPrompt,
        conversationTitle: options.title ?? null,
        kickoffMessage: options.kickoffMessage ?? null,
        autoStartMessage: options.autoStartMessage ?? null,
        originalContent: options.originalContent ?? null,
        toolRegistry: options.toolRegistry ?? null,
        toolContext: options.toolContext ?? null,
        activeConversationId: options.initialConversationId ?? null,
        pendingSuggestion: null,
        onAccept: options.onAccept ?? null,
      });
    },

    closeAssistant: () => {
      set({ ...INITIAL_STATE });
    },

    hideDrawer: () => {
      set({ isOpen: false });
    },

    setActiveConversationId: (id) => {
      set({ activeConversationId: id });
    },

    selectHistoryConversation: (id) => {
      set({ activeConversationId: id, conversationTitle: null });
    },

    setPendingSuggestion: (suggestion) => {
      set({ pendingSuggestion: suggestion });
    },

    applyAndClose: (suggested) => {
      const { onAccept } = get();
      onAccept?.(suggested);
      set({ ...INITIAL_STATE });
    },
  }));
}

type AIAssistantStore = ReturnType<typeof createAIAssistantStore>;

// ---------------------------------------------------------------------------
// Provider (store-in-context pattern preserves per-tree isolation for tests)
// ---------------------------------------------------------------------------

const AIAssistantStoreContext = createContext<AIAssistantStore | null>(null);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AIAssistantStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAIAssistantStore();
  }
  return (
    <AIAssistantStoreContext.Provider value={storeRef.current}>
      {children}
    </AIAssistantStoreContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useAIAssistantStoreInstance(): AIAssistantStore {
  const store = useContext(AIAssistantStoreContext);
  if (!store) {
    throw new Error("useAIAssistantContext must be used within AIAssistantProvider");
  }
  return store;
}

/**
 * Subscribe to the entire AI assistant state + actions. Re-renders on any
 * change. For finer-grained subscriptions, use `useAIAssistantStore(selector)`.
 */
export function useAIAssistantContext(): AIAssistantStoreState {
  const store = useAIAssistantStoreInstance();
  return useStore(store);
}

/**
 * Subscribe to a specific slice of AI assistant state. Re-renders only when
 * the selected value changes (referentially).
 */
export function useAIAssistantStore<T>(selector: (state: AIAssistantStoreState) => T): T {
  const store = useAIAssistantStoreInstance();
  return useStore(store, selector);
}

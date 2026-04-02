import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAIAssistantChat } from "../useAIAssistantChat";

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
};

let mockContext: {
  entityType: string | null;
  entityId: string | null;
  systemPrompt: string | null;
  kickoffMessage: string | null;
  originalContent: string | null;
  toolRegistry: unknown;
  toolContext: unknown;
  activeConversationId: string | null;
  pendingSuggestion: { original: string; suggested: string } | null;
  setActiveConversationId: ReturnType<typeof vi.fn>;
  setPendingSuggestion: ReturnType<typeof vi.fn>;
  applyAndClose: ReturnType<typeof vi.fn>;
  closeAssistant: ReturnType<typeof vi.fn>;
};

let mockConversation: { messages: Message[] } | undefined;

const mockCreateConversation = {
  mutateAsync: vi.fn(),
  isError: false,
  isPending: false,
};

const mockSendMessage = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
};

const mockCloseConversation = {
  mutate: vi.fn(),
  isPending: false,
};

const mockExecuteAIToolCall = vi.fn();

vi.mock("../ai-assistant", () => ({
  useAIConversation: () => ({
    data: mockConversation,
    isError: false,
  }),
  useCreateAIConversation: () => mockCreateConversation,
  useSendAIMessage: () => mockSendMessage,
  useCloseAIConversation: () => mockCloseConversation,
}));

vi.mock("../../lib/ai-assistant-context", () => ({
  useAIAssistantContext: () => mockContext,
}));

vi.mock("../../lib/ai-tools/runtime", () => ({
  executeAIToolCall: (...args: unknown[]) => mockExecuteAIToolCall(...args),
}));

function buildToolCallMessage(toolName = "inspect_resume") {
  return {
    id: "assistant-tool-call",
    role: "assistant" as const,
    content: `\`\`\`json
{"type":"tool_call","toolName":"${toolName}","input":{"includeAssignments":true}}
\`\`\``,
  };
}

function buildSuggestionMessage(content = "Improved text") {
  return {
    id: "assistant-suggestion",
    role: "assistant" as const,
    content: `\`\`\`json
{"type":"suggestion","content":"${content}"}
\`\`\``,
  };
}

describe("useAIAssistantChat", () => {
  beforeEach(() => {
    mockConversation = undefined;
    mockCreateConversation.mutateAsync.mockReset();
    mockCreateConversation.mutateAsync.mockResolvedValue({
      id: "conv-1",
      entityType: "resume",
      entityId: "resume-1",
    });

    mockSendMessage.mutate.mockReset();
    mockSendMessage.mutateAsync.mockReset();
    mockSendMessage.mutateAsync.mockResolvedValue({
      id: "assistant-2",
      role: "assistant",
      content: "ok",
    });
    mockSendMessage.isPending = false;
    mockSendMessage.isError = false;

    mockCloseConversation.mutate.mockReset();
    mockExecuteAIToolCall.mockReset();
    mockExecuteAIToolCall.mockResolvedValue({
      ok: true,
      output: { inspected: true },
      meta: { toolName: "inspect_resume" },
    });

    mockContext = {
      entityType: "resume",
      entityId: "resume-1",
      systemPrompt: "You are a helpful assistant.",
      kickoffMessage: "Hello",
      originalContent: "Original resume text",
      toolRegistry: { tools: [] },
      toolContext: { route: "resume", entityType: "resume", entityId: "resume-1" },
      activeConversationId: null,
      pendingSuggestion: null,
      setActiveConversationId: vi.fn((conversationId: string) => {
        mockContext.activeConversationId = conversationId;
      }),
      setPendingSuggestion: vi.fn((suggestion: { original: string; suggested: string } | null) => {
        mockContext.pendingSuggestion = suggestion;
      }),
      applyAndClose: vi.fn(),
      closeAssistant: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("auto-creates a conversation from context when none exists", async () => {
    renderHook(() => useAIAssistantChat());

    await waitFor(() => {
      expect(mockCreateConversation.mutateAsync).toHaveBeenCalledWith({
        entityType: "resume",
        entityId: "resume-1",
        systemPrompt: "You are a helpful assistant.",
        kickoffMessage: "Hello",
      });
    });

    expect(mockContext.setActiveConversationId).toHaveBeenCalledWith("conv-1");
  });

  it("executes assistant tool calls and sends back a tool result message", async () => {
    mockContext.activeConversationId = "conv-1";
    mockContext.toolRegistry = { tools: [{ name: "inspect_resume" }] };
    mockConversation = { messages: [buildToolCallMessage()] };

    renderHook(() => useAIAssistantChat());

    await waitFor(() => {
      expect(mockExecuteAIToolCall).toHaveBeenCalledWith(
        mockContext.toolRegistry,
        {
          toolName: "inspect_resume",
          input: { includeAssignments: true },
        },
        mockContext.toolContext,
      );
    });

    await waitFor(() => {
      expect(mockSendMessage.mutateAsync).toHaveBeenCalledWith({
        conversationId: "conv-1",
        userMessage: expect.stringContaining('"type":"tool_result"'),
      });
    });
  });

  it("opens diff state from the latest suggestion and applies it through the assistant context", async () => {
    mockContext.activeConversationId = "conv-1";
    mockConversation = { messages: [buildSuggestionMessage("Improved presentation")] };

    const { result } = renderHook(() => useAIAssistantChat());

    act(() => {
      result.current.handleApplyClick();
    });

    expect(mockContext.setPendingSuggestion).toHaveBeenCalledWith({
      original: "Original resume text",
      suggested: "Improved presentation",
    });

    act(() => {
      result.current.handleDiffApply("Improved presentation");
    });

    expect(mockCloseConversation.mutate).toHaveBeenCalledWith({ conversationId: "conv-1" });
    expect(mockContext.applyAndClose).toHaveBeenCalledWith("Improved presentation");
  });
});

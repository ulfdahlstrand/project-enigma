import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export const aiMessageRoleSchema = z.enum(["user", "assistant"]);

export const aiConversationSchema = z.object({
  id: z.string().uuid(),
  createdBy: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  systemPrompt: z.string(),
  title: z.string().nullable(),
  isClosed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const aiMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: aiMessageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
});

export const aiBranchHandoffSchema = z.object({
  branchId: z.string().uuid(),
  branchName: z.string(),
  goal: z.string().nullable(),
});

const aiRevisionSuggestionSkillSchema = z.object({
  name: z.string().min(1),
  level: z.string().nullable().optional(),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

const aiRevisionSuggestionSkillScopeSchema = z.object({
  type: z.enum(["group_order", "group_contents"]),
  category: z.string().min(1).optional(),
});

export const aiRevisionSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.string().min(1),
  assignmentId: z.string().uuid().optional(),
  suggestedText: z.string().min(1),
  skills: z.array(aiRevisionSuggestionSkillSchema).optional(),
  skillScope: aiRevisionSuggestionSkillScopeSchema.optional(),
  status: z.enum(["pending", "accepted", "dismissed"]),
});

export const aiRevisionSuggestionsSchema = z.object({
  summary: z.string().min(1),
  suggestions: z.array(aiRevisionSuggestionSchema),
});

export type AIConversation = z.infer<typeof aiConversationSchema>;
export type AIMessage = z.infer<typeof aiMessageSchema>;
export type AIMessageRole = z.infer<typeof aiMessageRoleSchema>;
export type AIBranchHandoff = z.infer<typeof aiBranchHandoffSchema>;
export type AIRevisionSuggestions = z.infer<typeof aiRevisionSuggestionsSchema>;

// ---------------------------------------------------------------------------
// createAIConversation
// ---------------------------------------------------------------------------

export const createAIConversationInputSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  systemPrompt: z.string().default(""),
  /** Short label shown in the conversation history list (2–4 words). */
  title: z.string().max(64).optional(),
  /**
   * If provided, the backend immediately sends this message to OpenAI (without
   * storing it) and saves only the AI's reply as the first message. Useful for
   * generating an opening greeting that acknowledges the user's intent.
   */
  kickoffMessage: z.string().optional(),
  /** Optional hidden autostart instruction executed immediately after creation. */
  autoStartMessage: z.string().optional(),
});

export const createAIConversationOutputSchema = aiConversationSchema;

export type CreateAIConversationInput = z.infer<typeof createAIConversationInputSchema>;
export type CreateAIConversationOutput = z.infer<typeof createAIConversationOutputSchema>;

// ---------------------------------------------------------------------------
// sendAIMessage
// ---------------------------------------------------------------------------

export const sendAIMessageInputSchema = z.object({
  conversationId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
});

export const sendAIMessageOutputSchema = aiMessageSchema.extend({
  /**
   * True when the backend loop exhausted its iteration budget but there are still
   * pending revision work items. The frontend should post a silent continuation
   * message immediately so the workflow progresses without user interaction.
   */
  needsContinuation: z.boolean(),
});

export type SendAIMessageInput = z.infer<typeof sendAIMessageInputSchema>;
export type SendAIMessageOutput = z.infer<typeof sendAIMessageOutputSchema>;

// ---------------------------------------------------------------------------
// getAIConversation
// ---------------------------------------------------------------------------

export const getAIConversationInputSchema = z.object({
  conversationId: z.string().uuid(),
});

export const getAIConversationOutputSchema = aiConversationSchema.extend({
  messages: z.array(aiMessageSchema),
  latestBranchHandoff: aiBranchHandoffSchema.nullable(),
  revisionSuggestions: aiRevisionSuggestionsSchema.nullable(),
});

export type GetAIConversationInput = z.infer<typeof getAIConversationInputSchema>;
export type GetAIConversationOutput = z.infer<typeof getAIConversationOutputSchema>;

// ---------------------------------------------------------------------------
// listAIConversations
// ---------------------------------------------------------------------------

export const listAIConversationsInputSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
});

export const listAIConversationsOutputSchema = z.object({
  conversations: z.array(aiConversationSchema),
});

export type ListAIConversationsInput = z.infer<typeof listAIConversationsInputSchema>;
export type ListAIConversationsOutput = z.infer<typeof listAIConversationsOutputSchema>;

// ---------------------------------------------------------------------------
// closeAIConversation
// ---------------------------------------------------------------------------

export const closeAIConversationInputSchema = z.object({
  conversationId: z.string().uuid(),
});

export const closeAIConversationOutputSchema = z.object({
  success: z.boolean(),
});

export type CloseAIConversationInput = z.infer<typeof closeAIConversationInputSchema>;
export type CloseAIConversationOutput = z.infer<typeof closeAIConversationOutputSchema>;

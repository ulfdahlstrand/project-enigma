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

export type AIConversation = z.infer<typeof aiConversationSchema>;
export type AIMessage = z.infer<typeof aiMessageSchema>;
export type AIMessageRole = z.infer<typeof aiMessageRoleSchema>;

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

export const sendAIMessageOutputSchema = aiMessageSchema;

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

import { oc } from "@orpc/contract";
import {
  improveDescriptionInputSchema,
  improveDescriptionOutputSchema,
} from "../../ai.js";
import {
  createAIConversationInputSchema,
  createAIConversationOutputSchema,
  sendAIMessageInputSchema,
  sendAIMessageOutputSchema,
  getAIConversationInputSchema,
  getAIConversationOutputSchema,
  listAIConversationsInputSchema,
  listAIConversationsOutputSchema,
  closeAIConversationInputSchema,
  closeAIConversationOutputSchema,
  resolveRevisionSuggestionInputSchema,
  resolveRevisionSuggestionOutputSchema,
} from "../../ai-conversations.js";

export const aiRoutes = {
  improveDescription: oc
    .route({ method: "POST", path: "/ai/improve-description" })
    .input(improveDescriptionInputSchema)
    .output(improveDescriptionOutputSchema),
  createAIConversation: oc
    .route({ method: "POST", path: "/ai/conversations" })
    .input(createAIConversationInputSchema)
    .output(createAIConversationOutputSchema),
  sendAIMessage: oc
    .route({ method: "POST", path: "/ai/conversations/{conversationId}/messages" })
    .input(sendAIMessageInputSchema)
    .output(sendAIMessageOutputSchema),
  getAIConversation: oc
    .route({ method: "GET", path: "/ai/conversations/{conversationId}" })
    .input(getAIConversationInputSchema)
    .output(getAIConversationOutputSchema),
  listAIConversations: oc
    .route({ method: "GET", path: "/ai/conversations" })
    .input(listAIConversationsInputSchema)
    .output(listAIConversationsOutputSchema),
  closeAIConversation: oc
    .route({ method: "POST", path: "/ai/conversations/{conversationId}/close" })
    .input(closeAIConversationInputSchema)
    .output(closeAIConversationOutputSchema),
  resolveRevisionSuggestion: oc
    .route({ method: "PATCH", path: "/ai/conversations/{conversationId}/suggestions/{suggestionId}" })
    .input(resolveRevisionSuggestionInputSchema)
    .output(resolveRevisionSuggestionOutputSchema),
};

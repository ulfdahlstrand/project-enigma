import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../orpc-client";
import { INTERNAL_AUTOSTART_PREFIX } from "../components/ai-assistant/ai-message-parsing";

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const aiConversationKey = (conversationId: string) =>
  ["getAIConversation", conversationId] as const;

export const aiConversationsKey = (entityType: string, entityId: string) =>
  ["listAIConversations", entityType, entityId] as const;

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useAIConversation(conversationId: string | null) {
  return useQuery({
    queryKey: aiConversationKey(conversationId ?? ""),
    queryFn: () => orpc.getAIConversation({ conversationId: conversationId! }),
    enabled: Boolean(conversationId),
    refetchInterval: conversationId ? 1500 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

export function useAIConversations(entityType: string | null, entityId: string | null) {
  return useQuery({
    queryKey: aiConversationsKey(entityType ?? "", entityId ?? ""),
    queryFn: () =>
      orpc.listAIConversations({
        entityType: entityType!,
        entityId: entityId!,
      }),
    enabled: Boolean(entityType) && Boolean(entityId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateAIConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityType: string; entityId: string; systemPrompt: string; title?: string; kickoffMessage?: string }) =>
      orpc.createAIConversation(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: aiConversationsKey(data.entityType, data.entityId),
      });
    },
  });
}

const MAX_AUTO_CONTINUATIONS = 30;

export function useSendAIMessage(conversationId: string | null) {
  const queryClient = useQueryClient();

  const continuePendingWorkItems = async (cid: string, depth: number): Promise<void> => {
    if (depth >= MAX_AUTO_CONTINUATIONS) return;
    const result = await orpc.sendAIMessage({
      conversationId: cid,
      userMessage: `${INTERNAL_AUTOSTART_PREFIX} Continue processing the next pending revision work item.`,
    });
    void queryClient.invalidateQueries({ queryKey: aiConversationKey(cid) });
    if (result.needsContinuation) {
      await continuePendingWorkItems(cid, depth + 1);
    }
  };

  return useMutation({
    mutationFn: (input: { conversationId: string; userMessage: string }) =>
      orpc.sendAIMessage(input),
    onSuccess: (data, variables) => {
      if (conversationId) {
        void queryClient.invalidateQueries({
          queryKey: aiConversationKey(conversationId),
        });
      }
      if (data.needsContinuation) {
        void continuePendingWorkItems(variables.conversationId, 0);
      }
    },
  });
}

export function useCloseAIConversation(entityType?: string | null, entityId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: string }) =>
      orpc.closeAIConversation(input),
    onSuccess: (_, { conversationId }) => {
      void queryClient.invalidateQueries({
        queryKey: aiConversationKey(conversationId),
      });
      // Refresh the list so the AI-generated title (written async after messages) shows up.
      if (entityType && entityId) {
        void queryClient.invalidateQueries({
          queryKey: aiConversationsKey(entityType, entityId),
        });
      }
    },
  });
}

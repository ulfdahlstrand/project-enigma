import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState, LoadingState } from "../../components/feedback";
import { orpc } from "../../orpc-client";
import { AuthorizationListCard } from "./external-ai/AuthorizationListCard";
import {
  buildApiChallengeInstructions,
  buildMcpChallengeInstructions,
  resolveApiUrls,
} from "./external-ai/challenge-instructions";
import { ChallengeResultAlert, type ChallengeResult, type CopyState } from "./external-ai/ChallengeResultAlert";
import {
  CreateAuthorizationCard,
  DURATION_OPTIONS,
  type DurationOption,
} from "./external-ai/CreateAuthorizationCard";

const CLIENTS_QUERY_KEY = ["external-ai", "clients"] as const;
const AUTHORIZATIONS_QUERY_KEY = ["external-ai", "authorizations"] as const;

export function ExternalAIConnectionsSection() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [selectedClientKey, setSelectedClientKey] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<DurationOption>("8h");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [latestChallenge, setLatestChallenge] = useState<ChallengeResult | null>(null);

  const clientsQuery = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: () => orpc.listExternalAIClients({}),
  });

  const authorizationsQuery = useQuery({
    queryKey: AUTHORIZATIONS_QUERY_KEY,
    queryFn: () => orpc.listExternalAIAuthorizations({}),
  });

  const clientOptions = clientsQuery.data?.clients ?? [];

  useEffect(() => {
    if (!selectedClientKey && clientOptions.length === 1) {
      setSelectedClientKey(clientOptions[0]!.key);
    }
  }, [clientOptions, selectedClientKey]);

  const createAuthorizationMutation = useMutation({
    mutationFn: () =>
      orpc.createExternalAIAuthorization({
        clientKey: selectedClientKey,
        title: title.trim() || null,
        duration,
      }),
    onSuccess: async (response) => {
      setLatestChallenge({
        authorizationId: response.authorizationId,
        challengeId: response.challengeId,
        challengeCode: response.challengeCode,
        challengeExpiresAt: response.challengeExpiresAt,
        authorizationExpiresAt: response.authorizationExpiresAt,
        accessTokenExpiresAt: response.accessTokenExpiresAt,
        scopes: response.scopes,
        clientTitle: response.client.title,
      });
      setCopyState("idle");
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: AUTHORIZATIONS_QUERY_KEY });
    },
  });

  const revokeAuthorizationMutation = useMutation({
    mutationFn: (authorizationId: string) =>
      orpc.revokeExternalAIAuthorization({ authorizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AUTHORIZATIONS_QUERY_KEY });
    },
  });

  const deleteAuthorizationMutation = useMutation({
    mutationFn: (authorizationId: string) =>
      orpc.deleteExternalAIAuthorization({ authorizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AUTHORIZATIONS_QUERY_KEY });
    },
  });

  const activeAuthorizations = useMemo(
    () => authorizationsQuery.data?.authorizations ?? [],
    [authorizationsQuery.data?.authorizations],
  );

  const { resolvedApiUrl, resolvedMcpUrl } = useMemo(() => resolveApiUrls(), []);

  const handleCopyApi = async () => {
    if (!latestChallenge) return;
    try {
      await navigator.clipboard.writeText(
        buildApiChallengeInstructions(latestChallenge, resolvedApiUrl),
      );
      setCopyState("api-success");
    } catch {
      setCopyState("error");
    }
  };

  const handleCopyMcp = async () => {
    if (!latestChallenge) return;
    try {
      await navigator.clipboard.writeText(
        buildMcpChallengeInstructions(latestChallenge, resolvedApiUrl, resolvedMcpUrl),
      );
      setCopyState("mcp-success");
    } catch {
      setCopyState("error");
    }
  };

  if (clientsQuery.isLoading || authorizationsQuery.isLoading) {
    return <LoadingState label={t("externalAIConnections.loading")} />;
  }

  if (clientsQuery.isError || authorizationsQuery.isError) {
    return <ErrorState message={t("externalAIConnections.loadError")} />;
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          {t("externalAIConnections.pageTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("externalAIConnections.pageDescription")}
        </Typography>
      </div>

      <CreateAuthorizationCard
        clientOptions={clientOptions}
        selectedClientKey={selectedClientKey}
        title={title}
        duration={duration}
        isCreating={createAuthorizationMutation.isPending}
        hasError={createAuthorizationMutation.isError}
        onClientKeyChange={setSelectedClientKey}
        onTitleChange={setTitle}
        onDurationChange={setDuration}
        onSubmit={() => createAuthorizationMutation.mutate()}
      />

      {latestChallenge && (
        <ChallengeResultAlert
          challenge={latestChallenge}
          copyState={copyState}
          onCopyApi={() => void handleCopyApi()}
          onCopyMcp={() => void handleCopyMcp()}
        />
      )}

      <AuthorizationListCard
        authorizations={activeAuthorizations}
        isRevoking={revokeAuthorizationMutation.isPending}
        isDeleting={deleteAuthorizationMutation.isPending}
        onRevoke={(id) => revokeAuthorizationMutation.mutate(id)}
        onDelete={(id) => deleteAuthorizationMutation.mutate(id)}
      />
    </Stack>
  );
}

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState, LoadingState } from "../../components/feedback";
import { orpc } from "../../orpc-client";

const rawApiUrl: string = import.meta.env["VITE_API_URL"] ?? "";
const resolvedApiUrl =
  typeof window !== "undefined" && rawApiUrl.startsWith("/")
    ? new URL(rawApiUrl, window.location.origin).toString()
    : rawApiUrl;
const resolvedMcpUrl = resolvedApiUrl
  ? new URL("/mcp", resolvedApiUrl).toString()
  : "";

const CLIENTS_QUERY_KEY = ["external-ai", "clients"] as const;
const AUTHORIZATIONS_QUERY_KEY = ["external-ai", "authorizations"] as const;
const DURATION_OPTIONS = ["1h", "4h", "8h", "1d", "7d"] as const;

export function ExternalAIConnectionsSection() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const [selectedClientKey, setSelectedClientKey] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<(typeof DURATION_OPTIONS)[number]>("8h");
  const [copyState, setCopyState] = useState<"idle" | "api-success" | "mcp-success" | "error">("idle");
  const [latestChallenge, setLatestChallenge] = useState<null | {
    authorizationId: string;
    challengeId: string;
    challengeCode: string;
    challengeExpiresAt: string;
    authorizationExpiresAt: string;
    accessTokenExpiresAt: string;
    scopes: string[];
    clientTitle: string;
  }>(null);

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

  const canCreate = selectedClientKey.trim().length > 0 && !createAuthorizationMutation.isPending;

  const activeAuthorizations = useMemo(
    () => authorizationsQuery.data?.authorizations ?? [],
    [authorizationsQuery.data?.authorizations],
  );

  const latestChallengeInstructions = useMemo(() => {
    if (!latestChallenge) return "";

    return [
      "Connect to the external AI API for this project.",
      "",
      "Base URL:",
      resolvedApiUrl,
      "",
      "Use this one-time login challenge:",
      `challengeId: ${latestChallenge.challengeId}`,
      `challengeCode: ${latestChallenge.challengeCode}`,
      "",
      "First exchange the challenge with:",
      "POST /auth/external-ai/token",
      "",
      "Then use the returned bearer token to:",
      "1. call GET /external-ai/context",
      "2. inspect the returned scopes and allowedRoutes",
      "3. use only the allowed resume revision routes exposed by that token",
      "",
      "Typical allowed route families include:",
      "- GET /resumes/{resumeId}",
      "- GET /resumes/{resumeId}/branches",
      "- POST /resume-commits/{fromCommitId}/branches",
      "- GET /resume-branches/{branchId}/commits",
      "- GET /resume-commits/{commitId}",
      "- POST /resume-commits/compare",
      "- POST /resume-branches/{branchId}/commits",
      "- GET/POST/PATCH/DELETE assignment routes when those scopes are present",
      "- GET/POST/PATCH/DELETE education routes when those scopes are present",
      "- PATCH /resume-branches/{branchId}/skills when that scope is present",
      "",
      "Do not use any internal-only routes. Start by fetching /external-ai/context and summarize the available workflow and scopes before making any edits.",
    ].join("\n");
  }, [latestChallenge]);

  const latestChallengeMcpInstructions = useMemo(() => {
    if (!latestChallenge) return "";

    return [
      "Connect this project as a remote MCP server.",
      "",
      "MCP URL:",
      resolvedMcpUrl,
      "",
      "API Base URL:",
      resolvedApiUrl,
      "",
      "Use this one-time login challenge:",
      `challengeId: ${latestChallenge.challengeId}`,
      `challengeCode: ${latestChallenge.challengeCode}`,
      "",
      "The MCP adapter should exchange the challenge with:",
      "POST /auth/external-ai/token",
      "",
      "Then it should:",
      "1. call GET /external-ai/context at session start",
      "2. inspect the returned scopes and allowedRoutes",
      "3. register only the routes exposed by allowedRoutes",
      "4. refresh access with POST /auth/external-ai/token/refresh when needed",
      "",
      "Use the MCP URL above for the MCP client connection and the API Base URL for backend requests.",
    ].join("\n");
  }, [latestChallenge]);

  const handleCopyInstructions = async (mode: "api" | "mcp") => {
    const content = mode === "api" ? latestChallengeInstructions : latestChallengeMcpInstructions;
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopyState(mode === "api" ? "api-success" : "mcp-success");
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
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          {t("externalAIConnections.pageTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("externalAIConnections.pageDescription")}
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">{t("externalAIConnections.createTitle")}</Typography>
            <TextField
              select
              label={t("externalAIConnections.clientLabel")}
              value={selectedClientKey}
              onChange={(event) => setSelectedClientKey(event.target.value)}
            >
              {clientOptions.map((client) => (
                <MenuItem key={client.id} value={client.key}>
                  {client.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t("externalAIConnections.connectionTitleLabel")}
              placeholder={t("externalAIConnections.connectionTitlePlaceholder")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              select
              label={t("externalAIConnections.durationLabel")}
              value={duration}
              onChange={(event) => setDuration(event.target.value as (typeof DURATION_OPTIONS)[number])}
            >
              {DURATION_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {t(`externalAIConnections.durationOption.${option}`)}
                </MenuItem>
              ))}
            </TextField>
            {createAuthorizationMutation.isError && (
              <Alert severity="error">{t("externalAIConnections.createError")}</Alert>
            )}
            <Box>
              <Button
                variant="contained"
                onClick={() => createAuthorizationMutation.mutate()}
                disabled={!canCreate}
              >
                {createAuthorizationMutation.isPending
                  ? t("externalAIConnections.creating")
                  : t("externalAIConnections.createButton")}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {latestChallenge && (
        <Alert severity="success">
          <Stack spacing={1}>
            <Typography variant="subtitle2">
              {t("externalAIConnections.challengeTitle", { client: latestChallenge.clientTitle })}
            </Typography>
            <Typography variant="body2">
              {t("externalAIConnections.challengeCodeLabel")}: <strong>{latestChallenge.challengeCode}</strong>
            </Typography>
            <Typography variant="body2">
              {t("externalAIConnections.challengeIdLabel")}: {latestChallenge.challengeId}
            </Typography>
            <Typography variant="body2">
              {t("externalAIConnections.challengeExpiresLabel")}: {latestChallenge.challengeExpiresAt}
            </Typography>
            <Typography variant="body2">
              {t("externalAIConnections.authorizationExpiresLabel")}: {latestChallenge.authorizationExpiresAt}
            </Typography>
            <Typography variant="body2">
              {t("externalAIConnections.tokenExpiresLabel")}: {latestChallenge.accessTokenExpiresAt}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {latestChallenge.scopes.map((scope) => (
                <Chip key={scope} label={scope} size="small" variant="outlined" />
              ))}
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={() => void handleCopyInstructions("api")}>
                {t("externalAIConnections.copyApiInstructionsButton")}
              </Button>
              <Button variant="outlined" onClick={() => void handleCopyInstructions("mcp")}>
                {t("externalAIConnections.copyMcpInstructionsButton")}
              </Button>
            </Stack>
            {copyState === "api-success" && (
              <Typography variant="body2" color="success.main">
                {t("externalAIConnections.copyApiInstructionsSuccess")}
              </Typography>
            )}
            {copyState === "mcp-success" && (
              <Typography variant="body2" color="success.main">
                {t("externalAIConnections.copyMcpInstructionsSuccess")}
              </Typography>
            )}
            {copyState === "error" && (
              <Typography variant="body2" color="error.main">
                {t("externalAIConnections.copyInstructionsError")}
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">{t("externalAIConnections.listTitle")}</Typography>

            {activeAuthorizations.length === 0 ? (
              <Alert severity="warning">{t("externalAIConnections.empty")}</Alert>
            ) : (
              <Stack spacing={2}>
                {activeAuthorizations.map((authorization) => (
                  <Card key={authorization.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                        >
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {authorization.title || authorization.client.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {authorization.client.title}
                            </Typography>
                          </Box>
                          <Chip label={authorization.status} size="small" variant="outlined" />
                        </Stack>
                        <Typography variant="body2">
                          {t("externalAIConnections.createdAtLabel")}: {authorization.createdAt}
                        </Typography>
                        <Typography variant="body2">
                          {t("externalAIConnections.lastUsedLabel")}: {authorization.lastUsedAt ?? t("externalAIConnections.neverUsed")}
                        </Typography>
                        <Typography variant="body2">
                          {t("externalAIConnections.expiresAtLabel")}: {authorization.expiresAt}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {authorization.scopes.map((scope) => (
                            <Chip key={scope} label={scope} size="small" variant="outlined" />
                          ))}
                        </Stack>
                        {(() => {
                          const expiresAt = new Date(authorization.expiresAt);
                          const isExpired = authorization.status === "expired" || expiresAt <= new Date();
                          const isRevoked = authorization.status === "revoked" || authorization.revokedAt !== null;
                          const canDelete = isExpired || isRevoked;

                          return (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              {!canDelete && (
                                <Button
                                  color="error"
                                  variant="outlined"
                                  onClick={() => revokeAuthorizationMutation.mutate(authorization.id)}
                                  disabled={revokeAuthorizationMutation.isPending}
                                >
                                  {t("externalAIConnections.revokeButton")}
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  color="error"
                                  variant="outlined"
                                  onClick={() => deleteAuthorizationMutation.mutate(authorization.id)}
                                  disabled={deleteAuthorizationMutation.isPending}
                                >
                                  {t("externalAIConnections.deleteButton")}
                                </Button>
                              )}
                            </Stack>
                          );
                        })()}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

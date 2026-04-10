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
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState, LoadingState } from "../../../components/feedback";
import { PageContent } from "../../../components/layout/PageContent";
import { PageHeader } from "../../../components/layout/PageHeader";
import { orpc } from "../../../orpc-client";

export const Route = createFileRoute("/_authenticated/assistant/external-ai")({
  component: ExternalAIConnectionsPage,
});

const CLIENTS_QUERY_KEY = ["external-ai", "clients"] as const;
const AUTHORIZATIONS_QUERY_KEY = ["external-ai", "authorizations"] as const;

function ExternalAIConnectionsPage() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const [selectedClientKey, setSelectedClientKey] = useState("");
  const [title, setTitle] = useState("");
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

  const canCreate = selectedClientKey.trim().length > 0 && !createAuthorizationMutation.isPending;

  const activeAuthorizations = useMemo(
    () => authorizationsQuery.data?.authorizations ?? [],
    [authorizationsQuery.data?.authorizations],
  );

  if (clientsQuery.isLoading || authorizationsQuery.isLoading) {
    return <LoadingState label={t("externalAIConnections.loading")} />;
  }

  if (clientsQuery.isError || authorizationsQuery.isError) {
    return <ErrorState message={t("externalAIConnections.loadError")} />;
  }

  return (
    <>
      <PageHeader title={t("externalAIConnections.pageTitle")} />
      <PageContent>
        <Stack spacing={3}>
          <Alert severity="info">{t("externalAIConnections.pageDescription")}</Alert>

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
                            <Box>
                              <Button
                                color="error"
                                variant="outlined"
                                onClick={() => revokeAuthorizationMutation.mutate(authorization.id)}
                                disabled={revokeAuthorizationMutation.isPending}
                              >
                                {t("externalAIConnections.revokeButton")}
                              </Button>
                            </Box>
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
      </PageContent>
    </>
  );
}

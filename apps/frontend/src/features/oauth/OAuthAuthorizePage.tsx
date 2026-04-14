import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { orpc } from "../../orpc-client";

const DURATION_OPTIONS = ["1h", "4h", "8h", "1d", "7d"] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

export interface OAuthAuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  responseType: string;
}

interface OAuthAuthorizePageProps {
  params: OAuthAuthorizeParams;
}

function encodeAuthCode(payload: {
  id: string;
  code: string;
  cc: string;
  cm: string;
  ru: string;
  exp: number;
}): string {
  // base64url encoding (compatible with the MCP server decoder)
  const json = JSON.stringify(payload);
  const b64 = btoa(json);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildRedirectUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function OAuthAuthorizePage({ params }: OAuthAuthorizePageProps) {
  const { t } = useTranslation("common");
  const [duration, setDuration] = useState<Duration>("8h");
  const [denied, setDenied] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ["external-ai", "clients"],
    queryFn: () => orpc.listExternalAIClients({}),
  });

  const matchedClient = clientsQuery.data?.clients.find((c) => c.key === params.clientId);

  const requestedScopes = params.scope
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

  const approveMutation = useMutation({
    mutationFn: () =>
      orpc.createExternalAIAuthorization({
        clientKey: params.clientId,
        title: null,
        duration,
      }),
    onSuccess: (response) => {
      const code = encodeAuthCode({
        id: response.challengeId,
        code: response.challengeCode,
        cc: params.codeChallenge,
        cm: params.codeChallengeMethod,
        ru: params.redirectUri,
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      window.location.href = buildRedirectUrl(params.redirectUri, {
        code,
        state: params.state,
      });
    },
  });

  useEffect(() => {
    if (denied) {
      window.location.href = buildRedirectUrl(params.redirectUri, {
        error: "access_denied",
        error_description: "User denied the authorization request",
        state: params.state,
      });
    }
  }, [denied, params.redirectUri, params.state]);

  const validationError = (() => {
    if (params.responseType !== "code") return t("oauthAuthorize.errorInvalidResponseType");
    if (!params.codeChallengeMethod) return t("oauthAuthorize.errorMissingPkce");
    if (!params.codeChallenge) return t("oauthAuthorize.errorMissingPkce");
    return null;
  })();

  if (validationError) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8, px: 2 }}>
        <Card sx={{ maxWidth: 480, width: "100%" }}>
          <CardContent>
            <Alert severity="error">{validationError}</Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (clientsQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (clientsQuery.isError || !matchedClient) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8, px: 2 }}>
        <Card sx={{ maxWidth: 480, width: "100%" }}>
          <CardContent>
            <Alert severity="error">{t("oauthAuthorize.errorUnknownClient", { clientId: params.clientId })}</Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8, px: 2 }}>
      <Card sx={{ maxWidth: 480, width: "100%" }}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {t("oauthAuthorize.title")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("oauthAuthorize.subtitle", { client: matchedClient.title })}
              </Typography>
            </Box>

            {matchedClient.description && (
              <Typography variant="body2" color="text.secondary">
                {matchedClient.description}
              </Typography>
            )}

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("oauthAuthorize.scopesLabel")}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {requestedScopes.map((scope) => (
                  <Chip key={scope} label={scope} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>

            <TextField
              select
              label={t("oauthAuthorize.durationLabel")}
              value={duration}
              onChange={(e) => setDuration(e.target.value as Duration)}
              size="small"
              fullWidth
            >
              {DURATION_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(`externalAIConnections.durationOption.${opt}`)}
                </MenuItem>
              ))}
            </TextField>

            {approveMutation.isError && (
              <Alert severity="error">{t("oauthAuthorize.approveError")}</Alert>
            )}

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setDenied(true)}
                disabled={approveMutation.isPending || denied}
              >
                {t("oauthAuthorize.denyButton")}
              </Button>
              <Button
                variant="contained"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || denied}
              >
                {approveMutation.isPending ? t("oauthAuthorize.approving") : t("oauthAuthorize.approveButton")}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

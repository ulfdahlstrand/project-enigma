/**
 * AuthorizationListCard — card listing active external-AI authorizations.
 * Each row shows metadata, scopes, and revoke/delete actions based on status.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

interface Authorization {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  scopes: string[];
  client: { title: string };
}

interface AuthorizationListCardProps {
  authorizations: Authorization[];
  isRevoking: boolean;
  isDeleting: boolean;
  onRevoke: (authorizationId: string) => void;
  onDelete: (authorizationId: string) => void;
}

function AuthorizationRow({
  authorization,
  isRevoking,
  isDeleting,
  onRevoke,
  onDelete,
}: {
  authorization: Authorization;
  isRevoking: boolean;
  isDeleting: boolean;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const expiresAt = new Date(authorization.expiresAt);
  const isExpired = authorization.status === "expired" || expiresAt <= new Date();
  const isRevoked = authorization.status === "revoked" || authorization.revokedAt !== null;
  const canDelete = isExpired || isRevoked;

  return (
    <Card variant="outlined">
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
            {t("externalAIConnections.lastUsedLabel")}:{" "}
            {authorization.lastUsedAt ?? t("externalAIConnections.neverUsed")}
          </Typography>
          <Typography variant="body2">
            {t("externalAIConnections.expiresAtLabel")}: {authorization.expiresAt}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {authorization.scopes.map((scope) => (
              <Chip key={scope} label={scope} size="small" variant="outlined" />
            ))}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {!canDelete && (
              <Button
                color="error"
                variant="outlined"
                onClick={() => onRevoke(authorization.id)}
                disabled={isRevoking}
              >
                {t("externalAIConnections.revokeButton")}
              </Button>
            )}
            {canDelete && (
              <Button
                color="error"
                variant="outlined"
                onClick={() => onDelete(authorization.id)}
                disabled={isDeleting}
              >
                {t("externalAIConnections.deleteButton")}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AuthorizationListCard({
  authorizations,
  isRevoking,
  isDeleting,
  onRevoke,
  onDelete,
}: AuthorizationListCardProps) {
  const { t } = useTranslation("common");

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">{t("externalAIConnections.listTitle")}</Typography>
          {authorizations.length === 0 ? (
            <Alert severity="warning">{t("externalAIConnections.empty")}</Alert>
          ) : (
            <Stack spacing={2}>
              {authorizations.map((authorization) => (
                <AuthorizationRow
                  key={authorization.id}
                  authorization={authorization}
                  isRevoking={isRevoking}
                  isDeleting={isDeleting}
                  onRevoke={onRevoke}
                  onDelete={onDelete}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

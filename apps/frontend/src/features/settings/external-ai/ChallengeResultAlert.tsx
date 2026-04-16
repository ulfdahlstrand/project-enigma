/**
 * ChallengeResultAlert — success alert displayed after a challenge is created.
 * Shows challenge details, scopes, and copy-to-clipboard buttons for API and MCP instructions.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export interface ChallengeResult {
  authorizationId: string;
  challengeId: string;
  challengeCode: string;
  challengeExpiresAt: string;
  authorizationExpiresAt: string;
  accessTokenExpiresAt: string;
  scopes: string[];
  clientTitle: string;
}

export type CopyState = "idle" | "api-success" | "mcp-success" | "error";

interface ChallengeResultAlertProps {
  challenge: ChallengeResult;
  copyState: CopyState;
  onCopyApi: () => void;
  onCopyMcp: () => void;
}

export function ChallengeResultAlert({
  challenge,
  copyState,
  onCopyApi,
  onCopyMcp,
}: ChallengeResultAlertProps) {
  const { t } = useTranslation("common");

  return (
    <Alert severity="success">
      <Stack spacing={1}>
        <Typography variant="subtitle2">
          {t("externalAIConnections.challengeTitle", { client: challenge.clientTitle })}
        </Typography>
        <Typography variant="body2">
          {t("externalAIConnections.challengeCodeLabel")}:{" "}
          <strong>{challenge.challengeCode}</strong>
        </Typography>
        <Typography variant="body2">
          {t("externalAIConnections.challengeIdLabel")}: {challenge.challengeId}
        </Typography>
        <Typography variant="body2">
          {t("externalAIConnections.challengeExpiresLabel")}: {challenge.challengeExpiresAt}
        </Typography>
        <Typography variant="body2">
          {t("externalAIConnections.authorizationExpiresLabel")}:{" "}
          {challenge.authorizationExpiresAt}
        </Typography>
        <Typography variant="body2">
          {t("externalAIConnections.tokenExpiresLabel")}: {challenge.accessTokenExpiresAt}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {challenge.scopes.map((scope) => (
            <Chip key={scope} label={scope} size="small" variant="outlined" />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={onCopyApi}>
            {t("externalAIConnections.copyApiInstructionsButton")}
          </Button>
          <Button variant="outlined" onClick={onCopyMcp}>
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
  );
}

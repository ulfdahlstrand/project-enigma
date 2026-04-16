/**
 * CreateAuthorizationCard — form card for creating a new external-AI authorization.
 * Renders client select, optional title, duration select, and a create button.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export const DURATION_OPTIONS = ["1h", "4h", "8h", "1d", "7d"] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

interface ClientOption {
  id: string;
  key: string;
  title: string;
}

interface CreateAuthorizationCardProps {
  clientOptions: ClientOption[];
  selectedClientKey: string;
  title: string;
  duration: DurationOption;
  isCreating: boolean;
  hasError: boolean;
  onClientKeyChange: (key: string) => void;
  onTitleChange: (title: string) => void;
  onDurationChange: (duration: DurationOption) => void;
  onSubmit: () => void;
}

export function CreateAuthorizationCard({
  clientOptions,
  selectedClientKey,
  title,
  duration,
  isCreating,
  hasError,
  onClientKeyChange,
  onTitleChange,
  onDurationChange,
  onSubmit,
}: CreateAuthorizationCardProps) {
  const { t } = useTranslation("common");
  const canCreate = selectedClientKey.trim().length > 0 && !isCreating;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">{t("externalAIConnections.createTitle")}</Typography>
          <TextField
            select
            label={t("externalAIConnections.clientLabel")}
            value={selectedClientKey}
            onChange={(event) => onClientKeyChange(event.target.value)}
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
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <TextField
            select
            label={t("externalAIConnections.durationLabel")}
            value={duration}
            onChange={(event) => onDurationChange(event.target.value as DurationOption)}
          >
            {DURATION_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {t(`externalAIConnections.durationOption.${option}`)}
              </MenuItem>
            ))}
          </TextField>
          {hasError && (
            <Alert severity="error">{t("externalAIConnections.createError")}</Alert>
          )}
          <Box>
            <Button variant="contained" onClick={onSubmit} disabled={!canCreate}>
              {isCreating
                ? t("externalAIConnections.creating")
                : t("externalAIConnections.createButton")}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

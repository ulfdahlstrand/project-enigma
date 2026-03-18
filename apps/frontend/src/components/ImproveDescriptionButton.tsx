/**
 * ImproveDescriptionButton — calls the AI improve-description endpoint,
 * shows the suggestion in a read-only TextField, and lets the user accept
 * or reject it.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { orpc } from "../orpc-client";

interface Props {
  description: string;
  role?: string | undefined;
  clientName?: string | undefined;
  onAccept: (improvedText: string) => void;
}

export function ImproveDescriptionButton({
  description,
  role,
  clientName,
  onAccept,
}: Props) {
  const { t } = useTranslation("common");
  const [preview, setPreview] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      orpc.improveDescription({
        description,
        ...(role ? { role } : {}),
        ...(clientName ? { clientName } : {}),
      }),
    onSuccess: (data) => {
      setPreview(data.improvedDescription);
    },
  });

  function handleAccept() {
    if (preview !== null) {
      onAccept(preview);
      setPreview(null);
      mutation.reset();
    }
  }

  function handleReject() {
    setPreview(null);
    mutation.reset();
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={
            mutation.isPending ? (
              <CircularProgress size={16} />
            ) : (
              <AutoAwesomeIcon fontSize="small" />
            )
          }
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? t("assignment.detail.ai.improving")
            : t("assignment.detail.ai.improveButton")}
        </Button>
      </Box>

      {mutation.isError && (
        <Alert severity="error">{t("assignment.detail.ai.improveError")}</Alert>
      )}

      {preview !== null && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField
            label={t("assignment.detail.ai.previewLabel")}
            value={preview}
            multiline
            minRows={4}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" size="small" onClick={handleAccept}>
              {t("assignment.detail.ai.acceptButton")}
            </Button>
            <Button variant="outlined" size="small" onClick={handleReject}>
              {t("assignment.detail.ai.rejectButton")}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

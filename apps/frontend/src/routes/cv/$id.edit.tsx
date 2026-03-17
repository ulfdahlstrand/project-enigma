/**
 * /cv/$id/edit route — CV editor form (summary + skills UI).
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Mutation: TanStack Query useMutation + oRPC client for updating the CV.
 * Cache invalidation: invalidates getCV query key on success.
 * Styling: MUI sx prop only — no .css/.scss imports, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 *
 * Note: skill CRUD via updateCV is not yet in the API. For now, updateCV only
 * saves `summary`. The skills UI is rendered for future use but save only calls
 * orpc.updateCV({ id, summary }).
 */
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import { getCVQueryKey } from "./$id";

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/cv/$id/edit")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: CvEditPage,
});

function CvEditPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [summary, setSummary] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const queryKey = getCVQueryKey(id);

  const {
    data: cv,
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: () => orpc.getCV({ id }),
    retry: false,
  });

  // Sync local form state when the query resolves
  useEffect(() => {
    if (cv) {
      setSummary(cv.summary ?? "");
    }
  }, [cv]);

  const mutation = useMutation({
    mutationFn: () => orpc.updateCV({ id, summary }),
    onSuccess: async () => {
      setSaveError(false);
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      setSaveSuccess(false);
      setSaveError(true);
    },
  });

  const handleSave = () => {
    setSaveSuccess(false);
    setSaveError(false);
    mutation.mutate();
  };

  const handleBack = () => {
    void navigate({ to: "/cv/$id", params: { id } });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("cv.edit.pageTitle")} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 720 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("cv.edit.pageTitle")}
      </Typography>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("cv.edit.saveSuccess")}
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("cv.edit.saveError")}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label={t("cv.edit.summaryLabel")}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          multiline
          minRows={4}
          fullWidth
        />

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={mutation.isPending}
            aria-label={t("cv.edit.saveButton")}
          >
            {mutation.isPending ? t("cv.edit.saving") : t("cv.edit.saveButton")}
          </Button>
          <Button
            variant="outlined"
            onClick={handleBack}
            aria-label={t("cv.edit.backButton")}
          >
            {t("cv.edit.backButton")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

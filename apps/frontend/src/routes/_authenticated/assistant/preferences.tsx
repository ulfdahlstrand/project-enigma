import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
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

export const Route = createFileRoute("/_authenticated/assistant/preferences")({
  component: AssistantPreferencesPage,
});

const PREFERENCES_QUERY_KEY = ["assistant", "preferences"] as const;

function AssistantPreferencesPage() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [rules, setRules] = useState("");
  const [validators, setValidators] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const preferencesQuery = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: () => orpc.getConsultantAIPreferences({}),
  });

  useEffect(() => {
    if (!preferencesQuery.data) return;
    setPrompt(preferencesQuery.data.preferences?.prompt ?? "");
    setRules(preferencesQuery.data.preferences?.rules ?? "");
    setValidators(preferencesQuery.data.preferences?.validators ?? "");
  }, [preferencesQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      orpc.updateConsultantAIPreferences({
        prompt: prompt.trim() || null,
        rules: rules.trim() || null,
        validators: validators.trim() || null,
      }),
    onSuccess: async () => {
      setStatus("success");
      await queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
    },
    onError: () => {
      setStatus("error");
    },
  });

  const hasChanges = useMemo(() => {
    const current = preferencesQuery.data?.preferences;
    return (
      (current?.prompt ?? "") !== prompt
      || (current?.rules ?? "") !== rules
      || (current?.validators ?? "") !== validators
    );
  }, [preferencesQuery.data?.preferences, prompt, rules, validators]);

  if (preferencesQuery.isLoading) {
    return <LoadingState label={t("assistantPreferences.loading")} />;
  }

  if (preferencesQuery.isError) {
    return <ErrorState message={t("assistantPreferences.loadError")} />;
  }

  return (
    <>
      <PageHeader title={t("assistantPreferences.pageTitle")} />
      <PageContent>
        <Stack spacing={3}>
          <Alert severity="info">{t("assistantPreferences.pageDescription")}</Alert>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h6">{t("assistantPreferences.formTitle")}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("assistantPreferences.formDescription")}
                </Typography>

                <TextField
                  label={t("assistantPreferences.promptLabel")}
                  placeholder={t("assistantPreferences.promptPlaceholder")}
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setStatus("idle");
                  }}
                  multiline
                  minRows={3}
                />

                <TextField
                  label={t("assistantPreferences.rulesLabel")}
                  placeholder={t("assistantPreferences.rulesPlaceholder")}
                  value={rules}
                  onChange={(event) => {
                    setRules(event.target.value);
                    setStatus("idle");
                  }}
                  multiline
                  minRows={5}
                />

                <TextField
                  label={t("assistantPreferences.validatorsLabel")}
                  placeholder={t("assistantPreferences.validatorsPlaceholder")}
                  value={validators}
                  onChange={(event) => {
                    setValidators(event.target.value);
                    setStatus("idle");
                  }}
                  multiline
                  minRows={4}
                />

                {status === "success" && (
                  <Alert severity="success">{t("assistantPreferences.saveSuccess")}</Alert>
                )}
                {status === "error" && (
                  <Alert severity="error">{t("assistantPreferences.saveError")}</Alert>
                )}

                <Box>
                  <Button
                    variant="contained"
                    onClick={() => updateMutation.mutate()}
                    disabled={!hasChanges || updateMutation.isPending}
                  >
                    {updateMutation.isPending
                      ? t("assistantPreferences.saving")
                      : t("assistantPreferences.saveButton")}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </PageContent>
    </>
  );
}

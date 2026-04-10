import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { clearPromptConfigCache } from "../../../../../features/admin/prompt-config-client";
import { orderPromptFragmentsForDisplay } from "../../../../../features/admin/prompt-config-helpers";
import {
  PROMPT_GLOBAL_RULES,
  PROMPT_MODEL_CONFIGURATION,
} from "../../../../../features/admin/prompt-inventory-static";
import { orpc } from "../../../../../orpc-client";

export const Route = createFileRoute("/_admin/admin/assistant/prompts/$promptId")({
  component: AdminPromptDetailPage,
});

function AdminPromptDetailPage() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { promptId } = useParams({ strict: false }) as { promptId: string };
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const promptConfigsQuery = useQuery({
    queryKey: ["admin", "ai-prompt-configs"],
    queryFn: () => orpc.listAIPromptConfigs({}),
  });

  const updateFragmentMutation = useMutation({
    mutationFn: (input: { fragmentId: string; content: string }) => orpc.updateAIPromptFragment(input),
    onSuccess: async () => {
      clearPromptConfigCache();
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai-prompt-configs"] });
    },
  });

  const prompt = useMemo(
    () =>
      promptConfigsQuery.data?.categories
        .flatMap((category) => category.prompts.map((item) => ({ ...item, categoryTitle: category.title })))
        .find((item) => item.id === promptId),
    [promptConfigsQuery.data, promptId],
  );

  return (
    <>
      <PageHeader
        title={prompt?.title ?? t("admin.promptInventory.detailFallbackTitle")}
        breadcrumbs={[
          { label: t("nav.aiPromptInventory"), to: "/admin/assistant/prompts" },
        ]}
      />
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          {promptConfigsQuery.isError && (
            <Alert severity="error">{t("admin.promptInventory.loadError")}</Alert>
          )}

          {promptConfigsQuery.isLoading && (
            <Alert severity="info">{t("admin.promptInventory.loading")}</Alert>
          )}

          {!promptConfigsQuery.isLoading && !prompt && (
            <Alert severity="warning">{t("admin.promptInventory.promptNotFound")}</Alert>
          )}

          {prompt && (
            <>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="overline" color="text.secondary">
                      {prompt.categoryTitle}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip label={prompt.key} size="small" variant="outlined" />
                      <Chip
                        label={prompt.isEditable
                          ? t("admin.promptInventory.editableStatus")
                          : t("admin.promptInventory.readOnlyStatus")}
                        size="small"
                        variant="outlined"
                        color={prompt.isEditable ? "primary" : "default"}
                      />
                    </Stack>
                    <Typography variant="body1">
                      {prompt.description ?? t("admin.promptInventory.noDescription")}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {t("admin.promptInventory.fragmentsTitle")}
                  </Typography>
                  <Stack spacing={3}>
                    {orderPromptFragmentsForDisplay(prompt.fragments).map((fragment) => {
                      const draftValue = drafts[fragment.id] ?? fragment.content;
                      const isDirty = draftValue !== fragment.content;

                      return (
                        <Box key={fragment.id}>
                          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                            {fragment.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 1 }}
                          >
                            {fragment.key}
                          </Typography>
                          <TextField
                            value={draftValue}
                            onChange={(event) => {
                              setDrafts((current) => ({
                                ...current,
                                [fragment.id]: event.target.value,
                              }));
                            }}
                            multiline
                            minRows={6}
                            fullWidth
                            disabled={!prompt.isEditable || updateFragmentMutation.isPending}
                          />
                          {prompt.isEditable && (
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Button
                                variant="contained"
                                size="small"
                                disabled={!isDirty || updateFragmentMutation.isPending}
                                onClick={() => {
                                  void updateFragmentMutation.mutateAsync({
                                    fragmentId: fragment.id,
                                    content: draftValue,
                                  }).then(() => {
                                    setDrafts((current) => ({
                                      ...current,
                                      [fragment.id]: draftValue,
                                    }));
                                  });
                                }}
                              >
                                {t("admin.promptInventory.saveButton")}
                              </Button>
                              <Button
                                variant="text"
                                size="small"
                                disabled={!isDirty || updateFragmentMutation.isPending}
                                onClick={() => {
                                  setDrafts((current) => ({
                                    ...current,
                                    [fragment.id]: fragment.content,
                                  }));
                                }}
                              >
                                {t("admin.promptInventory.resetButton")}
                              </Button>
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {t("admin.promptInventory.modelConfigTitle")}
                  </Typography>
                  <Stack spacing={1}>
                    {PROMPT_MODEL_CONFIGURATION.map((item) => (
                      <Typography key={item} variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {t("admin.promptInventory.globalRulesTitle")}
                  </Typography>
                  <Stack spacing={1}>
                    {PROMPT_GLOBAL_RULES.map((item) => (
                      <Typography key={item} variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Box>
    </>
  );
}

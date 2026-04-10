import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  PROMPT_MODEL_CONFIGURATION,
  PROMPT_GLOBAL_RULES,
} from "../../../features/admin/prompt-inventory-static";
import { clearPromptConfigCache } from "../../../features/admin/prompt-config-client";
import { orpc } from "../../../orpc-client";

export const Route = createFileRoute("/_admin/admin/")({
  component: AdminPromptInventoryPage,
});

function AdminPromptInventoryPage() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const normalizedQuery = query.trim().toLowerCase();
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

  const categories = promptConfigsQuery.data?.categories ?? [];

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) {
      return categories;
    }

    return categories
      .map((category) => ({
        ...category,
        prompts: category.prompts.filter((prompt) => {
          const haystack = [
            category.title,
            prompt.title,
            prompt.sourceFile,
            prompt.description ?? "",
            ...prompt.fragments.flatMap((fragment) => [fragment.label, fragment.key, fragment.content]),
          ].join(" ").toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((category) => category.prompts.length > 0);
  }, [categories, normalizedQuery]);

  const totalLocations = categories.reduce(
    (count, category) => count + category.prompts.length,
    0,
  );

  const visibleLocations = filteredSections.reduce(
    (count, category) => count + category.prompts.length,
    0,
  );

  return (
    <>
      <PageHeader title={t("admin.promptInventory.pageTitle")} />
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Alert severity="info">
            {t("admin.promptInventory.readOnlyNotice")}
          </Alert>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            useFlexGap
            flexWrap="wrap"
          >
            <Chip label={t("admin.promptInventory.hardcodedChip")} color="primary" variant="outlined" />
            <Chip label={t("admin.promptInventory.dbBackedChip")} variant="outlined" />
          </Stack>

          <Typography variant="body1" color="text.secondary">
            {t("admin.promptInventory.pageDescription")}
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Chip
              label={t("admin.promptInventory.sectionCount", { count: categories.length })}
              variant="outlined"
            />
            <Chip
              label={t("admin.promptInventory.locationCount", { count: totalLocations })}
              variant="outlined"
            />
            <Chip
              label={t("admin.promptInventory.visibleCount", { count: visibleLocations })}
              variant="outlined"
            />
          </Stack>

          <TextField
            label={t("admin.promptInventory.searchLabel")}
            placeholder={t("admin.promptInventory.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            fullWidth
          />

          {promptConfigsQuery.isError && (
            <Alert severity="error">Failed to load prompt definitions.</Alert>
          )}

          {promptConfigsQuery.isLoading && (
            <Alert severity="info">Loading prompt definitions…</Alert>
          )}

          {filteredSections.map((section) => (
            <Card key={section.key} variant="outlined">
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography variant="h6">{section.title}</Typography>
                  {section.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {section.description}
                    </Typography>
                  )}
                </Box>
                <Divider />
                <Stack spacing={0}>
                  {section.prompts.map((item, index) => (
                    <Box
                      key={`${section.key}-${item.key}`}
                      sx={{
                        px: 3,
                        py: 2,
                        borderTop: index === 0 ? "none" : "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.75 }}>
                        {item.title}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Chip
                          label={item.isEditable ? "Editable" : "Read only"}
                          size="small"
                          color={item.isEditable ? "primary" : "default"}
                          variant="outlined"
                        />
                        <Chip label={item.key} size="small" variant="outlined" />
                      </Stack>
                      {item.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {item.description}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          bgcolor: "action.hover",
                          borderRadius: 1,
                          px: 1,
                          py: 0.75,
                          mb: 1.5,
                          overflowX: "auto",
                        }}
                      >
                        {item.sourceFile}
                      </Typography>
                      <Stack spacing={2}>
                        {item.fragments.map((fragment) => {
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
                                minRows={4}
                                fullWidth
                                disabled={!item.isEditable || updateFragmentMutation.isPending}
                              />
                              {item.isEditable && (
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
                                    Save
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
                                    Reset
                                  </Button>
                                </Stack>
                              )}
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}

          {filteredSections.length === 0 && (
            <Alert severity="warning">
              {t("admin.promptInventory.emptySearch")}
            </Alert>
          )}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                {t("admin.promptInventory.modelConfigTitle")}
              </Typography>
              <List dense disablePadding>
                {PROMPT_MODEL_CONFIGURATION.map((item) => (
                  <ListItem key={item} sx={{ display: "list-item", py: 0.25, pl: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {item}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                {t("admin.promptInventory.globalRulesTitle")}
              </Typography>
              <List dense disablePadding>
                {PROMPT_GLOBAL_RULES.map((item) => (
                  <ListItem key={item} sx={{ display: "list-item", py: 0.25, pl: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {item}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </>
  );
}

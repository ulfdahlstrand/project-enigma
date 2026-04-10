import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { orpc } from "../../../../../orpc-client";

export const Route = createFileRoute("/_admin/admin/assistant/prompts/")({
  component: AdminPromptInventoryListPage,
});

function AdminPromptInventoryListPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const promptConfigsQuery = useQuery({
    queryKey: ["admin", "ai-prompt-configs"],
    queryFn: () => orpc.listAIPromptConfigs({}),
  });

  const categories = promptConfigsQuery.data?.categories ?? [];
  const normalizedQuery = query.trim().toLowerCase();

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
            prompt.description ?? "",
            ...prompt.fragments.flatMap((fragment) => [fragment.label, fragment.key, fragment.content]),
          ].join(" ").toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((category) => category.prompts.length > 0);
  }, [categories, normalizedQuery]);

  const totalPrompts = categories.reduce((count, category) => count + category.prompts.length, 0);
  const visiblePrompts = filteredSections.reduce((count, category) => count + category.prompts.length, 0);

  return (
    <>
      <PageHeader title={t("admin.promptInventory.pageTitle")} />
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Alert severity="info">
            {t("admin.promptInventory.manageNotice")}
          </Alert>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap flexWrap="wrap">
            <Chip label={t("admin.promptInventory.dbBackedChip")} color="primary" variant="outlined" />
            <Chip label={t("admin.promptInventory.editableChip")} variant="outlined" />
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
              label={t("admin.promptInventory.promptCount", { count: totalPrompts })}
              variant="outlined"
            />
            <Chip
              label={t("admin.promptInventory.visibleCount", { count: visiblePrompts })}
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
            <Alert severity="error">{t("admin.promptInventory.loadError")}</Alert>
          )}

          {promptConfigsQuery.isLoading && (
            <Alert severity="info">{t("admin.promptInventory.loading")}</Alert>
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
                <List disablePadding>
                  {section.prompts.map((prompt, index) => (
                    <ListItem
                      key={prompt.id}
                      disablePadding
                      sx={{
                        borderTop: index === 0 ? "none" : "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <ListItemButton
                        sx={{ px: 3, py: 2 }}
                        onClick={() => {
                          void navigate({ to: `/admin/assistant/prompts/${prompt.id}` });
                        }}
                      >
                        <ListItemText
                          primary={prompt.title}
                          secondary={prompt.description ?? t("admin.promptInventory.noDescription")}
                          slotProps={{
                            primary: { sx: { fontWeight: 600 } },
                            secondary: { sx: { mt: 0.5 } },
                          }}
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={prompt.isEditable
                              ? t("admin.promptInventory.editableStatus")
                              : t("admin.promptInventory.readOnlyStatus")}
                            size="small"
                            variant="outlined"
                            color={prompt.isEditable ? "primary" : "default"}
                          />
                          <ChevronRightIcon color="action" />
                        </Stack>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          ))}

          {filteredSections.length === 0 && (
            <Alert severity="warning">{t("admin.promptInventory.emptySearch")}</Alert>
          )}
        </Stack>
      </Box>
    </>
  );
}

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  PROMPT_GLOBAL_RULES,
  PROMPT_INVENTORY_SECTIONS,
  PROMPT_MODEL_CONFIGURATION,
} from "../../../features/admin/prompt-inventory-data";

export const Route = createFileRoute("/_admin/admin/")({
  component: AdminPromptInventoryPage,
});

function AdminPromptInventoryPage() {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) {
      return PROMPT_INVENTORY_SECTIONS;
    }

    return PROMPT_INVENTORY_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const haystack = [item.title, item.file, ...item.bullets].join(" ").toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [normalizedQuery]);

  const totalLocations = PROMPT_INVENTORY_SECTIONS.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  const visibleLocations = filteredSections.reduce(
    (count, section) => count + section.items.length,
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
              label={t("admin.promptInventory.sectionCount", { count: PROMPT_INVENTORY_SECTIONS.length })}
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

          {filteredSections.map((section) => (
            <Card key={section.titleKey} variant="outlined">
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography variant="h6">{t(section.titleKey)}</Typography>
                </Box>
                <Divider />
                <Stack spacing={0}>
                  {section.items.map((item, index) => (
                    <Box
                      key={`${section.titleKey}-${item.file}`}
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
                        {item.file}
                      </Typography>
                      <List dense disablePadding>
                        {item.bullets.map((bullet) => (
                          <ListItem key={bullet} sx={{ display: "list-item", py: 0.25, pl: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              {bullet}
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
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

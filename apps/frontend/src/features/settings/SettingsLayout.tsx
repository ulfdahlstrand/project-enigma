import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageContent } from "../../components/layout/PageContent";
import { PageHeader } from "../../components/layout/PageHeader";

type SettingsSection = "assistant-preferences" | "external-ai";

interface SettingsLayoutProps {
  activeSection: SettingsSection;
  children: React.ReactNode;
}

export function SettingsLayout({ activeSection, children }: SettingsLayoutProps) {
  const { t } = useTranslation("common");

  const sections = [
    {
      id: "assistant-preferences" as const,
      label: t("nav.assistantPreferences"),
      to: "/settings/assistant/preferences" as const,
    },
    {
      id: "external-ai" as const,
      label: t("nav.externalAIConnections"),
      to: "/settings/assistant/external-ai" as const,
    },
  ];

  return (
    <>
      <PageHeader title={t("settings.pageTitle")} />
      <PageContent>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={3}
          alignItems="flex-start"
        >
          <Paper
            variant="outlined"
            sx={{
              width: { xs: "100%", lg: 280 },
              p: 1.5,
              position: { lg: "sticky" },
              top: 24,
              borderRadius: 3,
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
                {t("settings.sidebarLabel")}
              </Typography>
              {sections.map((section) => {
                const isActive = activeSection === section.id;

                return (
                  <Box
                    key={section.id}
                    component={RouterLink}
                    to={section.to}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 2,
                      color: isActive ? "primary.main" : "text.primary",
                      bgcolor: isActive ? "action.selected" : "transparent",
                      textDecoration: "none",
                      fontWeight: isActive ? 600 : 500,
                      "&:hover": {
                        bgcolor: isActive ? "action.selected" : "action.hover",
                      },
                    }}
                  >
                    {section.label}
                  </Box>
                );
              })}
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              width: "100%",
              p: { xs: 2, md: 3 },
              borderRadius: 4,
            }}
          >
            {children}
          </Paper>
        </Stack>
      </PageContent>
    </>
  );
}

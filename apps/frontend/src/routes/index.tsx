/**
 * Index route — renders at the "/" path.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/layout/PageHeader";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("home.welcome")} />
      <Box sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          {t("home.description")}
        </Typography>
      </Box>
    </>
  );
}

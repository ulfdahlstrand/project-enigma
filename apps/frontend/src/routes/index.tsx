/**
 * Index route — home page at "/".
 */
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/auth-context";
import { PageHeader } from "../components/layout/PageHeader";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation("common");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
        }}
      >
        <Typography variant="h5" fontWeight={500}>
          {t("home.signInPrompt")}
        </Typography>
        <Button
          variant="contained"
          onClick={() => void navigate({ to: "/login" })}
        >
          {t("home.signInButton")}
        </Button>
      </Box>
    );
  }

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

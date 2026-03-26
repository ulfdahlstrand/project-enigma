/**
 * /login route — public page for Google OAuth sign-in.
 *
 * On successful authentication the backend issues the session cookie and the
 * frontend refreshes its current-session bootstrap state from the server.
 */
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { GoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../auth/auth-context";
import { ensureAuthSession } from "../../auth/session-store";

export const Route = createFileRoute("/login/")({
  beforeLoad: async () => {
    const session = await ensureAuthSession();
    if (session.status === "authenticated") {
      throw redirect({ to: "/employees" });
    }
  },
  component: LoginPage,
});

export function LoginPage() {
  const { t } = useTranslation("common");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          width: "100%",
          maxWidth: 400,
          px: 3,
        }}
      >
        <Box sx={{ textAlign: "center", mb: 1 }}>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            {t("header.appName")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t("auth.loginSubtitle")}
          </Typography>
        </Box>

        <Divider sx={{ width: "100%" }} />

        {error && (
          <Alert severity="error" sx={{ width: "100%" }}>
            {t("auth.loginError")}
          </Alert>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            width: "100%",
          }}
        >
          {isLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t("auth.loggingIn")}
              </Typography>
            </Box>
          ) : (
            <GoogleLogin
              onSuccess={(response) => {
                if (response.credential) {
                  setIsLoading(true);
                  setError(false);
                  login(response.credential)
                    .then(() => navigate({ to: "/employees" }))
                    .catch(() => {
                      setIsLoading(false);
                      setError(true);
                    });
                } else {
                  setError(true);
                }
              }}
              onError={() => setError(true)}
            />
          )}
        </Box>

        <Typography variant="caption" color="text.disabled" sx={{ textAlign: "center" }}>
          {t("auth.loginHelp")}
        </Typography>
      </Box>
    </Box>
  );
}

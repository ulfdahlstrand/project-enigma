/**
 * /login route — public page for Microsoft Entra sign-in.
 *
 * On successful authentication the backend issues the session cookie and the
 * frontend refreshes its current-session bootstrap state from the server.
 */
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import Button from "@mui/material/Button";
import MicrosoftIcon from "@mui/icons-material/Microsoft";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../auth/auth-context";
import { ensureAuthSession } from "../../auth/session-store";
import { loginRequest } from "../../auth/msal-config";

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
  const { instance } = useMsal();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(false);

    try {
      const result = await instance.loginPopup(loginRequest);
      const credential = result.idToken;

      if (!credential) {
        throw new Error("Missing id token");
      }

      await login(credential);
      await navigate({ to: "/employees" });
    } catch {
      setError(true);
      setIsLoading(false);
    }
  };

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
            <Button
              variant="contained"
              startIcon={<MicrosoftIcon />}
              onClick={() => void handleLogin()}
            >
              {t("auth.signInWithMicrosoft")}
            </Button>
          )}
        </Box>

        <Typography variant="caption" color="text.disabled" sx={{ textAlign: "center" }}>
          {t("auth.loginHelp")}
        </Typography>
      </Box>
    </Box>
  );
}

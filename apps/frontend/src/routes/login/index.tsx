/**
 * /login route — public page for Google OAuth sign-in.
 *
 * On successful authentication the backend issues a short-lived JWT (access
 * token) and sets an HttpOnly refresh-token cookie. The access token is kept
 * in React state via AuthContext; only a session-presence flag is stored in
 * localStorage so the route guard can redirect quickly.
 */
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { GoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../auth/auth-context";

const SESSION_FLAG_KEY = "cv-tool:has-session";

export const Route = createFileRoute("/login/")({
  beforeLoad: () => {
    if (localStorage.getItem(SESSION_FLAG_KEY)) {
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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 3,
      }}
    >
      <Typography variant="h4" component="h1">
        {t("header.appName")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ width: "100%", maxWidth: 360 }}>
          {t("auth.loginError")}
        </Alert>
      )}

      <GoogleLogin
        onSuccess={(response) => {
          if (response.credential) {
            login(response.credential)
              .then(() => navigate({ to: "/employees" }))
              .catch(() => setError(true));
          } else {
            setError(true);
          }
        }}
        onError={() => setError(true)}
      />
    </Box>
  );
}

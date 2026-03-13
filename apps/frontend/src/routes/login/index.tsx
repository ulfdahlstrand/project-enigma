/**
 * /login route — public page for Google OAuth sign-in.
 *
 * On successful authentication the Google ID token is stored in localStorage
 * via AuthContext and the user is redirected to /employee.
 */
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { GoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../auth/auth-context";

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/login/")({
  beforeLoad: () => {
    if (localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/employee" });
    }
  },
  component: LoginPage,
});

export function LoginPage() {
  const { t } = useTranslation("common");
  const { setToken } = useAuth();
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
            setToken(response.credential);
            void navigate({ to: "/employee" });
          } else {
            setError(true);
          }
        }}
        onError={() => setError(true)}
      />
    </Box>
  );
}

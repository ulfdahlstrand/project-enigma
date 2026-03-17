/**
 * Header — Google Docs-inspired top app bar.
 *
 * White bar with the app name in Google's multicolor style, language selector
 * on the right. Sits above the sidebar + content area.
 */
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";

/** Renders "CV Tool" with Google-style letter colouring */
function AppLogo({ name }: { name: string }) {
  const COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {name.split("").map((char, i) => (
        <Typography
          key={i}
          component="span"
          sx={{
            color: char === " " ? undefined : COLORS[i % COLORS.length],
            fontWeight: 500,
            fontSize: "1.25rem",
            lineHeight: 1,
          }}
        >
          {char}
        </Typography>
      ))}
    </Box>
  );
}

export function Header() {
  const { t } = useTranslation();

  return (
    <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar sx={{ minHeight: "56px !important", px: 2, gap: 1 }}>
        {/* Google Docs-style grid icon placeholder */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mr: 0.5,
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" fill="#4285F4" />
            <rect x="12" y="2" width="6" height="6" rx="1" fill="#EA4335" />
            <rect x="2" y="12" width="6" height="6" rx="1" fill="#34A853" />
            <rect x="12" y="12" width="6" height="6" rx="1" fill="#FBBC05" />
          </svg>
        </Box>

        <AppLogo name={t("header.appName")} />

        <Box sx={{ flexGrow: 1 }} />

        <LanguageSelector />
      </Toolbar>
    </AppBar>
  );
}

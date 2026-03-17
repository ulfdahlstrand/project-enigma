/**
 * Header component — Office 365 / Word-inspired top bar.
 *
 * Word-blue AppBar (#2B579A) with app name on the left and
 * LanguageSelector on the right. Styling via MUI sx prop only.
 */
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";

export function Header() {
  const { t } = useTranslation("common");

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar sx={{ minHeight: 48, px: 2 }}>
        {/* App logo mark */}
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "4px",
            bgcolor: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mr: 1.5,
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          CV
        </Box>

        <Typography
          variant="h6"
          component="div"
          sx={{ fontWeight: 600, fontSize: "1rem", color: "#fff", flexGrow: 1 }}
        >
          {t("header.appName")}
        </Typography>

        <Box sx={{ ml: "auto" }}>
          <LanguageSelector />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

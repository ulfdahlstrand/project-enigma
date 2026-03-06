/**
 * Header component — rendered at the top of every page via BaseLayout.
 *
 * Uses MUI AppBar and Toolbar as layout primitives. All user-facing strings
 * are retrieved via useTranslation() from the shared translation namespace.
 * Styling is applied exclusively via MUI sx prop — no inline style objects
 * or imported CSS files.
 */
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";

export function Header() {
  const { t } = useTranslation();

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {t("header.appName")}
        </Typography>
        <Box sx={{ marginLeft: "auto" }}>
          <LanguageSelector />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

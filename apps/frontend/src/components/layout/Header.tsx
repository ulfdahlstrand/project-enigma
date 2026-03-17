/**
 * Header — top app bar with plain app name and language selector.
 */
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";

export function Header() {
  const { t } = useTranslation();

  return (
    <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar sx={{ minHeight: "56px !important", px: 2, gap: 1 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, fontWeight: 500, fontSize: "1.25rem" }}
        >
          {t("header.appName")}
        </Typography>

        <LanguageSelector />
      </Toolbar>
    </AppBar>
  );
}

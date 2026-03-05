/**
 * NavigationMenu component — renders a persistent side navigation list for all
 * current application routes (`/` and `/test`).
 *
 * Uses MUI List, ListItem, ListItemButton, and ListItemText as layout primitives.
 * Each navigation item wraps TanStack Router's <Link> component for client-side
 * SPA navigation — no hard-coded <a href> attributes are used.
 *
 * All visible label strings are sourced from the 'common' i18n namespace via
 * useTranslation('common'). Styling is applied exclusively via MUI sx prop —
 * no inline style objects or imported CSS files.
 */
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function NavigationMenu() {
  const { t } = useTranslation("common");

  return (
    <List component="nav" disablePadding>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/">
          <ListItemText primary={t("nav.home")} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/test">
          <ListItemText primary={t("nav.test")} />
        </ListItemButton>
      </ListItem>
    </List>
  );
}

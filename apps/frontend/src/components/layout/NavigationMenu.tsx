/**
 * NavigationMenu — Slack-inspired sidebar navigation.
 *
 * Full-height column on the aubergine sidebar containing:
 *   - Workspace name / app title at the top
 *   - Nav items with active highlight and hover states
 *   - Language selector pinned to the bottom
 *
 * All styling via MUI sx prop. Colors are hard-coded to the sidebar palette
 * (white text on aubergine) rather than relying on the theme palette so that
 * the sidebar stays dark regardless of light/dark mode on the content area.
 */
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";

const ACTIVE_BG = "rgba(255,255,255,0.15)";
const HOVER_BG = "rgba(255,255,255,0.08)";
const TEXT_ACTIVE = "#FFFFFF";
const TEXT_MUTED = "rgba(255,255,255,0.72)";

interface NavItem {
  labelKey: string;
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.home", to: "/" },
  { labelKey: "nav.employees", to: "/employees" },
  { labelKey: "nav.resumes", to: "/resumes" },
];

export function NavigationMenu() {
  const { t } = useTranslation("common");
  const { location } = useRouterState();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Workspace title */}
      <Box sx={{ px: 2, py: 2.5, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Typography
          variant="h6"
          sx={{
            color: TEXT_ACTIVE,
            fontWeight: 900,
            fontSize: "1.0625rem",
            letterSpacing: "-0.01em",
          }}
        >
          {t("header.appName")}
        </Typography>
      </Box>

      {/* Nav items */}
      <List component="nav" disablePadding sx={{ pt: 1, flexGrow: 1 }}>
        {NAV_ITEMS.map(({ labelKey, to }) => {
          const isActive =
            to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(to);

          return (
            <ListItem key={to} disablePadding>
              <ListItemButton
                component={Link}
                to={to}
                sx={{
                  mx: 1,
                  borderRadius: "6px",
                  bgcolor: isActive ? ACTIVE_BG : "transparent",
                  "&:hover": { bgcolor: isActive ? ACTIVE_BG : HOVER_BG },
                  py: 0.75,
                  px: 1.5,
                }}
              >
                <ListItemText
                  primary={t(labelKey)}
                  primaryTypographyProps={{
                    fontSize: "0.9375rem",
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? TEXT_ACTIVE : TEXT_MUTED,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Language selector at bottom */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <LanguageSelector />
      </Box>
    </Box>
  );
}

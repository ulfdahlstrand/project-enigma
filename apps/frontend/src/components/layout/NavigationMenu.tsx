/**
 * NavigationMenu — Office 365 / Word-inspired sidebar navigation.
 *
 * Nav items use a left-border active indicator (4px solid primary) with a
 * light-blue active background. Hover state uses a subtle warm-gray wash.
 * LanguageSelector is pinned to the bottom of the sidebar.
 *
 * Active route detection uses TanStack Router's useRouterState().
 * All visible strings via useTranslation("common") — no plain literals.
 * Styling via MUI sx prop only.
 */
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";

interface NavItem {
  to: string;
  labelKey: string;
  Icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.home", Icon: HomeOutlinedIcon, exact: true },
  { to: "/employees", labelKey: "nav.employees", Icon: PeopleOutlinedIcon },
  { to: "/test", labelKey: "nav.test", Icon: BugReportOutlinedIcon },
];

export function NavigationMenu() {
  const { t } = useTranslation("common");
  const { location } = useRouterState();

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        py: 1,
      }}
    >
      <List component="nav" disablePadding sx={{ flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                component={Link}
                to={item.to}
                sx={{
                  pl: 2,
                  py: 0.75,
                  borderLeft: "3px solid",
                  borderColor: active ? "primary.main" : "transparent",
                  bgcolor: active ? "#EFF6FC" : "transparent",
                  color: active ? "primary.main" : "text.primary",
                  "&:hover": {
                    bgcolor: active ? "#EFF6FC" : "#F3F2F1",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: active ? "primary.main" : "text.secondary",
                  }}
                >
                  <item.Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t(item.labelKey)}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      <Box sx={{ px: 2, py: 1.5 }}>
        <LanguageSelector />
      </Box>
    </Box>
  );
}

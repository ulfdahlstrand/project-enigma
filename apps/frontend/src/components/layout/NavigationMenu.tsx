/**
 * NavigationMenu — sidebar navigation with settings footer.
 *
 * White left column with pill-shaped active state (Google Drive pattern).
 * Nav items at top, language selector pinned to the bottom (Slack pattern).
 */
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/auth-context";
import { UserMenu } from "./UserMenu";

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
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      {/* Nav items */}
      <List component="nav" disablePadding sx={{ pt: 1 }}>
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
                  borderRadius: "0 24px 24px 0",
                  mr: 2,
                  pl: 2,
                  py: 0.75,
                  bgcolor: isActive
                    ? (t) => t.palette.mode === "dark" ? "rgba(26,115,232,0.2)" : "#e8f0fe"
                    : "transparent",
                  "&:hover": {
                    bgcolor: isActive
                      ? (t) => t.palette.mode === "dark" ? "rgba(26,115,232,0.2)" : "#e8f0fe"
                      : "action.hover",
                  },
                }}
              >
                <ListItemText
                  primary={t(labelKey)}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "primary.main" : "text.primary",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* User profile footer — pinned to bottom */}
      <Box sx={{ mt: "auto" }}>
        <Divider />
        <Box sx={{ p: 0.75 }}>
          <UserMenu />
        </Box>
      </Box>
    </Box>
  );
}

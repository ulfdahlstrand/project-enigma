/**
 * NavigationMenu — sidebar navigation with brand row and settings footer.
 *
 * White left column with pill-shaped active state (Google Drive pattern).
 * Brand name at top, nav items below, user menu pinned to the bottom.
 */
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Typography from "@mui/material/Typography";
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

const ASSISTANT_NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.externalAIConnections", to: "/assistant/external-ai" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.aiPromptInventory", to: "/admin/assistant/prompts" },
];

export function NavigationMenu() {
  const { t } = useTranslation("common");
  const { location } = useRouterState();
  const { user } = useAuth();

  const renderNavItems = (items: NavItem[]) =>
    items.map(({ labelKey, to }) => {
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
    });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      {/* Brand row */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{
            fontWeight: 600,
            fontSize: "1rem",
            color: "text.primary",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          {t("header.appName")}
        </Typography>
      </Box>

      {/* Nav items */}
      <List component="nav" disablePadding sx={{ pt: 1 }}>
        {renderNavItems(NAV_ITEMS)}

        <Divider sx={{ my: 1.5 }} />
        <ListSubheader
          disableSticky
          sx={{
            bgcolor: "transparent",
            color: "text.secondary",
            fontSize: "0.75rem",
            fontWeight: 700,
            lineHeight: 1.4,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            px: 2,
            py: 0.5,
          }}
        >
          {t("nav.assistantGroup")}
        </ListSubheader>
        {renderNavItems(ASSISTANT_NAV_ITEMS)}

        {user?.role === "admin" && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <ListSubheader
              disableSticky
              sx={{
                bgcolor: "transparent",
                color: "text.secondary",
                fontSize: "0.75rem",
                fontWeight: 700,
                lineHeight: 1.4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                px: 2,
                py: 0.5,
              }}
            >
              {t("nav.adminGroup")}
            </ListSubheader>
            {renderNavItems(ADMIN_NAV_ITEMS)}
          </>
        )}
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

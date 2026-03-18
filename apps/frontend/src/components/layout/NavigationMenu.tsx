/**
 * NavigationMenu — Google Drive-inspired sidebar navigation.
 *
 * White left column with pill-shaped active state (rounded right, full width
 * except right margin — the characteristic Google Drive nav pattern).
 * Active item: blue background tint + blue text.
 * Inactive item: transparent bg, dark gray text, hover tint.
 */
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

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
                bgcolor: isActive ? "#e8f0fe" : "transparent",
                "&:hover": {
                  bgcolor: isActive ? "#e8f0fe" : "#F1F3F4",
                },
              }}
            >
              <ListItemText
                primary={t(labelKey)}
                primaryTypographyProps={{
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#1a73e8" : "#202124",
                }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

/**
 * UserMenu — Slack-style user profile row pinned to the sidebar footer.
 *
 * Renders the logged-in user's avatar, name, and email.
 * Clicking anywhere on the row opens a popup Menu containing:
 *   - Language selector
 *   - Divider
 *   - Preferences (placeholder)
 *   - Help & feedback (placeholder)
 *   - Divider
 *   - Sign out
 */
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import TranslateIcon from "@mui/icons-material/Translate";
import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../../auth/use-current-user";
import { LanguageSelector } from "./LanguageSelector";

function stringAvatar(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { t } = useTranslation("common");
  const user = useCurrentUser();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const displayName = user?.name ?? "User";
  const displayEmail = user?.email ?? "";
  const initials = stringAvatar(displayName);

  return (
    <>
      {/* Trigger row */}
      <Box
        onClick={handleOpen}
        aria-controls={open ? "user-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          cursor: "pointer",
          "&:hover": { bgcolor: "#F1F3F4" },
          minWidth: 0,
        }}
      >
        <Avatar
          src={user?.picture}
          alt={displayName}
          sx={{ width: 32, height: 32, fontSize: "0.75rem", bgcolor: "#1a73e8" }}
        >
          {!user?.picture && initials}
        </Avatar>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#202124",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </Typography>
          {displayEmail && (
            <Typography
              sx={{
                fontSize: "0.6875rem",
                color: "#5F6368",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayEmail}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Popup menu */}
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: "left", vertical: "bottom" }}
        anchorOrigin={{ horizontal: "left", vertical: "top" }}
        slotProps={{
          paper: {
            sx: {
              width: 280,
              mb: 1,
              "& .MuiMenuItem-root": { borderRadius: 1, mx: 0.5 },
            },
          },
        }}
      >
        {/* Language row */}
        <MenuItem disableRipple sx={{ gap: 1, "&:hover": { bgcolor: "transparent" }, cursor: "default" }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <TranslateIcon fontSize="small" sx={{ color: "#5F6368" }} />
          </ListItemIcon>
          <ListItemText
            primary={t("userMenu.language")}
            primaryTypographyProps={{ fontSize: "0.8125rem" }}
            sx={{ mr: 1 }}
          />
          <LanguageSelector />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Placeholder: Preferences */}
        <MenuItem onClick={handleClose} sx={{ gap: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <SettingsIcon fontSize="small" sx={{ color: "#5F6368" }} />
          </ListItemIcon>
          <ListItemText
            primary={t("userMenu.preferences")}
            primaryTypographyProps={{ fontSize: "0.8125rem" }}
          />
        </MenuItem>

        {/* Placeholder: Help & feedback */}
        <MenuItem onClick={handleClose} sx={{ gap: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <HelpOutlineIcon fontSize="small" sx={{ color: "#5F6368" }} />
          </ListItemIcon>
          <ListItemText
            primary={t("userMenu.helpAndFeedback")}
            primaryTypographyProps={{ fontSize: "0.8125rem" }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Sign out */}
        <MenuItem onClick={handleClose} sx={{ gap: 1 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <LogoutIcon fontSize="small" sx={{ color: "#5F6368" }} />
          </ListItemIcon>
          <ListItemText
            primary={t("userMenu.signOut")}
            primaryTypographyProps={{ fontSize: "0.8125rem" }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}

import { useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import Button from "@mui/material/Button";

type ResumeCommitRow = {
  id: string;
  title?: string | null;
  createdAt: string | Date | null;
};

interface ResumeHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  resumeId: string;
  activeBranchId: string | null;
  activeBranchName?: string | null;
  currentCommitId?: string | null;
  recentCommits: ResumeCommitRow[];
  language?: string | null;
}

export function ResumeHistoryDrawer({
  open,
  onClose,
  resumeId,
  activeBranchId,
  activeBranchName,
  currentCommitId = null,
  recentCommits,
  language,
}: ResumeHistoryDrawerProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuCommitId, setMenuCommitId] = useState<string | null>(null);

  function handleViewAllHistory() {
    onClose();
    void navigate(
      activeBranchId
        ? { to: "/resumes/$id/history/branch/$branchId", params: { id: resumeId, branchId: activeBranchId } }
        : { to: "/resumes/$id/history", params: { id: resumeId } },
    );
  }

  function handleCommitClick(commitId: string) {
    onClose();
    void navigate({
      to: "/resumes/$id/commit/$commitId",
      params: { id: resumeId, commitId },
    });
  }

  function handleMenuOpen(event: React.MouseEvent<HTMLButtonElement>, commitId: string) {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuCommitId(commitId);
  }

  function handleMenuClose() {
    setMenuAnchorEl(null);
    setMenuCommitId(null);
  }

  function handleCompare() {
    if (!menuCommitId) return;
    handleMenuClose();
    onClose();
    void navigate({
      to: "/resumes/$id/compare",
      params: { id: resumeId },
      search: activeBranchName
        ? { baseRef: menuCommitId, compareRef: activeBranchName }
        : { baseRef: menuCommitId },
    });
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 320 } } }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {t("resume.detail.historyDrawer.title")}
        </Typography>
        <Button
          variant="text"
          size="small"
          sx={{ mt: 0.5, px: 0 }}
          onClick={handleViewAllHistory}
        >
          {t("resume.detail.historyDrawer.viewAll")}
        </Button>
      </Box>
      <List dense disablePadding>
        {recentCommits.length === 0 ? (
          <ListItem>
            <ListItemText
              primary={t("resume.detail.historyDrawer.noCommits")}
              slotProps={{ primary: { color: "text.secondary", variant: "body2" } }}
            />
          </ListItem>
        ) : (
          recentCommits.slice(0, 20).map((commit) => (
            <ListItem
              key={commit.id}
              divider
              disablePadding
              secondaryAction={
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={t("resume.detail.historyDrawer.commitActions")}
                  onClick={(e) => handleMenuOpen(e, commit.id)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={commit.id === currentCommitId}
                aria-current={commit.id === currentCommitId ? "true" : undefined}
                onClick={() => handleCommitClick(commit.id)}
                sx={{
                  pr: 6,
                  alignItems: "flex-start",
                  "&.Mui-selected": { bgcolor: "action.selected" },
                  "&.Mui-selected:hover": { bgcolor: "action.selected" },
                }}
              >
                <ListItemText
                  primary={commit.title || t("resume.detail.historyDrawer.defaultMessage")}
                  secondary={
                    commit.createdAt
                      ? new Date(commit.createdAt).toLocaleDateString(
                          language === "sv" ? "sv-SE" : "en-GB",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : undefined
                  }
                  slotProps={{
                    primary: {
                      variant: "body2",
                      ...(commit.id === currentCommitId ? { fontWeight: 600 } : {}),
                    },
                    secondary: { variant: "caption" },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (menuCommitId) handleCommitClick(menuCommitId);
            handleMenuClose();
          }}
        >
          {t("resume.detail.historyDrawer.viewCommit")}
        </MenuItem>
        {activeBranchName && (
          <MenuItem onClick={handleCompare}>
            {t("resume.detail.historyDrawer.compareWithCurrent")}
          </MenuItem>
        )}
      </Menu>
    </Drawer>
  );
}

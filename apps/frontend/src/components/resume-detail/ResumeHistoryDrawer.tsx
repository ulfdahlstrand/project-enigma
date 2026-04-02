import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import RouterButton from "../RouterButton";

type ResumeCommitRow = {
  id: string;
  message: string | null;
  createdAt: string | Date | null;
};

interface ResumeHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  resumeId: string;
  activeBranchId: string | null;
  recentCommits: ResumeCommitRow[];
  language?: string | null;
}

export function ResumeHistoryDrawer({
  open,
  onClose,
  resumeId,
  activeBranchId,
  recentCommits,
  language,
}: ResumeHistoryDrawerProps) {
  const { t } = useTranslation("common");

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
        <RouterButton
          variant="text"
          size="small"
          to="/resumes/$id/history"
          params={{ id: resumeId }}
          {...(activeBranchId ? { search: { branchId: activeBranchId } } : {})}
          sx={{ mt: 0.5, px: 0 }}
          onClick={onClose}
        >
          {t("resume.detail.historyDrawer.viewAll")}
        </RouterButton>
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
            <ListItem key={commit.id} divider>
              <ListItemText
                primary={commit.message || t("resume.detail.historyDrawer.defaultMessage")}
                secondary={
                  commit.createdAt
                    ? new Date(commit.createdAt).toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : undefined
                }
                slotProps={{
                  primary: { variant: "body2" },
                  secondary: { variant: "caption" },
                }}
              />
            </ListItem>
          ))
        )}
      </List>
    </Drawer>
  );
}

import { useTranslation } from "react-i18next";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import type { GraphBranch, GraphCommit } from "./history-graph-utils";

const DESCRIPTION_PREVIEW_LENGTH = 100;

interface HistoryCommitTableProps {
  commits: GraphCommit[];
  selectedBranch: GraphBranch | undefined;
  onViewCommit: (commitId: string) => void;
  onCompare?: (commitId: string) => void;
}

export function HistoryCommitTable({ commits, selectedBranch, onViewCommit, onCompare }: HistoryCommitTableProps) {
  const { t } = useTranslation("common");
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuCommitId, setMenuCommitId] = useState<string | null>(null);
  const [detailCommit, setDetailCommit] = useState<GraphCommit | null>(null);

  const closeMenu = () => {
    setMenuAnchorEl(null);
    setMenuCommitId(null);
  };

  if (!commits || commits.length === 0) {
    return <Typography variant="body1">{t("resume.history.empty")}</Typography>;
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table aria-label={t("resume.history.pageTitle")}>
          <TableHead>
            <TableRow>
              <TableCell>{t("resume.history.tableHeaderMessage")}</TableCell>
              <TableCell>{t("resume.history.tableHeaderSavedAt")}</TableCell>
              <TableCell align="right">{t("resume.history.tableHeaderActions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {commits.map((commit) => {
              const savedAt = typeof commit.createdAt === "string" ? new Date(commit.createdAt) : commit.createdAt;
              const title = commit.title || t("resume.history.defaultMessage");
              const description = commit.description ?? "";
              const descriptionPreview = description.length > DESCRIPTION_PREVIEW_LENGTH
                ? `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…`
                : description;
              const isHead = selectedBranch?.headCommitId === commit.id;

              return (
                <TableRow key={commit.id}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexDirection: "column" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" fontWeight={500}>{title}</Typography>
                        {isHead && (
                          <Chip label={t("resume.history.headBadge")} color="primary" size="small" />
                        )}
                      </Box>
                      {descriptionPreview && (
                        <Typography variant="caption" color="text.secondary">
                          {descriptionPreview}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{savedAt.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t("resume.history.commitActionsButton")}
                      onClick={(event) => {
                        setMenuAnchorEl(event.currentTarget);
                        setMenuCommitId(commit.id);
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={closeMenu}
        >
          <MenuItem
            onClick={() => {
              if (menuCommitId) onViewCommit(menuCommitId);
              closeMenu();
            }}
          >
            {t("resume.history.viewCommitMenuItem")}
          </MenuItem>
          <MenuItem
            onClick={() => {
              const commit = commits.find((c) => c.id === menuCommitId);
              if (commit) setDetailCommit(commit);
              closeMenu();
            }}
          >
            {t("resume.history.commitDetailMenuItem")}
          </MenuItem>
          {onCompare && (
            <MenuItem
              onClick={() => {
                if (menuCommitId) onCompare(menuCommitId);
                closeMenu();
              }}
            >
              {t("resume.history.compareWithCurrentMenuItem")}
            </MenuItem>
          )}
        </Menu>
      </TableContainer>

      <Dialog
        open={Boolean(detailCommit)}
        onClose={() => setDetailCommit(null)}
        maxWidth="sm"
        fullWidth
      >
        {detailCommit && (
          <>
            <DialogTitle>
              {detailCommit.title || t("resume.history.defaultMessage")}
            </DialogTitle>
            <DialogContent>
              {detailCommit.description ? (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {detailCommit.description}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("resume.history.noDescription")}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                {t("resume.history.tableHeaderSavedAt")}:{" "}
                {detailCommit.createdAt
                  ? new Date(detailCommit.createdAt).toLocaleString()
                  : "—"}
              </Typography>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}

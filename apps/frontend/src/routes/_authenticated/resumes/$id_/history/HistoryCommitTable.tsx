import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GraphBranch, GraphCommit } from "./history-graph-utils";

interface HistoryCommitTableProps {
  commits: GraphCommit[];
  selectedBranch: GraphBranch | undefined;
}

export function HistoryCommitTable({ commits, selectedBranch }: HistoryCommitTableProps) {
  const { t } = useTranslation("common");

  if (!commits || commits.length === 0) {
    return <Typography variant="body1">{t("resume.history.empty")}</Typography>;
  }

  return (
    <TableContainer component={Paper}>
      <Table aria-label={t("resume.history.pageTitle")}>
        <TableHead>
          <TableRow>
            <TableCell>{t("resume.history.tableHeaderMessage")}</TableCell>
            <TableCell>{t("resume.history.tableHeaderSavedAt")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {commits.map((commit) => {
            const savedAt = typeof commit.createdAt === "string" ? new Date(commit.createdAt) : commit.createdAt;
            const message = commit.message || t("resume.history.defaultMessage");
            const isHead = selectedBranch?.headCommitId === commit.id;

            return (
              <TableRow key={commit.id}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {message}
                    {isHead && (
                      <Chip label={t("resume.history.headBadge")} color="primary" size="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>{savedAt.toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

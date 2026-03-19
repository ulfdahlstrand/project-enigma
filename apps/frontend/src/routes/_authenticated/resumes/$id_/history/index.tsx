/**
 * /resumes/$id/history — Version History page.
 *
 * Lists all commits on the resume's main branch in reverse chronological order.
 * Each row shows the save date, message, and a preview link.
 *
 * Data: useResumeCommits(branchId) from hooks/versioning
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../../../orpc-client";
import { resumeCommitsKey } from "../../../../../hooks/versioning";


export const Route = createFileRoute("/_authenticated/resumes/$id_/history/")({
  component: VersionHistoryPage,
});

function VersionHistoryPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  // Fetch the resume to get the main branch ID
  const { data: resume, isLoading: resumeLoading } = useQuery({
    queryKey: ["getResume", resumeId],
    queryFn: () => orpc.getResume({ id: resumeId }),
    enabled: Boolean(resumeId),
  });

  const branchId = resume?.mainBranchId ?? "";

  const {
    data: commits,
    isLoading: commitsLoading,
    isError,
  } = useQuery({
    queryKey: resumeCommitsKey(branchId),
    queryFn: () => orpc.listResumeCommits({ branchId }),
    enabled: Boolean(branchId),
  });

  const isLoading = resumeLoading || commitsLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.history.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("resume.history.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Button
          variant="text"
          onClick={() => void navigate({ to: "/resumes/$id", params: { id: resumeId } })}
        >
          {t("resume.detail.backButton")}
        </Button>
        <Typography variant="h5" component="h1">
          {t("resume.history.pageTitle")}
        </Typography>
      </Box>

      {!commits || commits.length === 0 ? (
        <Typography variant="body1">{t("resume.history.empty")}</Typography>
      ) : (
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
                const savedAt =
                  typeof commit.createdAt === "string"
                    ? new Date(commit.createdAt)
                    : commit.createdAt;
                const message = commit.message || t("resume.history.defaultMessage");

                return (
                  <TableRow key={commit.id}>
                    <TableCell>{message}</TableCell>
                    <TableCell>{savedAt.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

/**
 * /resumes route — displays the list of resumes for the logged-in consultant.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Rendering: MUI Table components from @mui/material.
 * Styling: MUI sx prop only — no .css/.scss files, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import RouterButton from "../../components/RouterButton";

export const LIST_RESUMES_QUERY_KEY = ["listResumes"] as const;

const TOKEN_KEY = "cv-tool:id-token";

const searchSchema = z.object({
  employeeId: z.string().optional(),
});

export const Route = createFileRoute("/resumes/")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: ResumeListPage,
});

function ResumeListPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { employeeId } = useSearch({ strict: false }) as { employeeId?: string };

  const {
    data: resumes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: employeeId ? [...LIST_RESUMES_QUERY_KEY, employeeId] : LIST_RESUMES_QUERY_KEY,
    queryFn: () => orpc.listResumes(employeeId ? { employeeId } : {}),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("resume.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" component="h1">
          {t("resume.pageTitle")}
        </Typography>
        {employeeId && (
          <RouterButton
            variant="contained"
            to="/resumes/new"
            search={{ employeeId }}
          >
            {t("resume.addResume")}
          </RouterButton>
        )}
      </Box>

      {resumes && resumes.length === 0 ? (
        <Typography variant="body1">{t("resume.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("resume.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("resume.tableHeaderTitle")}</TableCell>
                <TableCell>{t("resume.tableHeaderLanguage")}</TableCell>
                <TableCell>{t("resume.tableHeaderMain")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resumes?.map((resume) => (
                <TableRow
                  key={resume.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    void navigate({ to: "/resumes/$id", params: { id: resume.id } })
                  }
                >
                  <TableCell>{resume.title}</TableCell>
                  <TableCell>
                    <Chip label={resume.language} size="small" />
                  </TableCell>
                  <TableCell>
                    {resume.isMain ? (
                      <Chip label={t("resume.mainBadge")} color="primary" size="small" />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

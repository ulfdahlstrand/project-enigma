/**
 * /resumes route — displays the list of resumes for the logged-in consultant.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Rendering: MUI Table components from @mui/material.
 * Styling: MUI sx prop only — no .css/.scss files, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { orpc } from "../../../orpc-client";
import RouterButton from "../../../components/RouterButton";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";
import { LoadingState, ErrorState, EmptyState } from "../../../components/feedback";

export const LIST_RESUMES_QUERY_KEY = ["listResumes"] as const;


const searchSchema = z.object({
  employeeId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/resumes/")({
  validateSearch: searchSchema,
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

  const { data: employee } = useQuery({
    queryKey: ["getEmployee", employeeId],
    queryFn: () => orpc.getEmployee({ id: employeeId! }),
    enabled: !!employeeId,
  });

  if (isLoading) return <LoadingState label={t("resume.loading")} />;
  if (isError) return <ErrorState message={t("resume.error")} />;

  return (
    <>
      <PageHeader
        title={t("resume.pageTitle")}
        breadcrumbs={[
          { label: t("nav.employees"), to: "/employees" },
          ...(employeeId ? [{ label: employee?.name ?? "…", to: `/employees/${employeeId}` }] : []),
        ]}
        chip={
          resumes && employeeId ? (
            <Chip label={t("resume.countLabel", { count: resumes.length })} size="small" />
          ) : undefined
        }
        actions={
          employeeId ? (
            <RouterButton variant="contained" to="/resumes/new" search={{ employeeId }}>
              {t("resume.addResume")}
            </RouterButton>
          ) : undefined
        }
      />
      <PageContent>
      {resumes && resumes.length === 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <EmptyState message={t("resume.empty")} />
          {employeeId && (
            <RouterButton variant="outlined" to="/resumes/new" search={{ employeeId }}>
              {t("resume.addResume")}
            </RouterButton>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("resume.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("resume.tableHeaderTitle")}</TableCell>
                <TableCell>{t("resume.tableHeaderLanguage")}</TableCell>
                <TableCell>{t("resume.tableHeaderMain")}</TableCell>
                <TableCell />
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
                  <TableCell align="right" sx={{ color: "text.disabled", width: 40 }}>
                    <ChevronRightIcon sx={{ display: "block" }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      </PageContent>
    </>
  );
}

/**
 * /cv route — displays the list of CVs for the logged-in consultant.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Rendering: MUI Table components from @mui/material.
 * Styling: MUI sx prop only — no .css/.scss files, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
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

export const LIST_CVS_QUERY_KEY = ["listCVs"] as const;

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/cv/")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: CvListPage,
});

function CvListPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const {
    data: cvs,
    isLoading,
    isError,
  } = useQuery({
    queryKey: LIST_CVS_QUERY_KEY,
    queryFn: () => orpc.listCVs({}),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("cv.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("cv.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {t("cv.pageTitle")}
      </Typography>

      {cvs && cvs.length === 0 ? (
        <Typography variant="body1">{t("cv.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("cv.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("cv.tableHeaderTitle")}</TableCell>
                <TableCell>{t("cv.tableHeaderLanguage")}</TableCell>
                <TableCell>{t("cv.tableHeaderMain")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cvs?.map((cv) => (
                <TableRow
                  key={cv.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    void navigate({ to: "/cv/$id", params: { id: cv.id } })
                  }
                >
                  <TableCell>{cv.title}</TableCell>
                  <TableCell>
                    <Chip label={cv.language} size="small" />
                  </TableCell>
                  <TableCell>
                    {cv.isMain ? (
                      <Chip label={t("cv.mainBadge")} color="primary" size="small" />
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

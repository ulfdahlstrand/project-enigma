import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
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
import { useSearch } from "@tanstack/react-router";

export const LIST_ASSIGNMENTS_QUERY_KEY = ["listAssignments"] as const;

const TOKEN_KEY = "cv-tool:id-token";

const searchSchema = z.object({
  employeeId: z.string().optional(),
});

export const Route = createFileRoute("/assignments/")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: AssignmentListPage,
});

function AssignmentListPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { employeeId } = useSearch({ strict: false }) as { employeeId?: string };

  const queryKey = employeeId
    ? [...LIST_ASSIGNMENTS_QUERY_KEY, employeeId]
    : LIST_ASSIGNMENTS_QUERY_KEY;

  const { data: assignments, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => orpc.listAssignments(employeeId ? { employeeId } : {}),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("assignment.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("assignment.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" component="h1">
          {t("assignment.pageTitle")}
        </Typography>
        <RouterButton
          variant="contained"
          to="/assignments/new"
          search={employeeId ? { employeeId } : {}}
        >
          {t("assignment.addAssignment")}
        </RouterButton>
      </Box>

      {assignments && assignments.length === 0 ? (
        <Typography variant="body1">{t("assignment.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("assignment.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("assignment.tableHeaderClient")}</TableCell>
                <TableCell>{t("assignment.tableHeaderRole")}</TableCell>
                <TableCell>{t("assignment.tableHeaderStart")}</TableCell>
                <TableCell>{t("assignment.tableHeaderCurrent")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments?.map((assignment) => (
                <TableRow
                  key={assignment.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    void navigate({ to: "/assignments/$id", params: { id: assignment.id } })
                  }
                >
                  <TableCell>{assignment.clientName}</TableCell>
                  <TableCell>{assignment.role}</TableCell>
                  <TableCell>
                    {typeof assignment.startDate === "string"
                      ? assignment.startDate.slice(0, 10)
                      : assignment.startDate instanceof Date
                        ? assignment.startDate.toISOString().slice(0, 10)
                        : ""}
                  </TableCell>
                  <TableCell>
                    {assignment.isCurrent ? (
                      <Chip label={t("assignment.tableHeaderCurrent")} color="success" size="small" />
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

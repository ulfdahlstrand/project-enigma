/**
 * /employee route — displays the full list of employees fetched from the backend.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Rendering: MUI Table components from @mui/material.
 * Styling: MUI sx prop only — no .css/.scss imports, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { orpc } from "../orpc-client";

export const Route = createFileRoute("/employee")({
  component: EmployeePage,
});

function EmployeePage() {
  const { t } = useTranslation("common");

  const {
    data: employees,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["listEmployees"],
    queryFn: () => orpc.listEmployees(),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("employee.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("employee.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("employee.pageTitle")}
      </Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        {t("employee.pageDescription")}
      </Typography>

      {employees && employees.length === 0 ? (
        <Typography variant="body1">{t("employee.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("employee.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("employee.tableHeaderName")}</TableCell>
                <TableCell>{t("employee.tableHeaderEmail")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees?.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

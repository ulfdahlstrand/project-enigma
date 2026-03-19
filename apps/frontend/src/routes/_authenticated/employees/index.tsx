/**
 * /employees route — full employee list.
 *
 * Data fetching: TanStack Query + oRPC.
 * Styling: MUI sx prop only.
 * i18n: all text via useTranslation("common").
 */
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
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
import { orpc } from "../../../orpc-client";
import { PageHeader } from "../../../components/layout/PageHeader";

export const LIST_EMPLOYEES_QUERY_KEY = ["listEmployees"] as const;


export const Route = createFileRoute("/_authenticated/employees/")({
  component: EmployeePage,
});

function EmployeePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const { data: employees, isLoading, isError } = useQuery({
    queryKey: LIST_EMPLOYEES_QUERY_KEY,
    queryFn: () => orpc.listEmployees({}),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress aria-label={t("employee.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t("employee.error")}</Alert>
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title={t("employee.pageTitle")}
        actions={
          <Button variant="contained" component={Link} to="/employees/new">
            {t("employee.addPerson")}
          </Button>
        }
      />
      <Box sx={{ p: 3 }}>
        {employees && employees.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            {t("employee.empty")}
          </Typography>
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
                  <TableRow
                    key={employee.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() =>
                      void navigate({ to: "/employees/$id", params: { id: employee.id } })
                    }
                  >
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </>
  );
}

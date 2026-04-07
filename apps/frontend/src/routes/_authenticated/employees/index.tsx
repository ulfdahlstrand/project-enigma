/**
 * /employees route — full employee list.
 *
 * Data fetching: TanStack Query + oRPC.
 * Styling: MUI sx prop only.
 * i18n: all text via useTranslation("common").
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";
import { ConsultantAvatar } from "../../../components/ConsultantAvatar";
import { orpc } from "../../../orpc-client";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";
import { LoadingState, ErrorState, EmptyState } from "../../../components/feedback";

export const LIST_EMPLOYEES_QUERY_KEY = ["listEmployees"] as const;

export const Route = createFileRoute("/_authenticated/employees/")({
  component: EmployeePage,
});

function EmployeePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: employees, isLoading, isError } = useQuery({
    queryKey: LIST_EMPLOYEES_QUERY_KEY,
    queryFn: () => orpc.listEmployees({}),
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  if (isLoading) return <LoadingState label={t("employee.loading")} />;
  if (isError) return <ErrorState message={t("employee.error")} />;

  const count = employees?.length ?? 0;

  return (
    <>
      <PageHeader
        title={t("employee.pageTitle")}
        chip={
          count > 0 ? (
            <Chip
              label={t("employee.countLabel", { count })}
              size="small"
              variant="outlined"
            />
          ) : undefined
        }
        actions={
          <Button variant="contained" component={Link} to="/employees/new">
            {t("employee.addPerson")}
          </Button>
        }
      />
      <PageContent>
        {employees && employees.length === 0 ? (
          <EmptyState message={t("employee.empty")} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              size="small"
              placeholder={t("employee.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ maxWidth: 320 }}
            />
            <TableContainer component={Paper}>
              <Table aria-label={t("employee.pageTitle")}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 48 }} />
                    <TableCell>{t("employee.tableHeaderName")}</TableCell>
                    <TableCell>{t("employee.tableHeaderEmail")}</TableCell>
                    <TableCell sx={{ width: 40 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() =>
                        void navigate({ to: "/employees/$id", params: { id: employee.id } })
                      }
                    >
                      <TableCell>
                        <ConsultantAvatar
                          name={employee.name}
                          profileImageDataUrl={employee.profileImageDataUrl}
                          size={32}
                          fontSize={13}
                        />
                      </TableCell>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell align="right">
                        <ChevronRightIcon sx={{ color: "text.disabled", display: "block" }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </PageContent>
    </>
  );
}

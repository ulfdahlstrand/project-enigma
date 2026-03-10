import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { orpc } from "../orpc-client";

export const Route = createFileRoute("/employee_/$employeeId")({
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { t } = useTranslation("common");
  const { employeeId } = Route.useParams();

  const { data: employee, isLoading, isError } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => orpc.getEmployee({ id: employeeId }),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("employee.detail.loading")} />
      </Box>
    );
  }

  if (isError || !employee) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("employee.detail.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Button component={Link} to="/employee" variant="outlined" sx={{ mb: 3 }}>
        {t("employee.detail.back")}
      </Button>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {employee.name}
      </Typography>
      <Typography variant="body1" sx={{ mb: 1 }}>
        {t("employee.tableHeaderEmail")}: {employee.email}
      </Typography>
    </Box>
  );
}

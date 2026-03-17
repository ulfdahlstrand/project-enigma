/**
 * /employee/:id route — displays and allows editing of a single employee's details.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Mutation: TanStack Query useMutation + oRPC client for updating the employee.
 * Cache invalidation: invalidates both getEmployee and listEmployees query keys on success.
 * Styling: MUI sx prop only — no .css/.scss imports, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, redirect, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import { LIST_EMPLOYEES_QUERY_KEY } from "./new";

/**
 * Query key factory for a single employee lookup.
 * Exported so tests can assert against the exact key structure.
 */
export const getEmployeeQueryKey = (id: string) =>
  ["getEmployee", id] as const;

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/employee/$id")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const queryKey = getEmployeeQueryKey(id);

  const {
    data: employee,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => orpc.getEmployee({ id }),
    retry: false,
  });

  // Sync local form state when the query resolves
  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setEmail(employee.email);
    }
  }, [employee]);

  const mutation = useMutation({
    mutationFn: (input: { name: string; email: string }) =>
      orpc.updateEmployee({ id, ...input }),
    onSuccess: async () => {
      setSaveError(false);
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: LIST_EMPLOYEES_QUERY_KEY,
      });
    },
    onError: () => {
      setSaveSuccess(false);
      setSaveError(true);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(false);
    mutation.mutate({ name: name.trim(), email: email.trim() });
  };

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("employee.detail.loading")} />
      </Box>
    );
  }

  // Not-found or other error state
  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    if (isNotFound) {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">
            {t("employee.detail.notFound")}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("employee.detail.saveError")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h4" component="h1">
          {t("employee.detail.pageTitle")}
        </Typography>
        <Button
          variant="outlined"
          component={Link}
          to="/resumes"
          search={{ employeeId: id }}
        >
          {t("employee.detail.viewResumes")}
        </Button>
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("employee.detail.saveSuccess")}
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.detail.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("employee.detail.nameLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={t("employee.detail.emailLabel")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          disabled={mutation.isPending}
          aria-label={t("employee.detail.saveButton")}
        >
          {t("employee.detail.saveButton")}
        </Button>
      </Box>
    </Box>
  );
}

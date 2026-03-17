/**
 * /employees/:id route — displays and allows editing of a single employee's details.
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
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

export const Route = createFileRoute("/employees/$id")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: EmployeeDetailPage,
});

const editEmployeeFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeFormSchema>;

function EmployeeDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const queryClient = useQueryClient();

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

  const { register, handleSubmit, reset } = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (employee) {
      reset({ name: employee.name, email: employee.email });
    }
  }, [employee, reset]);

  const mutation = useMutation({
    mutationFn: (input: EditEmployeeFormValues) =>
      orpc.updateEmployee({ id, name: input.name.trim(), email: input.email.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: LIST_EMPLOYEES_QUERY_KEY,
      });
    },
  });

  const onSubmit = (data: EditEmployeeFormValues) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("employee.detail.loading")} />
      </Box>
    );
  }

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

      {mutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("employee.detail.saveSuccess")}
        </Alert>
      )}

      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.detail.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("employee.detail.nameLabel")}
          {...register("name")}
          required
          fullWidth
        />
        <TextField
          label={t("employee.detail.emailLabel")}
          type="email"
          {...register("email")}
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

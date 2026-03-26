/**
 * /employees/new route — form for creating a new employee record.
 *
 * Data mutation: TanStack Query useMutation + oRPC client (no direct fetch/axios).
 * Styling: MUI sx prop only — no .css/.scss imports, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 *
 * The LIST_EMPLOYEES_QUERY_KEY constant is exported so that both the list page
 * (queryKey definition) and this form (cache invalidation on success) reference
 * the same value — per the architectural requirement for query key co-location.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { orpc } from "../../../orpc-client";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";

/**
 * Co-located query key for the listEmployees query.
 * Exported so the employee list page imports this constant instead of
 * duplicating the string.
 */
export const LIST_EMPLOYEES_QUERY_KEY = ["listEmployees"] as const;


export const Route = createFileRoute("/_authenticated/employees/new")({
  component: NewEmployeePage,
});

function NewEmployeePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const newEmployeeFormSchema = z.object({
    name: z.string().min(1, t("employee.new.nameRequired")),
    email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, t("employee.new.emailInvalid")),
  });

  type NewEmployeeFormValues = z.infer<typeof newEmployeeFormSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<NewEmployeeFormValues>({
    resolver: zodResolver(newEmployeeFormSchema),
    defaultValues: { name: "", email: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: NewEmployeeFormValues) =>
      orpc.createEmployee({ name: input.name.trim(), email: input.email.trim() }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: LIST_EMPLOYEES_QUERY_KEY });
      await navigate({ to: "/employees/$id", params: { id: data.id } });
    },
  });

  const onSubmit = (data: NewEmployeeFormValues) => {
    mutation.mutate(data);
  };

  return (
    <>
      <PageHeader
        title={t("employee.new.pageTitle")}
        breadcrumbs={[{ label: t("nav.employees"), to: "/employees" }]}
      />
      <PageContent>
        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("employee.new.apiError")}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 480 }}
        >
          <TextField
            label={t("employee.new.nameLabel")}
            {...register("name")}
            error={!!errors.name}
            helperText={errors.name?.message ?? ""}
            required
            fullWidth
          />
          <TextField
            label={t("employee.new.emailLabel")}
            type="email"
            {...register("email")}
            error={!!errors.email}
            helperText={errors.email?.message ?? ""}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            sx={{ alignSelf: "flex-start" }}
          >
            {t("employee.new.saveButton")}
          </Button>
        </Box>
      </PageContent>
    </>
  );
}

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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
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

export const getEducationQueryKey = (employeeId: string) =>
  ["listEducation", employeeId] as const;

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

const addEducationFormSchema = z.object({
  type: z.enum(["degree", "certification", "language"]),
  value: z.string().min(1),
});

type AddEducationFormValues = z.infer<typeof addEducationFormSchema>;

function EmployeeDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const queryKey = getEmployeeQueryKey(id);
  const educationQueryKey = getEducationQueryKey(id);

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

  const { data: educationList = [] } = useQuery({
    queryKey: educationQueryKey,
    queryFn: () => orpc.listEducation({ employeeId: id }),
    enabled: !!employee,
  });

  const { register, handleSubmit, reset } = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (employee) {
      reset({
        name: employee.name,
        email: employee.email,
      });
    }
  }, [employee, reset]);

  const mutation = useMutation({
    mutationFn: (input: EditEmployeeFormValues) =>
      orpc.updateEmployee({
        id,
        name: input.name.trim(),
        email: input.email.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: LIST_EMPLOYEES_QUERY_KEY,
      });
    },
  });

  const {
    register: registerEducation,
    handleSubmit: handleSubmitEducation,
    control: educationControl,
    reset: resetEducation,
    formState: { isSubmitting: isAddingEducation },
  } = useForm<AddEducationFormValues>({
    resolver: zodResolver(addEducationFormSchema),
    defaultValues: { type: "degree", value: "" },
  });

  const createEducationMutation = useMutation({
    mutationFn: (data: AddEducationFormValues) =>
      orpc.createEducation({ employeeId: id, type: data.type, value: data.value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: educationQueryKey });
      resetEducation();
    },
  });

  const deleteEducationMutation = useMutation({
    mutationFn: (educationId: string) =>
      orpc.deleteEducation({ id: educationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: educationQueryKey });
    },
  });

  const onSubmit = (data: EditEmployeeFormValues) => {
    mutation.mutate(data);
  };

  const onAddEducation = (data: AddEducationFormValues) => {
    createEducationMutation.mutate(data);
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

  const degrees = educationList.filter((e) => e.type === "degree");
  const certifications = educationList.filter((e) => e.type === "certification");
  const languages = educationList.filter((e) => e.type === "language");

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h4" component="h1">
          {t("employee.detail.pageTitle")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            component={Link}
            to="/employees/$id/import"
            params={{ id }}
          >
            {t("employee.detail.importCvButton")}
          </Button>
          <Button
            variant="outlined"
            component={Link}
            to="/resumes"
            search={{ employeeId: id }}
          >
            {t("employee.detail.viewResumes")}
          </Button>
        </Box>
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

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" gutterBottom>
        {t("employee.detail.educationHeading")}
      </Typography>

      {createEducationMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.detail.educationAddError")}
        </Alert>
      )}
      {deleteEducationMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.detail.educationDeleteError")}
        </Alert>
      )}

      {([
        { key: "degree", label: t("employee.detail.educationDegrees"), entries: degrees },
        { key: "certification", label: t("employee.detail.educationCertifications"), entries: certifications },
        { key: "language", label: t("employee.detail.educationLanguages"), entries: languages },
      ] as const).map(({ key, label, entries }) => (
        <Box key={key} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            {label}
          </Typography>
          {entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("employee.detail.educationEmpty")}
            </Typography>
          ) : (
            entries.map((entry) => (
              <Box
                key={entry.id}
                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
              >
                <Typography variant="body2">{entry.value}</Typography>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  disabled={deleteEducationMutation.isPending}
                  onClick={() => deleteEducationMutation.mutate(entry.id)}
                  aria-label={t("employee.detail.educationDeleteButton")}
                >
                  {t("employee.detail.educationDeleteButton")}
                </Button>
              </Box>
            ))
          )}
        </Box>
      ))}

      <Box
        component="form"
        onSubmit={handleSubmitEducation(onAddEducation)}
        noValidate
        sx={{ display: "flex", gap: 1, mt: 1, alignItems: "flex-start" }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="education-type-label">
            {t("employee.detail.educationTypeLabel")}
          </InputLabel>
          <Controller
            name="type"
            control={educationControl}
            render={({ field }) => (
              <Select
                labelId="education-type-label"
                label={t("employee.detail.educationTypeLabel")}
                {...field}
              >
                <MenuItem value="degree">{t("employee.detail.educationTypeDegree")}</MenuItem>
                <MenuItem value="certification">{t("employee.detail.educationTypeCertification")}</MenuItem>
                <MenuItem value="language">{t("employee.detail.educationTypeLanguage")}</MenuItem>
              </Select>
            )}
          />
        </FormControl>
        <TextField
          label={t("employee.detail.educationValueLabel")}
          {...registerEducation("value")}
          size="small"
          sx={{ flex: 1 }}
        />
        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={isAddingEducation || createEducationMutation.isPending}
          aria-label={t("employee.detail.educationAddButton")}
          sx={{ mt: 0.5 }}
        >
          {t("employee.detail.educationAddButton")}
        </Button>
      </Box>
    </Box>
  );
}

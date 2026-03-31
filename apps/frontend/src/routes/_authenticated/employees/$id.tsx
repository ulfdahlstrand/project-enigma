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
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { orpc } from "../../../orpc-client";
import RouterButton from "../../../components/RouterButton";
import { LIST_EMPLOYEES_QUERY_KEY } from "./new";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";
import { LoadingState, ErrorState } from "../../../components/feedback";

export const getEmployeeQueryKey = (id: string) =>
  ["getEmployee", id] as const;

export const getEducationQueryKey = (employeeId: string) =>
  ["listEducation", employeeId] as const;

export const Route = createFileRoute("/_authenticated/employees/$id")({
  component: EmployeeDetailPage,
});

const editEmployeeFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeFormSchema>;
type EducationType = "degree" | "certification" | "language";

function EmployeeDetailPage() {
  const { t } = useTranslation("common");
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const queryKey = getEmployeeQueryKey(id);
  const educationQueryKey = getEducationQueryKey(id);

  const [addingToSection, setAddingToSection] = useState<EducationType | null>(null);
  const [newEntryValue, setNewEntryValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moreActionsAnchorEl, setMoreActionsAnchorEl] = useState<HTMLElement | null>(null);

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
    if (employee) reset({ name: employee.name, email: employee.email });
  }, [employee, reset]);

  const mutation = useMutation({
    mutationFn: (input: EditEmployeeFormValues) =>
      orpc.updateEmployee({ id, name: input.name.trim(), email: input.email.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: LIST_EMPLOYEES_QUERY_KEY });
    },
  });

  const createEducationMutation = useMutation({
    mutationFn: (data: { type: EducationType; value: string }) =>
      orpc.createEducation({ employeeId: id, type: data.type, value: data.value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: educationQueryKey });
      setAddingToSection(null);
      setNewEntryValue("");
    },
  });

  const deleteEducationMutation = useMutation({
    mutationFn: (educationId: string) => orpc.deleteEducation({ id: educationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: educationQueryKey });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: () => orpc.deleteEmployee({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: LIST_EMPLOYEES_QUERY_KEY });
      void navigate({ to: "/employees" });
    },
  });

  const commitAdd = (type: EducationType) => {
    if (!newEntryValue.trim()) return;
    createEducationMutation.mutate({ type, value: newEntryValue.trim() });
  };

  if (isLoading) return <LoadingState label={t("employee.detail.loading")} />;

  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    return <ErrorState message={isNotFound ? t("employee.detail.notFound") : t("employee.detail.saveError")} />;
  }

  const degrees = educationList.filter((e) => e.type === "degree");
  const certifications = educationList.filter((e) => e.type === "certification");
  const languages = educationList.filter((e) => e.type === "language");

  const educationSections: { type: EducationType; label: string; entries: typeof educationList }[] = [
    { type: "degree", label: t("employee.detail.educationDegrees"), entries: degrees },
    { type: "certification", label: t("employee.detail.educationCertifications"), entries: certifications },
    { type: "language", label: t("employee.detail.educationLanguages"), entries: languages },
  ];

  return (
    <>
      <PageHeader
        title={employee?.name ?? ""}
        breadcrumbs={[{ label: t("nav.employees"), to: "/employees" }]}
        actions={
          <>
            <RouterButton variant="outlined" to="/employees/$id/import" params={{ id }}>
              {t("employee.detail.importCvButton")}
            </RouterButton>
            <Button
              type="submit"
              form="employee-identity-form"
              variant="contained"
              disabled={mutation.isPending}
              aria-label={t("employee.detail.saveButton")}
            >
              {t("employee.detail.saveButton")}
            </Button>
            <IconButton
              aria-label={t("employee.detail.moreActionsLabel")}
              onClick={(event) => setMoreActionsAnchorEl(event.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
          </>
        }
      />
      <PageContent>
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

        {/* Two-column body */}
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {/* Left — identity form */}
        <Box sx={{ width: 560, flexShrink: 0 }}>
          <Box
            id="employee-identity-form"
            component="form"
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
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
          </Box>
        </Box>

        {/* Right — education */}
        <Box sx={{ flex: 1, minWidth: 320 }}>
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

          {educationSections.map(({ type, label, entries }) => (
            <Box key={type} sx={{ mb: 2.5 }}>
              {/* Section header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  bgcolor: "action.hover",
                  px: 1.5,
                  py: 0.75,
                  mb: 1,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, letterSpacing: "0.06em", flex: 1 }}
                >
                  {label.toUpperCase()}
                </Typography>
                <Tooltip title={t("employee.detail.educationAddButton")}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.25 }}
                    onClick={() => {
                      setAddingToSection(type);
                      setNewEntryValue("");
                    }}
                  >
                    <AddIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Entries */}
              {entries.length === 0 && addingToSection !== type && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                  {t("employee.detail.educationEmpty")}
                </Typography>
              )}
              {entries.map((entry) => (
                <Box
                  key={entry.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 0.5,
                    px: 0.5,
                  }}
                >
                  <Typography variant="body2">{entry.value}</Typography>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={deleteEducationMutation.isPending}
                    onClick={() => deleteEducationMutation.mutate(entry.id)}
                    aria-label={t("employee.detail.educationDeleteButton")}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}

              {/* Inline add input */}
              {addingToSection === type && (
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.5, px: 0.5 }}>
                  <TextField
                    value={newEntryValue}
                    onChange={(e) => setNewEntryValue(e.target.value)}
                    size="small"
                    autoFocus
                    fullWidth
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitAdd(type);
                      if (e.key === "Escape") setAddingToSection(null);
                    }}
                    sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem", py: 0.75 } }}
                  />
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => commitAdd(type)}
                    disabled={!newEntryValue.trim() || createEducationMutation.isPending}
                  >
                    <CheckIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => setAddingToSection(null)}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Box>
        </Box>
      </PageContent>
      <Menu
        anchorEl={moreActionsAnchorEl}
        open={Boolean(moreActionsAnchorEl)}
        onClose={() => setMoreActionsAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setMoreActionsAnchorEl(null);
            setDeleteDialogOpen(true);
          }}
        >
          {t("employee.detail.deleteButton")}
        </MenuItem>
      </Menu>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("employee.detail.deleteDialog.title")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: deleteEmployeeMutation.isError ? 2 : 0 }}>
            {t("employee.detail.deleteDialog.message", { name: employee?.name ?? "" })}
          </Typography>
          {deleteEmployeeMutation.isError && (
            <Alert severity="error">{t("employee.detail.deleteDialog.error")}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteEmployeeMutation.isPending}>
            {t("employee.detail.deleteDialog.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteEmployeeMutation.mutate()}
            disabled={deleteEmployeeMutation.isPending}
          >
            {deleteEmployeeMutation.isPending
              ? t("employee.detail.deleteDialog.deleting")
              : t("employee.detail.deleteDialog.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

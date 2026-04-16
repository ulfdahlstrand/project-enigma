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
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { orpc } from "../../../orpc-client";
import RouterButton from "../../../components/RouterButton";
import { LIST_EMPLOYEES_QUERY_KEY } from "./new";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";
import { LoadingState, ErrorState } from "../../../components/feedback";
import { prepareProfileImages } from "../../../lib/profile-image";
import { EmployeeDeleteDialog } from "./detail/EmployeeDeleteDialog";
import {
  EmployeeEducationSection,
  type EducationType,
} from "./detail/EmployeeEducationSection";
import {
  EmployeeIdentityForm,
  type EmployeeIdentityFormValues,
} from "./detail/EmployeeIdentityForm";

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
  const [profileImageDataUrl, setProfileImageDataUrl] = useState<string | null>(null);
  const [profileImageOriginalDataUrl, setProfileImageOriginalDataUrl] = useState<string | null>(null);

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

  const { register, handleSubmit, reset } = useForm<EmployeeIdentityFormValues>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (employee) {
      reset({ name: employee.name, email: employee.email });
      setProfileImageDataUrl(employee.profileImageDataUrl);
      setProfileImageOriginalDataUrl(employee.profileImageOriginalDataUrl);
    }
  }, [employee, reset]);

  const mutation = useMutation({
    mutationFn: (input: EmployeeIdentityFormValues) =>
      orpc.updateEmployee({
        id,
        name: input.name.trim(),
        email: input.email.trim(),
        profileImageDataUrl,
        profileImageOriginalDataUrl,
      }),
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
    mutationFn: (educationId: string) => orpc.deleteEducation({ employeeId: id, id: educationId }),
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

  const handleProfileImageSelected = async (file: File | null) => {
    if (!file) return;
    const nextImages = await prepareProfileImages(file);
    setProfileImageDataUrl(nextImages.displayDataUrl);
    setProfileImageOriginalDataUrl(nextImages.originalDataUrl);
  };

  const handleProfileImageRemoved = () => {
    setProfileImageDataUrl(null);
    setProfileImageOriginalDataUrl(null);
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

  const educationSections = [
    {
      type: "degree" as const,
      label: t("employee.detail.educationDegrees"),
      entries: educationList.filter((entry) => entry.type === "degree"),
    },
    {
      type: "certification" as const,
      label: t("employee.detail.educationCertifications"),
      entries: educationList.filter((entry) => entry.type === "certification"),
    },
    {
      type: "language" as const,
      label: t("employee.detail.educationLanguages"),
      entries: educationList.filter((entry) => entry.type === "language"),
    },
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

        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <EmployeeIdentityForm
            employeeName={employee?.name ?? ""}
            profileImageDataUrl={profileImageDataUrl}
            register={register}
            handleSubmit={handleSubmit}
            onSubmit={(values) => mutation.mutate(values)}
            onProfileImageSelected={(file) => void handleProfileImageSelected(file)}
            onProfileImageRemoved={handleProfileImageRemoved}
          />

          <EmployeeEducationSection
            sections={educationSections}
            addingToSection={addingToSection}
            newEntryValue={newEntryValue}
            createError={createEducationMutation.isError}
            deleteError={deleteEducationMutation.isError}
            isDeleting={deleteEducationMutation.isPending}
            isCreating={createEducationMutation.isPending}
            onStartAdd={(type) => {
              setAddingToSection(type);
              setNewEntryValue("");
            }}
            onCancelAdd={() => setAddingToSection(null)}
            onCommitAdd={commitAdd}
            onEntryValueChange={setNewEntryValue}
            onDeleteEntry={(entryId) => deleteEducationMutation.mutate(entryId)}
          />
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
      <EmployeeDeleteDialog
        open={deleteDialogOpen}
        employeeName={employee?.name ?? ""}
        isDeleting={deleteEmployeeMutation.isPending}
        hasError={deleteEmployeeMutation.isError}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteEmployeeMutation.mutate()}
      />
    </>
  );
}

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
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../orpc-client";
import { LIST_ASSIGNMENTS_QUERY_KEY } from ".";
import { ImproveDescriptionButton } from "../../../components/ImproveDescriptionButton";

export const getAssignmentQueryKey = (id: string) =>
  ["getAssignment", id] as const;


export const Route = createFileRoute("/_authenticated/assignments/$id")({
  component: AssignmentDetailPage,
});

const editAssignmentFormSchema = z.object({
  clientName: z.string().min(1),
  role: z.string().min(1),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  technologiesRaw: z.string(),
  keywords: z.string(),
});

type EditAssignmentFormValues = z.infer<typeof editAssignmentFormSchema>;

function AssignmentDetailPage() {
  const { t } = useTranslation("common");
  const { id: idParam } = useParams({ strict: false });
  const id = idParam!;
  const queryClient = useQueryClient();

  const queryKey = getAssignmentQueryKey(id);

  const { data: assignment, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => orpc.getAssignment({ id }),
    retry: false,
  });

  const { register, handleSubmit, reset, control, setValue, watch } = useForm<EditAssignmentFormValues>({
    resolver: zodResolver(editAssignmentFormSchema),
    defaultValues: {
      clientName: "",
      role: "",
      description: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      technologiesRaw: "",
      keywords: "",
    },
  });

  const watchedDescription = watch("description");
  const watchedRole = watch("role");
  const watchedClientName = watch("clientName");

  useEffect(() => {
    if (assignment) {
      reset({
        clientName: assignment.clientName,
        role: assignment.role,
        description: assignment.description,
        startDate:
          typeof assignment.startDate === "string"
            ? assignment.startDate.slice(0, 10)
            : assignment.startDate instanceof Date
              ? assignment.startDate.toISOString().slice(0, 10)
              : "",
        endDate: assignment.endDate
          ? typeof assignment.endDate === "string"
            ? assignment.endDate.slice(0, 10)
            : assignment.endDate instanceof Date
              ? assignment.endDate.toISOString().slice(0, 10)
              : ""
          : "",
        isCurrent: assignment.isCurrent,
        technologiesRaw: assignment.technologies.join(", "),
        keywords: assignment.keywords ?? "",
      });
    }
  }, [assignment, reset]);

  const mutation = useMutation({
    mutationFn: (data: EditAssignmentFormValues) => {
      const technologies = data.technologiesRaw
        .split(",")
        .map((tech) => tech.trim())
        .filter(Boolean);
      return orpc.updateAssignment({
        id,
        clientName: data.clientName.trim(),
        role: data.role.trim(),
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate || null,
        isCurrent: data.isCurrent,
        technologies,
        keywords: data.keywords.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: LIST_ASSIGNMENTS_QUERY_KEY });
    },
  });

  const onSubmit = (data: EditAssignmentFormValues) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("assignment.detail.loading")} />
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
          <Typography variant="body1">{t("assignment.detail.notFound")}</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("assignment.detail.saveError")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 560 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h4" component="h1">
          {assignment?.clientName}
        </Typography>
        <Button variant="outlined" component={Link} to="/assignments">
          {t("assignment.detail.back")}
        </Button>
      </Box>

      {mutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("assignment.detail.saveSuccess")}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("assignment.detail.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("assignment.detail.clientNameLabel")}
          {...register("clientName")}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.detail.roleLabel")}
          {...register("role")}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.detail.descriptionLabel")}
          {...register("description")}
          multiline
          minRows={4}
          fullWidth
        />
        <ImproveDescriptionButton
          assignmentId={id}
          description={watchedDescription}
          role={watchedRole}
          clientName={watchedClientName}
          onAccept={(improvedText) => setValue("description", improvedText)}
        />
        <TextField
          label={t("assignment.detail.startDateLabel")}
          type="date"
          {...register("startDate")}
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label={t("assignment.detail.endDateLabel")}
          type="date"
          {...register("endDate")}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label={t("assignment.detail.technologiesLabel")}
          {...register("technologiesRaw")}
          fullWidth
          placeholder="React, TypeScript, Node.js"
        />
        <TextField
          label={t("assignment.detail.keywordsLabel")}
          {...register("keywords")}
          fullWidth
        />
        <Controller
          name="isCurrent"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.value}
                  onChange={field.onChange}
                />
              }
              label={t("assignment.detail.isCurrentLabel")}
            />
          )}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={mutation.isPending}
          aria-label={t("assignment.detail.saveButton")}
        >
          {t("assignment.detail.saveButton")}
        </Button>
      </Box>
    </Box>
  );
}

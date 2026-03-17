import Button from "@mui/material/Button";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import RouterButton from "../../components/RouterButton";
import { LIST_ASSIGNMENTS_QUERY_KEY } from ".";
import { useSearch } from "@tanstack/react-router";

export const LIST_ASSIGNMENTS_NEW_QUERY_KEY = LIST_ASSIGNMENTS_QUERY_KEY;

const TOKEN_KEY = "cv-tool:id-token";

const searchSchema = z.object({
  employeeId: z.string().optional(),
  resumeId: z.string().optional(),
});

const newAssignmentFormSchema = z.object({
  clientName: z.string().min(1),
  role: z.string().min(1),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  technologiesRaw: z.string(),
  keywords: z.string(),
});

type NewAssignmentFormValues = z.infer<typeof newAssignmentFormSchema>;

export const Route = createFileRoute("/assignments/new")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: NewAssignmentPage,
});

function NewAssignmentPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { employeeId, resumeId } = useSearch({ strict: false }) as { employeeId?: string; resumeId?: string };

  const { register, handleSubmit, control } = useForm<NewAssignmentFormValues>({
    resolver: zodResolver(newAssignmentFormSchema),
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

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof orpc.createAssignment>[0]) =>
      orpc.createAssignment(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: LIST_ASSIGNMENTS_QUERY_KEY });
      void navigate({ to: "/assignments/$id", params: { id: data.id } });
    },
  });

  const onSubmit = (data: NewAssignmentFormValues) => {
    if (!employeeId) return;
    const technologies = data.technologiesRaw
      .split(",")
      .map((tech) => tech.trim())
      .filter(Boolean);
    mutation.mutate({
      employeeId,
      resumeId: resumeId ?? null,
      clientName: data.clientName.trim(),
      role: data.role.trim(),
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate || null,
      isCurrent: data.isCurrent,
      technologies,
      keywords: data.keywords.trim() || null,
    });
  };

  return (
    <Box sx={{ p: 2, maxWidth: 560 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {t("assignment.new.pageTitle")}
      </Typography>

      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("assignment.new.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("assignment.new.clientNameLabel")}
          {...register("clientName")}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.new.roleLabel")}
          {...register("role")}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.new.descriptionLabel")}
          {...register("description")}
          multiline
          minRows={4}
          fullWidth
        />
        <TextField
          label={t("assignment.new.startDateLabel")}
          type="date"
          {...register("startDate")}
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label={t("assignment.new.endDateLabel")}
          type="date"
          {...register("endDate")}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label={t("assignment.new.technologiesLabel")}
          {...register("technologiesRaw")}
          fullWidth
          placeholder="React, TypeScript, Node.js"
        />
        <TextField
          label={t("assignment.new.keywordsLabel")}
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
              label={t("assignment.new.isCurrentLabel")}
            />
          )}
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            aria-label={t("assignment.new.saveButton")}
          >
            {t("assignment.new.saveButton")}
          </Button>
          <RouterButton
            variant="outlined"
            to="/assignments"
            search={employeeId ? { employeeId } : {}}
            aria-label={t("assignment.new.cancel")}
          >
            {t("assignment.new.cancel")}
          </RouterButton>
        </Box>
      </Box>
    </Box>
  );
}

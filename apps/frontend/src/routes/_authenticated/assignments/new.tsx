import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../orpc-client";
import { useSearch } from "@tanstack/react-router";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";

const searchSchema = z.object({
  employeeId: z.string().optional(),
  resumeId: z.string().optional(),
  branchId: z.string().optional(),
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

export const Route = createFileRoute("/_authenticated/assignments/new")({
  validateSearch: searchSchema,
  component: NewAssignmentPage,
});

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ pt: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {children}
      </Typography>
      <Divider />
    </Box>
  );
}

function NewAssignmentPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { employeeId, resumeId, branchId } = useSearch({ strict: false }) as { employeeId?: string; resumeId?: string; branchId?: string };

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
    onSuccess: () => {
      if (branchId && resumeId) {
        void navigate({ to: "/resumes/$id", params: { id: resumeId }, search: { branchId } });
      } else if (resumeId) {
        void navigate({ to: "/resumes/$id", params: { id: resumeId } });
      }
    },
  });

  const onSubmit = (data: NewAssignmentFormValues) => {
    if (!employeeId || !branchId) return;
    const technologies = data.technologiesRaw
      .split(",")
      .map((tech) => tech.trim())
      .filter(Boolean);
    mutation.mutate({
      employeeId,
      branchId,
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

  const cancelTo = resumeId ? `/resumes/${resumeId}` : "/resumes";

  return (
    <>
      <PageHeader
        title={t("assignment.new.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          ...(resumeId ? [{ label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` }] : []),
        ]}
        actions={
          <Button
            type="submit"
            form="new-assignment-form"
            variant="contained"
            disabled={mutation.isPending}
            aria-label={t("assignment.new.saveButton")}
          >
            {t("assignment.new.saveButton")}
          </Button>
        }
      />
      <PageContent>
        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("assignment.new.saveError")}
          </Alert>
        )}

        <Box
          id="new-assignment-form"
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 560 }}
        >
          {resumeId && (
            <Typography variant="body2" color="text.secondary">
              {t("assignment.new.contextLabel")}
            </Typography>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <SectionHeading>{t("assignment.new.sectionClient")}</SectionHeading>
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
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <SectionHeading>{t("assignment.new.sectionPeriod")}</SectionHeading>
            <Box sx={{ display: "flex", gap: 2 }}>
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
            </Box>
            <Controller
              name="isCurrent"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={field.onChange} />}
                  label={t("assignment.new.isCurrentLabel")}
                />
              )}
            />
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <SectionHeading>{t("assignment.new.sectionContent")}</SectionHeading>
            <TextField
              label={t("assignment.new.descriptionLabel")}
              {...register("description")}
              multiline
              minRows={4}
              fullWidth
            />
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <SectionHeading>{t("assignment.new.sectionSkills")}</SectionHeading>
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
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              component={Link}
              to={cancelTo}
              variant="outlined"
              disabled={mutation.isPending}
            >
              {t("assignment.new.cancel")}
            </Button>
          </Box>
        </Box>
      </PageContent>
    </>
  );
}

/**
 * /resumes/$id/edit route — resume editor form (consultant title, presentation, summary).
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Mutation: TanStack Query useMutation + oRPC client for updating the resume.
 * Cache invalidation: invalidates getResume query key on success.
 * Styling: MUI sx prop only — no .css/.scss imports, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../orpc-client";
import { getResumeQueryKey } from "./$id";
import { SkillsEditor } from "../../../components/SkillsEditor";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";
import { LoadingState } from "../../../components/feedback";


const editResumeFormSchema = z.object({
  consultantTitle: z.string(),
  presentation: z.string(),
  summary: z.string(),
});

type EditResumeFormValues = z.infer<typeof editResumeFormSchema>;

export const Route = createFileRoute("/_authenticated/resumes/$id_/edit")({
  component: ResumeEditPage,
});

function ResumeEditPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();

  const queryKey = getResumeQueryKey(id);

  const {
    data: resume,
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: () => orpc.getResume({ id }),
    retry: false,
  });

  const { register, handleSubmit, reset } = useForm<EditResumeFormValues>({
    resolver: zodResolver(editResumeFormSchema),
    defaultValues: { consultantTitle: "", presentation: "", summary: "" },
  });

  useEffect(() => {
    if (resume) {
      reset({
        consultantTitle: resume.consultantTitle ?? "",
        presentation: resume.presentation.join("\n\n"),
        summary: resume.summary ?? "",
      });
    }
  }, [resume, reset]);

  const mutation = useMutation({
    mutationFn: (data: EditResumeFormValues) =>
      orpc.updateResume({
        id,
        consultantTitle: data.consultantTitle.trim() || null,
        presentation: data.presentation
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean),
        summary: data.summary,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const onSubmit = (data: EditResumeFormValues) => {
    mutation.mutate(data);
  };

  if (isLoading) return <LoadingState label={t("resume.edit.pageTitle")} />;

  return (
    <>
      <PageHeader
        title={t("resume.edit.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: resume?.title ?? "…", to: `/resumes/${id}` },
        ]}
        actions={
          <Button
            type="submit"
            form="resume-edit-form"
            variant="contained"
            disabled={mutation.isPending}
            aria-label={t("resume.edit.saveButton")}
          >
            {mutation.isPending ? t("resume.edit.saving") : t("resume.edit.saveButton")}
          </Button>
        }
      />
      <PageContent>
        {mutation.isSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {t("resume.edit.saveSuccess")}
          </Alert>
        )}

        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {t("resume.edit.saveError")}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                {t("resume.edit.profileHeading")}
              </Typography>
              <Box
                id="resume-edit-form"
                component="form"
                onSubmit={handleSubmit(onSubmit)}
                sx={{ display: "flex", flexDirection: "column", gap: 2 }}
              >
                <TextField
                  label={t("resume.edit.consultantTitleLabel")}
                  {...register("consultantTitle")}
                  fullWidth
                />
                <TextField
                  label={t("resume.edit.presentationLabel")}
                  helperText={t("resume.edit.presentationHelper")}
                  {...register("presentation")}
                  multiline
                  minRows={4}
                  fullWidth
                />
                <TextField
                  label={t("resume.edit.summaryLabel")}
                  {...register("summary")}
                  multiline
                  minRows={4}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                {t("resume.edit.skillsHeading")}
              </Typography>
              <SkillsEditor resumeId={id} skills={resume?.skills ?? []} queryKey={queryKey} />
            </CardContent>
          </Card>
        </Box>
      </PageContent>
    </>
  );
}


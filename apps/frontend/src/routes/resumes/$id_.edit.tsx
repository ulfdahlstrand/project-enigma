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
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import { orpc } from "../../orpc-client";
import { getResumeQueryKey } from "./$id";

const TOKEN_KEY = "cv-tool:id-token";

const editResumeFormSchema = z.object({
  consultantTitle: z.string(),
  presentation: z.string(),
  summary: z.string(),
});

type EditResumeFormValues = z.infer<typeof editResumeFormSchema>;

export const Route = createFileRoute("/resumes/$id_/edit")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: ResumeEditPage,
});

function ResumeEditPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
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

  const handleBack = () => {
    void navigate({ to: "/resumes/$id", params: { id } });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.edit.pageTitle")} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 720 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("resume.edit.pageTitle")}
      </Typography>

      {mutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("resume.edit.saveSuccess")}
        </Alert>
      )}

      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("resume.edit.saveError")}
        </Alert>
      )}

      <Box
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

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            aria-label={t("resume.edit.saveButton")}
          >
            {mutation.isPending ? t("resume.edit.saving") : t("resume.edit.saveButton")}
          </Button>
          <Button
            variant="outlined"
            onClick={handleBack}
            aria-label={t("resume.edit.backButton")}
          >
            {t("resume.edit.backButton")}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <SkillsEditor resumeId={id} skills={resume?.skills ?? []} queryKey={queryKey} />
    </Box>
  );
}

interface Skill {
  id: string;
  name: string;
  level: string | null;
  category: string | null;
}

interface SkillsEditorProps {
  resumeId: string;
  skills: Skill[];
  queryKey: readonly unknown[];
}

function SkillsEditor({ resumeId, skills, queryKey }: SkillsEditorProps) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [skillName, setSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [skillCategory, setSkillCategory] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () =>
      orpc.createResumeSkill({
        cvId: resumeId,
        name: skillName.trim(),
        level: skillLevel.trim() || null,
        category: skillCategory.trim() || null,
      }),
    onSuccess: async () => {
      setSkillName("");
      setSkillLevel("");
      setSkillCategory("");
      setAddError(null);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      setAddError(t("resume.edit.skillAddError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (skillId: string) => orpc.deleteResumeSkill({ id: skillId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleAdd = () => {
    if (!skillName.trim()) return;
    addMutation.mutate();
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        {t("resume.edit.skillsHeading")}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
        {skills.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("resume.detail.noSkills")}
          </Typography>
        ) : (
          skills.map((skill) => (
            <Box
              key={skill.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography sx={{ flex: 1, fontSize: "0.875rem" }}>{skill.name}</Typography>
              {skill.category && (
                <Typography variant="caption" color="text.secondary">
                  {skill.category}
                </Typography>
              )}
              {skill.level && (
                <Typography variant="caption" color="text.secondary">
                  {skill.level}
                </Typography>
              )}
              <IconButton
                size="small"
                aria-label={t("resume.edit.skillDeleteButton")}
                onClick={() => deleteMutation.mutate(skill.id)}
                disabled={deleteMutation.isPending}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))
        )}
      </Box>

      {addError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {addError}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
        <TextField
          label={t("resume.edit.skillNameLabel")}
          value={skillName}
          onChange={(e) => setSkillName(e.target.value)}
          size="small"
          sx={{ flex: "1 1 180px" }}
        />
        <TextField
          label={t("resume.edit.skillLevelLabel")}
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value)}
          size="small"
          sx={{ flex: "1 1 140px" }}
        />
        <TextField
          label={t("resume.edit.skillCategoryLabel")}
          value={skillCategory}
          onChange={(e) => setSkillCategory(e.target.value)}
          size="small"
          sx={{ flex: "1 1 140px" }}
        />
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!skillName.trim() || addMutation.isPending}
          size="medium"
        >
          {addMutation.isPending ? t("resume.edit.skillAdding") : t("resume.edit.skillAddButton")}
        </Button>
      </Box>
    </Box>
  );
}

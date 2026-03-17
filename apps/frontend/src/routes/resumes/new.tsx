import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSearch } from "@tanstack/react-router";
import { orpc } from "../../orpc-client";
import { LIST_RESUMES_QUERY_KEY } from ".";

const TOKEN_KEY = "cv-tool:id-token";

const searchSchema = z.object({
  employeeId: z.string().optional(),
});

const newResumeFormSchema = z.object({
  title: z.string().min(1),
  language: z.string().min(1),
});

type NewResumeFormValues = z.infer<typeof newResumeFormSchema>;

export const Route = createFileRoute("/resumes/new")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: NewResumePage,
});

function NewResumePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { employeeId } = useSearch({ strict: false }) as { employeeId?: string };

  const { register, handleSubmit, formState: { isSubmitting, isValid } } = useForm<NewResumeFormValues>({
    resolver: zodResolver(newResumeFormSchema),
    defaultValues: { title: "", language: "en" },
    mode: "onChange",
  });

  const mutation = useMutation({
    mutationFn: (data: NewResumeFormValues) =>
      orpc.createResume({
        employeeId: employeeId ?? "",
        title: data.title.trim(),
        language: data.language,
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: LIST_RESUMES_QUERY_KEY });
      void navigate({ to: "/resumes/$id", params: { id: data.id } });
    },
  });

  const onSubmit = (data: NewResumeFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {t("resume.new.pageTitle")}
      </Typography>

      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("resume.new.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("resume.new.titleLabel")}
          {...register("title")}
          required
          fullWidth
          autoFocus
        />
        <TextField
          label={t("resume.new.languageLabel")}
          {...register("language")}
          fullWidth
          placeholder="en"
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending || isSubmitting || !isValid}
            aria-label={t("resume.new.saveButton")}
          >
            {t("resume.new.saveButton")}
          </Button>
          <Button
            variant="outlined"
            component={Link}
            to="/resumes"
            search={employeeId ? { employeeId } : {}}
            aria-label={t("resume.new.cancel")}
          >
            {t("resume.new.cancel")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

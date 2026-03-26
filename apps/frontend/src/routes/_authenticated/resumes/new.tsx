import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useSearch } from "@tanstack/react-router";
import { orpc } from "../../../orpc-client";
import { LIST_RESUMES_QUERY_KEY } from ".";
import { PageHeader } from "../../../components/layout/PageHeader";
import { PageContent } from "../../../components/layout/PageContent";


const searchSchema = z.object({
  employeeId: z.string().optional(),
});

const newResumeFormSchema = z.object({
  title: z.string().min(1),
  language: z.string().min(1),
});

type NewResumeFormValues = z.infer<typeof newResumeFormSchema>;

export const Route = createFileRoute("/_authenticated/resumes/new")({
  validateSearch: searchSchema,
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
    <>
      <PageHeader
        title={t("resume.new.pageTitle")}
        breadcrumbs={[{ label: t("resume.pageTitle"), to: "/resumes" }]}
      />
      <PageContent>
        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("resume.new.saveError")}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 480 }}
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
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending || isSubmitting || !isValid}
            aria-label={t("resume.new.saveButton")}
            sx={{ alignSelf: "flex-start" }}
          >
            {t("resume.new.saveButton")}
          </Button>
        </Box>
      </PageContent>
    </>
  );
}

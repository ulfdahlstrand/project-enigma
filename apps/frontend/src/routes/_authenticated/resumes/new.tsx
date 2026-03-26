import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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

  const { data: employee } = useQuery({
    queryKey: ["getEmployee", employeeId],
    queryFn: () => orpc.getEmployee({ id: employeeId! }),
    enabled: !!employeeId,
  });

  const { register, handleSubmit, control, formState: { isSubmitting, isValid } } = useForm<NewResumeFormValues>({
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

  const cancelTo = employeeId ? `/resumes?employeeId=${employeeId}` : "/resumes";

  return (
    <>
      <PageHeader
        title={t("resume.new.pageTitle")}
        breadcrumbs={[
          { label: t("nav.employees"), to: "/employees" },
          ...(employeeId ? [{ label: employee?.name ?? "…", to: `/employees/${employeeId}` }] : []),
          { label: t("resume.pageTitle"), to: employeeId ? `/resumes?employeeId=${employeeId}` : "/resumes" },
        ]}
        actions={
          <Button
            type="submit"
            form="new-resume-form"
            variant="contained"
            disabled={mutation.isPending || isSubmitting || !isValid}
            aria-label={t("resume.new.saveButton")}
          >
            {t("resume.new.saveButton")}
          </Button>
        }
      />
      <PageContent>
        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("resume.new.saveError")}
          </Alert>
        )}

        <Box
          id="new-resume-form"
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 480 }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("resume.new.helperText")}
          </Typography>

          <TextField
            label={t("resume.new.titleLabel")}
            {...register("title")}
            required
            fullWidth
            autoFocus
          />

          <Controller
            name="language"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth required>
                <InputLabel id="language-label">{t("resume.new.languageLabel")}</InputLabel>
                <Select
                  labelId="language-label"
                  label={t("resume.new.languageLabel")}
                  value={field.value}
                  onChange={field.onChange}
                >
                  <MenuItem value="en">{t("resume.new.languageOptionEn")}</MenuItem>
                  <MenuItem value="sv">{t("resume.new.languageOptionSv")}</MenuItem>
                </Select>
              </FormControl>
            )}
          />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              component={Link}
              to={cancelTo}
              variant="outlined"
              disabled={mutation.isPending}
            >
              {t("resume.new.cancel")}
            </Button>
          </Box>
        </Box>
      </PageContent>
    </>
  );
}

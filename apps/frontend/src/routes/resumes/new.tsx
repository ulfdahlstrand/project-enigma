import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
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

  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [saveError, setSaveError] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      orpc.createResume({
        employeeId: employeeId ?? "",
        title: title.trim(),
        language,
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: LIST_RESUMES_QUERY_KEY });
      void navigate({ to: "/resumes/$id", params: { id: data.id } });
    },
    onError: () => {
      setSaveError(true);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError(false);
    mutation.mutate();
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {t("resume.new.pageTitle")}
      </Typography>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("resume.new.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("resume.new.titleLabel")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
          autoFocus
        />
        <TextField
          label={t("resume.new.languageLabel")}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          fullWidth
          placeholder="en"
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending || !title.trim()}
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

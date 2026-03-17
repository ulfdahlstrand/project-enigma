/**
 * /employees/new route — form for creating a new employee record.
 *
 * Data mutation: TanStack Query useMutation + oRPC client (no direct fetch/axios).
 * Styling: MUI sx prop only — no .css/.scss imports, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 *
 * The LIST_EMPLOYEES_QUERY_KEY constant is exported so that both the list page
 * (queryKey definition) and this form (cache invalidation on success) reference
 * the same value — per the architectural requirement for query key co-location.
 */
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";

/**
 * Co-located query key for the listEmployees query.
 * Exported so the employee list page imports this constant instead of
 * duplicating the string.
 */
export const LIST_EMPLOYEES_QUERY_KEY = ["listEmployees"] as const;

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/employees/new")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: NewEmployeePage,
});

function NewEmployeePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { name: string; email: string }) =>
      orpc.createEmployee(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: LIST_EMPLOYEES_QUERY_KEY });
      await navigate({ to: "/employees/$id", params: { id: data.id } });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Reset previous errors
    setNameError(null);
    setEmailError(null);

    let hasError = false;

    if (!name.trim()) {
      setNameError(t("employee.new.nameRequired"));
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setEmailError(t("employee.new.emailInvalid"));
      hasError = true;
    }

    if (hasError) {
      return;
    }

    mutation.mutate({ name: name.trim(), email: email.trim() });
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("employee.new.pageTitle")}
      </Typography>

      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.new.apiError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("employee.new.nameLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError !== null}
          helperText={nameError ?? ""}
          required
          fullWidth
        />
        <TextField
          label={t("employee.new.emailLabel")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError !== null}
          helperText={emailError ?? ""}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          disabled={mutation.isPending}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("employee.new.saveButton")}
        </Button>
      </Box>
    </Box>
  );
}

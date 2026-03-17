import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../orpc-client";
import { LIST_EMPLOYEES_QUERY_KEY } from "./employee";

export const Route = createFileRoute("/employee_/new")({
  component: NewEmployeePage,
});

function NewEmployeePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => orpc.createEmployee({ name, email }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_EMPLOYEES_QUERY_KEY });
      void navigate({ to: "/employee" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate();
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        {t("employee.new.pageTitle")}
      </Typography>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("employee.new.error")}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label={t("employee.tableHeaderName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
        />
        <TextField
          label={t("employee.tableHeaderEmail")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={isPending}
          >
            {isPending ? t("employee.new.saving") : t("employee.new.submit")}
          </Button>
          <Button
            variant="outlined"
            disabled={isPending}
            onClick={() => void navigate({ to: "/employee" })}
          >
            {t("employee.new.cancel")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

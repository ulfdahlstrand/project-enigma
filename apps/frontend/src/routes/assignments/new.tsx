import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import { LIST_ASSIGNMENTS_QUERY_KEY } from ".";
import { useSearch } from "@tanstack/react-router";

export const LIST_ASSIGNMENTS_NEW_QUERY_KEY = LIST_ASSIGNMENTS_QUERY_KEY;

const TOKEN_KEY = "cv-tool:id-token";

const searchSchema = z.object({
  employeeId: z.string().optional(),
});

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
  const { employeeId } = useSearch({ strict: false }) as { employeeId?: string };

  const [clientName, setClientName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof orpc.createAssignment>[0]) =>
      orpc.createAssignment(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: LIST_ASSIGNMENTS_QUERY_KEY });
      void navigate({ to: "/assignments/$id", params: { id: data.id } });
    },
    onError: () => {
      setSaveError(true);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError(false);
    if (!employeeId) return;
    mutation.mutate({
      employeeId,
      clientName: clientName.trim(),
      role: role.trim(),
      description: description.trim(),
      startDate,
      endDate: endDate || null,
      isCurrent,
      technologies: [],
    });
  };

  return (
    <Box sx={{ p: 2, maxWidth: 560 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        {t("assignment.new.pageTitle")}
      </Typography>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("assignment.new.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("assignment.new.clientNameLabel")}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.new.roleLabel")}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.new.descriptionLabel")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />
        <TextField
          label={t("assignment.new.startDateLabel")}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label={t("assignment.new.endDateLabel")}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
          }
          label={t("assignment.new.isCurrentLabel")}
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
          <Button
            variant="outlined"
            component={Link}
            to="/assignments"
            search={employeeId ? { employeeId } : {}}
            aria-label={t("assignment.new.cancel")}
          >
            {t("assignment.new.cancel")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

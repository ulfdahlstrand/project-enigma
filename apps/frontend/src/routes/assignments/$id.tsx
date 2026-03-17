import { createFileRoute, redirect, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import { LIST_ASSIGNMENTS_QUERY_KEY } from ".";

export const getAssignmentQueryKey = (id: string) =>
  ["getAssignment", id] as const;

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/assignments/$id")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: AssignmentDetailPage,
});

function AssignmentDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const [clientName, setClientName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const queryKey = getAssignmentQueryKey(id);

  const { data: assignment, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => orpc.getAssignment({ id }),
    retry: false,
  });

  useEffect(() => {
    if (assignment) {
      setClientName(assignment.clientName);
      setRole(assignment.role);
      setDescription(assignment.description);
      setStartDate(
        typeof assignment.startDate === "string"
          ? assignment.startDate.slice(0, 10)
          : assignment.startDate instanceof Date
            ? assignment.startDate.toISOString().slice(0, 10)
            : ""
      );
      setEndDate(
        assignment.endDate
          ? typeof assignment.endDate === "string"
            ? assignment.endDate.slice(0, 10)
            : assignment.endDate instanceof Date
              ? assignment.endDate.toISOString().slice(0, 10)
              : ""
          : ""
      );
      setIsCurrent(assignment.isCurrent);
    }
  }, [assignment]);

  const mutation = useMutation({
    mutationFn: (input: { clientName: string; role: string; description: string; startDate: string; endDate: string | null; isCurrent: boolean }) =>
      orpc.updateAssignment({ id, ...input }),
    onSuccess: async () => {
      setSaveError(false);
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: LIST_ASSIGNMENTS_QUERY_KEY });
    },
    onError: () => {
      setSaveSuccess(false);
      setSaveError(true);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(false);
    mutation.mutate({
      clientName: clientName.trim(),
      role: role.trim(),
      description: description.trim(),
      startDate,
      endDate: endDate || null,
      isCurrent,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("assignment.detail.loading")} />
      </Box>
    );
  }

  if (isError) {
    const isNotFound =
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "NOT_FOUND";

    if (isNotFound) {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">{t("assignment.detail.notFound")}</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("assignment.detail.saveError")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 560 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h4" component="h1">
          {assignment?.clientName}
        </Typography>
        <Button variant="outlined" component={Link} to="/assignments">
          {t("assignment.detail.back")}
        </Button>
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("assignment.detail.saveSuccess")}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("assignment.detail.saveError")}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <TextField
          label={t("assignment.detail.clientNameLabel")}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.detail.roleLabel")}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={t("assignment.detail.descriptionLabel")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />
        <TextField
          label={t("assignment.detail.startDateLabel")}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label={t("assignment.detail.endDateLabel")}
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
          label={t("assignment.detail.isCurrentLabel")}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={mutation.isPending}
          aria-label={t("assignment.detail.saveButton")}
        >
          {t("assignment.detail.saveButton")}
        </Button>
      </Box>
    </Box>
  );
}

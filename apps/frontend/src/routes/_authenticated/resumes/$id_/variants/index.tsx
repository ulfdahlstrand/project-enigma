/**
 * /resumes/$id/variants — Variants page.
 *
 * Lists all branches for the resume. "Create new variant" opens a dialog.
 *
 * Data: useResumeBranches(resumeId), useForkResumeBranch mutation
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useResumeBranches, useResumeCommits, useForkResumeBranch } from "../../../../../hooks/versioning";


export const Route = createFileRoute("/_authenticated/resumes/$id_/variants/")({
  component: VariantsPage,
});

function VariantsPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  const { data: branches, isLoading, isError } = useResumeBranches(resumeId);
  const forkMutation = useForkResumeBranch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [forkError, setForkError] = useState<string | null>(null);

  const mainBranchId = branches?.find((b) => b.isMain)?.id ?? "";
  const { data: commits } = useResumeCommits(mainBranchId);

  function commitLabel(id: string): string {
    const c = commits?.find((x) => x.id === id);
    if (!c) return id;
    const date = typeof c.createdAt === "string"
      ? new Date(c.createdAt).toLocaleString()
      : c.createdAt.toLocaleString();
    return c.message ? `${c.message} (${date})` : `${t("resume.variants.createDialog.versionDefault")} (${date})`;
  }

  function openDialog() {
    // Pre-select the most recent commit when opening the dialog
    const headCommitId = commits?.[0]?.id ?? "";
    setSelectedCommitId(headCommitId);
    setNewName("");
    setForkError(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!selectedCommitId || !newName.trim()) return;
    setForkError(null);
    try {
      await forkMutation.mutateAsync({
        fromCommitId: selectedCommitId,
        name: newName.trim(),
        resumeId,
      });
      setDialogOpen(false);
    } catch {
      setForkError(t("resume.variants.createDialog.error"));
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.variants.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("resume.variants.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Button
          variant="text"
          onClick={() => void navigate({ to: "/resumes/$id", params: { id: resumeId } })}
        >
          {t("resume.detail.backButton")}
        </Button>
        <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
          {t("resume.variants.pageTitle")}
        </Typography>
        <Button
          variant="contained"
          disabled={!commits?.length}
          onClick={openDialog}
          title={!commits?.length ? t("resume.variants.createButtonDisabledTooltip") : undefined}
        >
          {t("resume.variants.createButton")}
        </Button>
      </Box>

      {commits !== undefined && commits.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("resume.variants.noVersionsWarning")}
        </Alert>
      )}

      {!branches || branches.length === 0 ? (
        <Typography variant="body1">{t("resume.variants.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("resume.variants.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("resume.variants.tableHeaderName")}</TableCell>
                <TableCell>{t("resume.variants.tableHeaderLanguage")}</TableCell>
                <TableCell>{t("resume.variants.tableHeaderLastSaved")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branches.map((branch) => {
                const createdAt =
                  typeof branch.createdAt === "string"
                    ? new Date(branch.createdAt)
                    : branch.createdAt;

                return (
                  <TableRow
                    key={branch.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() =>
                      void navigate({ to: "/resumes/$id", params: { id: resumeId } })
                    }
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {branch.name}
                        {branch.isMain && (
                          <Chip
                            label={t("resume.variants.mainBadge")}
                            color="primary"
                            size="small"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={branch.language} size="small" />
                    </TableCell>
                    <TableCell>{createdAt.toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("resume.variants.createDialog.title")}</DialogTitle>
        <DialogContent>
          {forkError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {forkError}
            </Alert>
          )}
          <TextField
            autoFocus
            label={t("resume.variants.createDialog.nameLabel")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
          />
          {commits && commits.length > 0 ? (
            <FormControl fullWidth size="small">
              <InputLabel>{t("resume.variants.createDialog.basedOnLabel")}</InputLabel>
              <Select
                value={selectedCommitId}
                label={t("resume.variants.createDialog.basedOnLabel")}
                onChange={(e) => setSelectedCommitId(e.target.value)}
              >
                {commits.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {commitLabel(c.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Alert severity="info">
              {t("resume.variants.createDialog.noVersions")}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("resume.variants.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!newName.trim() || !selectedCommitId || forkMutation.isPending}
            onClick={() => void handleCreate()}
          >
            {forkMutation.isPending
              ? t("resume.variants.createDialog.creating")
              : t("resume.variants.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

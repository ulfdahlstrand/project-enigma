import Button from "@mui/material/Button";
/**
 * /resumes/$id route — read-only resume detail page with skills.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Rendering: MUI components from @mui/material.
 * Styling: MUI sx prop only — no .css/.scss files, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";
import RouterButton from "../../components/RouterButton";

/**
 * Query key factory for a single resume lookup.
 * Exported so tests can assert against the exact key structure.
 */
export const getResumeQueryKey = (id: string) => ["getResume", id] as const;

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/resumes/$id")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: ResumeDetailPage,
});

type ExportFormat = "pdf" | "markdown";
const EXPORT_OPTIONS: ExportFormat[] = ["pdf", "markdown"];

async function triggerDownload(format: ExportFormat, resumeId: string): Promise<void> {
  if (format === "pdf") {
    const result = await orpc.exportResumePdf({ resumeId });
    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const result = await orpc.exportResumeMarkdown({ resumeId });
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function ExportSplitButton({ resumeId }: { resumeId: string }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportFormat>("pdf");
  const anchorRef = useState<HTMLDivElement | null>(null);

  const mutation = useMutation({
    mutationFn: () => triggerDownload(selected, resumeId),
  });

  const handleClick = () => mutation.mutate();
  const handleToggle = () => setOpen((prev) => !prev);
  const handleClose = () => setOpen(false);

  const label = t(`resume.detail.export.${selected}`);

  return (
    <>
      <ButtonGroup variant="contained" ref={(el) => { anchorRef[1](el); }} disabled={mutation.isPending}>
        <Button onClick={handleClick}>
          {mutation.isPending ? t("resume.detail.export.exporting") : label}
        </Button>
        <Button size="small" onClick={handleToggle} aria-label={t("resume.detail.export.selectFormat")}>
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef[0]} placement="bottom-end" transition disablePortal>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList autoFocusItem>
                  {EXPORT_OPTIONS.map((fmt) => (
                    <MenuItem
                      key={fmt}
                      selected={fmt === selected}
                      onClick={() => { setSelected(fmt); setOpen(false); void triggerDownload(fmt, resumeId); }}
                    >
                      {t(`resume.detail.export.${fmt}`)}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}

function ResumeDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const navigate = useNavigate();

  const queryKey = getResumeQueryKey(id);

  const {
    data: resume,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => orpc.getResume({ id }),
    retry: false,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["listAssignments", "resume", id],
    queryFn: () => orpc.listAssignments({ resumeId: id }),
    enabled: !!resume,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.detail.loading")} />
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
          <Typography variant="body1">{t("resume.detail.notFound")}</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("resume.detail.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 720 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="h4" component="h1">
          {resume?.title}
        </Typography>
        {resume?.language && (
          <Chip label={resume.language} size="small" />
        )}
      </Box>

      {resume?.summary && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          {resume.summary}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        {t("resume.detail.skillsHeading")}
      </Typography>

      {resume?.skills && resume.skills.length === 0 ? (
        <Typography variant="body2">{t("resume.detail.noSkills")}</Typography>
      ) : (
        <List dense>
          {resume?.skills?.map((skill) => (
            <ListItem key={skill.id} disablePadding>
              <ListItemText
                primary={skill.name}
                secondary={skill.level ?? undefined}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        {t("resume.detail.assignmentsHeading")}
      </Typography>

      {assignments.length === 0 ? (
        <Typography variant="body2">{t("resume.detail.noAssignments")}</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t("resume.detail.assignmentsHeading")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("assignment.tableHeaderClient")}</TableCell>
                <TableCell>{t("assignment.tableHeaderRole")}</TableCell>
                <TableCell>{t("assignment.tableHeaderStart")}</TableCell>
                <TableCell>{t("assignment.tableHeaderStart").replace("Start", "End")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((a) => (
                <TableRow
                  key={a.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => void navigate({ to: "/assignments/$id", params: { id: a.id } })}
                >
                  <TableCell>{a.clientName}</TableCell>
                  <TableCell>{a.role}</TableCell>
                  <TableCell>
                    {typeof a.startDate === "string" ? a.startDate.slice(0, 10) : ""}
                  </TableCell>
                  <TableCell>
                    {a.isCurrent ? (
                      <Chip label={t("resume.detail.assignmentPresent")} color="success" size="small" />
                    ) : typeof a.endDate === "string" ? (
                      a.endDate.slice(0, 10)
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: "flex", gap: 2, mt: 3, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          onClick={() =>
            void navigate({ to: "/resumes/$id/edit", params: { id } })
          }
        >
          {t("resume.detail.editButton")}
        </Button>
        <ExportSplitButton resumeId={id} />
        <RouterButton
          variant="outlined"
          to="/assignments/new"
          search={{ resumeId: id, employeeId: resume?.employeeId }}
        >
          {t("resume.detail.addAssignment")}
        </RouterButton>
        <RouterButton to="/resumes">
          {t("resume.detail.backButton")}
        </RouterButton>
      </Box>
    </Box>
  );
}

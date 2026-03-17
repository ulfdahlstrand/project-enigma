/**
 * /resumes/$id route — read-only resume detail page with skills.
 *
 * Data fetching: TanStack Query useQuery + oRPC client (no direct fetch/axios).
 * Rendering: MUI components from @mui/material.
 * Styling: MUI sx prop only — no .css/.scss files, no style={{ }} props.
 * i18n: all visible text via useTranslation("common") — no plain string literals
 *       as direct JSX children.
 */
import { createFileRoute, Link, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { orpc } from "../../orpc-client";

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

      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Button
          variant="contained"
          onClick={() =>
            void navigate({ to: "/resumes/$id/edit", params: { id } })
          }
        >
          {t("resume.detail.editButton")}
        </Button>
        <Button
          variant="outlined"
          component={Link}
          to="/assignments/new"
          search={{ resumeId: id, employeeId: resume?.employeeId }}
        >
          {t("resume.detail.addAssignment")}
        </Button>
        <Button component={Link} to="/resumes">
          {t("resume.detail.backButton")}
        </Button>
      </Box>
    </Box>
  );
}

/**
 * /cv/$id route — read-only CV detail page with skills.
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
 * Query key factory for a single CV lookup.
 * Exported so tests can assert against the exact key structure.
 */
export const getCVQueryKey = (id: string) => ["getCV", id] as const;

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/cv/$id")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: CvDetailPage,
});

function CvDetailPage() {
  const { t } = useTranslation("common");
  const { id } = useParams({ from: Route.fullPath });
  const navigate = useNavigate();

  const queryKey = getCVQueryKey(id);

  const {
    data: cv,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => orpc.getCV({ id }),
    retry: false,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("cv.detail.loading")} />
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
          <Typography variant="body1">{t("cv.detail.notFound")}</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("cv.detail.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 720 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="h4" component="h1">
          {cv?.title}
        </Typography>
        {cv?.language && (
          <Chip label={cv.language} size="small" />
        )}
      </Box>

      {cv?.summary && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          {cv.summary}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        {t("cv.detail.skillsHeading")}
      </Typography>

      {cv?.skills && cv.skills.length === 0 ? (
        <Typography variant="body2">{t("cv.detail.noSkills")}</Typography>
      ) : (
        <List dense>
          {cv?.skills?.map((skill) => (
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
            void navigate({ to: "/cv/$id/edit", params: { id } })
          }
        >
          {t("cv.detail.editButton")}
        </Button>
        <Button component={Link} to="/cv">
          {t("cv.detail.backButton")}
        </Button>
      </Box>
    </Box>
  );
}

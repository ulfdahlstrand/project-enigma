/**
 * Index route — home page at "/".
 *
 * Shows a welcome header and action cards for the two main app areas:
 * Employees and Resumes.
 */
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/layout/PageHeader";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation("common");

  return (
    <>
      <PageHeader title={t("home.welcome")} />
      <Box sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {t("home.subtitle")}
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined">
              <CardActionArea component={Link} to="/employees">
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("home.employeesCard.title")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("home.employeesCard.description")}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined">
              <CardActionArea component={Link} to="/resumes">
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("home.resumesCard.title")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("home.resumesCard.description")}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}

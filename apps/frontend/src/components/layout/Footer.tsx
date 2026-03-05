/**
 * Footer component — rendered at the bottom of every page via BaseLayout.
 *
 * Uses MUI Box and Typography as layout primitives. All user-facing strings
 * are retrieved via useTranslation() from the shared translation namespace.
 * Styling is applied exclusively via MUI sx prop — no inline style objects
 * or imported CSS files.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        mt: "auto",
        textAlign: "center",
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {t("footer.copyright")}
      </Typography>
    </Box>
  );
}

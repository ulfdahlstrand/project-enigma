/**
 * LoadingState — centered spinner for full-page loading states.
 *
 * Usage:
 *   if (isLoading) return <LoadingState label={t("resume.loading")} />;
 */
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
      <CircularProgress aria-label={label} />
    </Box>
  );
}

/**
 * ErrorState — full-page error alert.
 *
 * Usage:
 *   if (isError) return <ErrorState message={t("resume.error")} />;
 */
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <Box sx={{ py: 4, px: 3 }}>
      <Alert severity="error">{message}</Alert>
    </Box>
  );
}

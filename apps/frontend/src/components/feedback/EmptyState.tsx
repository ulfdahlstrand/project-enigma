/**
 * EmptyState — message shown when a list has no items.
 *
 * Usage:
 *   if (items.length === 0) return <EmptyState message={t("resume.empty")} />;
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

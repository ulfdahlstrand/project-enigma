import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface DiffStatsBadgeProps {
  plusCount: number;
  minusCount: number;
  isLoading?: boolean;
  /** "small" = inline monospace badge (table rows, tooltips).
   *  "medium" = h6-sized display (compare page header). */
  size?: "small" | "medium";
}

export function DiffStatsBadge({
  plusCount,
  minusCount,
  isLoading = false,
  size = "small",
}: DiffStatsBadgeProps) {
  if (isLoading) {
    return (
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ fontFamily: "monospace" }}
      >
        …
      </Typography>
    );
  }

  if (plusCount === 0 && minusCount === 0) return null;

  if (size === "medium") {
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        {plusCount > 0 && (
          <Typography variant="h6" color="success.main">
            +{plusCount}
          </Typography>
        )}
        {minusCount > 0 && (
          <Typography variant="h6" color="error.main">
            -{minusCount}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", gap: 0.5, fontFamily: "monospace", fontSize: "0.7rem" }}
    >
      {plusCount > 0 && (
        <Box component="span" sx={{ color: "success.main" }}>
          +{plusCount}
        </Box>
      )}
      {minusCount > 0 && (
        <Box component="span" sx={{ color: "error.main" }}>
          -{minusCount}
        </Box>
      )}
    </Box>
  );
}

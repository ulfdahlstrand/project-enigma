import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

interface ResumeHeaderChipProps {
  isRevisionOpen: boolean;
  activeBranchName: string;
  language: string | null;
  revisionModeLabel: string;
}

export function ResumeHeaderChip({
  isRevisionOpen,
  activeBranchName,
  language,
  revisionModeLabel,
}: ResumeHeaderChipProps) {
  if (isRevisionOpen) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Chip size="small" color="primary" label={revisionModeLabel} />
        <Chip size="small" variant="outlined" label={activeBranchName} />
        {language ? <Chip label={language.toUpperCase()} size="small" /> : null}
      </Box>
    );
  }

  return language ? <Chip label={language.toUpperCase()} size="small" /> : null;
}

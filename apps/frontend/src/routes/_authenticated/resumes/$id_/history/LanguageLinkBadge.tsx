import type { MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";

interface LanguageLinkBadgeProps {
  tag: CommitTagWithLinkedResume;
  /** The current resume being viewed; used to pick the "other side" of the tag. */
  currentResumeId: string;
  /** When true the badge shows a warning colour indicating the translation is out of sync. */
  isStale?: boolean;
}

/**
 * Small badge that links from a commit in the current resume to the
 * corresponding commit in the other-language resume via a CommitTag.
 *
 * Rendering logic: whichever side of the tag does NOT match
 * `currentResumeId` is the "linked" side and what we navigate to.
 *
 * Dumb component — no filter logic, no query; accepts tag data via props.
 */
export function LanguageLinkBadge({ tag, currentResumeId, isStale = false }: LanguageLinkBadgeProps) {
  const navigate = useNavigate();

  const linkedSide =
    tag.source.resumeId === currentResumeId ? tag.target : tag.source;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
    void navigate({
      to: "/resumes/$id",
      params: { id: linkedSide.resumeId },
      hash: linkedSide.commitId,
    });
  }

  const chip = (
    <Chip
      data-testid="language-link-badge"
      data-linked-resume-id={linkedSide.resumeId}
      data-linked-commit-id={linkedSide.commitId}
      size="small"
      clickable
      label={
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {isStale && <WarningAmberIcon sx={{ fontSize: 10, color: "warning.main" }} />}
          <span>{linkedSide.language.toUpperCase()}</span>
          <ArrowForwardIcon sx={{ fontSize: 10 }} />
        </Box>
      }
      onClick={handleClick}
      sx={{
        height: 20,
        fontSize: "0.6875rem",
        cursor: "pointer",
        "& .MuiChip-label": { px: 0.75 },
        ...(isStale && {
          borderColor: "warning.main",
          color: "warning.dark",
        }),
      }}
    />
  );

  if (!isStale) return chip;

  return (
    <Tooltip title={`${linkedSide.language.toUpperCase()} translation is out of sync`} arrow>
      <span>{chip}</span>
    </Tooltip>
  );
}

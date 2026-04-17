import type { MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Chip from "@mui/material/Chip";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";

interface LanguageLinkBadgeProps {
  tag: CommitTagWithLinkedResume;
  /** The current resume being viewed; used to pick the "other side" of the tag. */
  currentResumeId: string;
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
export function LanguageLinkBadge({ tag, currentResumeId }: LanguageLinkBadgeProps) {
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

  return (
    <Chip
      data-testid="language-link-badge"
      data-linked-resume-id={linkedSide.resumeId}
      data-linked-commit-id={linkedSide.commitId}
      size="small"
      clickable
      label={linkedSide.language.toUpperCase()}
      icon={<ArrowForwardIcon sx={{ fontSize: 12 }} />}
      onClick={handleClick}
      sx={{ height: 20, fontSize: "0.6875rem", cursor: "pointer" }}
    />
  );
}

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { GraphBranch } from "./history-graph-utils";

interface HistoryBranchSidebarProps {
  branches: GraphBranch[];
  selectedBranchId: string;
  onSelect: (branchId: string) => void;
  onArchive: (branchId: string, isArchived: boolean) => void;
}

export function HistoryBranchSidebar({
  branches,
  selectedBranchId,
  onSelect,
  onArchive,
}: HistoryBranchSidebarProps) {
  const { t } = useTranslation("common");
  const listRef = useRef<HTMLUListElement | null>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[role='option']");
    if (!items || items.length === 0) return;

    const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      prev?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const focused = items[currentIndex];
      if (focused) {
        const branchId = focused.getAttribute("data-branch-id");
        if (branchId) onSelect(branchId);
      }
    }
  }

  return (
    <Paper
      variant="outlined"
      data-testid="history-branch-sidebar"
      sx={{ width: 220, flexShrink: 0, overflow: "auto", maxHeight: "100%" }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 2, pt: 1.5, pb: 0.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        {t("resume.history.branchLabel")}
      </Typography>
      <Box
        component="ul"
        ref={listRef}
        role="listbox"
        aria-label={t("resume.history.branchLabel")}
        onKeyDown={handleKeyDown}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {branches.map((branch) => {
          const isSelected = branch.id === selectedBranchId;
          return (
            <Box
              key={branch.id}
              component="li"
              sx={{
                display: "flex",
                alignItems: "center",
                px: 1,
                py: 0.25,
                gap: 0.5,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box
                component="div"
                role="option"
                aria-selected={isSelected}
                data-branch-id={branch.id}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelect(branch.id)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  cursor: "pointer",
                  borderRadius: 1,
                  px: 1,
                  py: 0.75,
                  color: isSelected ? "primary.main" : "text.primary",
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: "0.875rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  bgcolor: isSelected ? "action.selected" : "transparent",
                  userSelect: "none",
                  "&:focus-visible": {
                    outline: 2,
                    outlineColor: "primary.main",
                    outlineOffset: -2,
                  },
                }}
              >
                {branch.name}
              </Box>
              {!branch.isMain && (
                <Tooltip
                  title={
                    branch.isArchived
                      ? t("resume.history.unarchiveBranch", { defaultValue: "Unarchive" })
                      : t("resume.history.archiveBranch", { defaultValue: "Archive" })
                  }
                >
                  <IconButton
                    size="small"
                    aria-label={branch.isArchived ? "unarchive" : "archive"}
                    onClick={() => onArchive(branch.id, !branch.isArchived)}
                    sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                  >
                    {branch.isArchived ? <UnarchiveIcon fontSize="inherit" /> : <ArchiveIcon fontSize="inherit" />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

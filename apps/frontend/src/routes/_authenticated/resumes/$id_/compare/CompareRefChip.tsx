/**
 * CompareRefChip — compact inline chip trigger for selecting one side of the
 * compare range. Opens a menu with branches and commits grouped under
 * subheaders. Replaces the former BranchTreePicker popover on the compare page
 * for a lighter workbench-style interaction.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

export interface CompareRefBranchOption {
  id: string;
  name: string;
  headCommitId: string | null;
  isMain: boolean;
  isArchived: boolean;
  createdAt?: string | Date | null;
}

export interface CompareRefCommitOption {
  id: string;
  title: string | null;
  createdAt: string | Date | null;
  parentCommitId?: string | null;
  createdBy?: string | null;
}

interface CompareRefChipProps {
  label: string;
  value: string;
  branches: CompareRefBranchOption[];
  commits: CompareRefCommitOption[];
  onSelect: (ref: string) => void;
}

function formatCommitDate(createdAt: string | Date | null): string {
  if (!createdAt) return "";
  return new Date(createdAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function commitShort(commit: CompareRefCommitOption): string {
  const date = formatCommitDate(commit.createdAt);
  if (commit.title) {
    return date ? `${commit.title} (${date})` : commit.title;
  }
  return date || commit.id.slice(0, 8);
}

function branchShort(branch: CompareRefBranchOption): string {
  return branch.name;
}

export function CompareRefChip({
  label,
  value,
  branches,
  commits,
  onSelect,
}: CompareRefChipProps) {
  const { t } = useTranslation("common");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const selectedBranch = branches.find((branch) => branch.name === value);
  const selectedCommit = !selectedBranch
    ? commits.find((commit) => commit.id === value)
    : undefined;

  const activeLabel = selectedBranch
    ? branchShort(selectedBranch)
    : selectedCommit
      ? commitShort(selectedCommit)
      : t("resume.compare.selectPlaceholder");

  const visibleBranches = branches.filter((branch) => !branch.isArchived);

  function handleSelect(ref: string) {
    setAnchor(null);
    onSelect(ref);
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Typography variant="caption" color="text.secondary" component="span">
        {label}
      </Typography>
      <Button
        aria-label={label}
        onClick={(event) => setAnchor(event.currentTarget)}
        endIcon={
          <KeyboardArrowDownIcon sx={{ fontSize: "0.8em !important", ml: "-2px" }} />
        }
        size="small"
        disableRipple
        sx={{
          typography: "caption",
          color: "text.primary",
          fontWeight: 500,
          px: 1,
          py: 0,
          height: 28,
          minWidth: 0,
          maxWidth: 320,
          background: "transparent",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          textTransform: "none",
          letterSpacing: "inherit",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          "&:hover": {
            background: (theme) => theme.palette.action.hover,
            borderColor: "text.disabled",
          },
          "& .MuiButton-endIcon": { ml: 0.25, mr: "-2px", color: "text.disabled" },
        }}
      >
        {activeLabel}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { elevation: 3, sx: { mt: 0.5, maxHeight: 420 } } }}
      >
        <ListSubheader disableSticky sx={{ lineHeight: "28px" }}>
          {t("resume.compare.branchGroupLabel")}
        </ListSubheader>
        {visibleBranches.map((branch) => (
          <MenuItem
            key={`branch-${branch.id}`}
            dense
            selected={branch.name === value}
            disabled={!branch.headCommitId}
            onClick={() => handleSelect(branch.name)}
          >
            {branchShort(branch)}
          </MenuItem>
        ))}
        <Divider />
        <ListSubheader disableSticky sx={{ lineHeight: "28px" }}>
          {t("resume.compare.commitGroupLabel")}
        </ListSubheader>
        {commits.map((commit) => (
          <MenuItem
            key={`commit-${commit.id}`}
            dense
            selected={commit.id === value}
            onClick={() => handleSelect(commit.id)}
          >
            {commitShort(commit)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

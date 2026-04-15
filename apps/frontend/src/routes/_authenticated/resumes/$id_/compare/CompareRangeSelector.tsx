/**
 * CompareRangeSelector — two branch/commit dropdowns with a swap button.
 * Lets the user pick the "from" and "to" sides of the diff.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useTranslation } from "react-i18next";

interface BranchOption {
  id: string;
  name: string;
  headCommitId: string | null;
}

interface CommitOption {
  id: string;
}

interface CompareRangeSelectorProps {
  baseRef: string;
  compareRef: string;
  branchOptions: BranchOption[];
  commitOptions: CommitOption[];
  branchLabel: (name: string) => string;
  commitLabel: (id: string) => string;
  onBaseChange: (value: string) => void;
  onCompareChange: (value: string) => void;
  onSwap: () => void;
}

export function CompareRangeSelector({
  baseRef,
  compareRef,
  branchOptions,
  commitOptions,
  branchLabel,
  commitLabel,
  onBaseChange,
  onCompareChange,
  onSwap,
}: CompareRangeSelectorProps) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
      <FormControl sx={{ minWidth: 320 }} size="small">
        <InputLabel>{t("resume.compare.fromLabel")}</InputLabel>
        <Select
          value={baseRef}
          label={t("resume.compare.fromLabel")}
          onChange={(event) => onBaseChange(event.target.value)}
        >
          <MenuItem value="">
            <em>{t("resume.compare.selectPlaceholder")}</em>
          </MenuItem>
          <ListSubheader>{t("resume.compare.branchGroupLabel")}</ListSubheader>
          {branchOptions.map((branch) => (
            <MenuItem
              key={`branch-${branch.id}`}
              value={branch.name}
              disabled={!branch.headCommitId}
            >
              {branchLabel(branch.name)}
            </MenuItem>
          ))}
          <ListSubheader>{t("resume.compare.commitGroupLabel")}</ListSubheader>
          {commitOptions.map((commit) => (
            <MenuItem key={commit.id} value={commit.id}>
              {commitLabel(commit.id)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <IconButton
        onClick={onSwap}
        aria-label={t("resume.compare.swapButton")}
        size="small"
        sx={{ alignSelf: "center", mb: 0.5 }}
      >
        <SwapHorizIcon />
      </IconButton>

      <FormControl sx={{ minWidth: 320 }} size="small">
        <InputLabel>{t("resume.compare.toLabel")}</InputLabel>
        <Select
          value={compareRef}
          label={t("resume.compare.toLabel")}
          onChange={(event) => onCompareChange(event.target.value)}
        >
          <MenuItem value="">
            <em>{t("resume.compare.selectPlaceholder")}</em>
          </MenuItem>
          <ListSubheader>{t("resume.compare.branchGroupLabel")}</ListSubheader>
          {branchOptions.map((branch) => (
            <MenuItem
              key={`branch-${branch.id}-compare`}
              value={branch.name}
              disabled={!branch.headCommitId}
            >
              {branchLabel(branch.name)}
            </MenuItem>
          ))}
          <ListSubheader>{t("resume.compare.commitGroupLabel")}</ListSubheader>
          {commitOptions.map((commit) => (
            <MenuItem key={`${commit.id}-compare`} value={commit.id}>
              {commitLabel(commit.id)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

/**
 * SkillsListView — numbered category list with up/down reordering,
 * inline rename, and per-row delete. Alternative to the detail view
 * shown inside SkillsEditor.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import { SkillsAddCategoryForm } from "../SkillsAddCategoryForm";
import type { SkillRow } from "../SkillsEditor";

interface CategoryEntry {
  id: string;
  category: string;
  skills: SkillRow[];
}

interface MutationLike {
  isPending: boolean;
  mutate: (
    input: { id: string; name: string },
    options?: { onSuccess?: () => void },
  ) => void;
}

interface SkillsListViewProps {
  sortedCategories: CategoryEntry[];
  isReordering: boolean;
  editingGroupId: string | null;
  editGroupName: string;
  updateGroupMutation: MutationLike;
  addingCategory: boolean;
  newCategoryName: string;
  newCategorySkillName: string;
  addMutationPending: boolean;
  onEditGroupNameChange: (value: string) => void;
  onStartEditingGroup: (groupId: string, currentName: string) => void;
  onStopEditingGroup: () => void;
  onStartConfirmDelete: (groupId: string) => void;
  onMoveCategory: (index: number, direction: "up" | "down") => void;
  onCategoryNameChange: (value: string) => void;
  onSkillNameChange: (value: string) => void;
  onCommitAddCategory: () => void;
  onCancelAddCategory: () => void;
  onStartAddingCategory: () => void;
}

export function SkillsListView(props: SkillsListViewProps) {
  const { t } = useTranslation("common");
  const {
    sortedCategories,
    isReordering,
    editingGroupId,
    editGroupName,
    updateGroupMutation,
    addingCategory,
    newCategoryName,
    newCategorySkillName,
    addMutationPending,
    onEditGroupNameChange,
    onStartEditingGroup,
    onStopEditingGroup,
    onStartConfirmDelete,
    onMoveCategory,
    onCategoryNameChange,
    onSkillNameChange,
    onCommitAddCategory,
    onCancelAddCategory,
    onStartAddingCategory,
  } = props;

  const commitGroupRename = (groupId: string) => {
    const trimmed = editGroupName.trim();
    if (!trimmed) return;
    updateGroupMutation.mutate(
      { id: groupId, name: trimmed },
      { onSuccess: onStopEditingGroup },
    );
  };

  return (
    <Box sx={{ position: "relative" }}>
      {isReordering && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {sortedCategories.map((group, index) => (
          <Box key={group.id}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, opacity: isReordering ? 0.5 : 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 24, color: "text.disabled" }}>
                {index + 1}
              </Typography>
              <Box sx={{ flex: 1, bgcolor: "action.hover", px: 1.5, py: 0.75, minWidth: 0 }}>
                {editingGroupId === group.id ? (
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <TextField
                      value={editGroupName}
                      onChange={(event) => onEditGroupNameChange(event.target.value)}
                      size="small"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitGroupRename(group.id);
                        if (event.key === "Escape") onStopEditingGroup();
                      }}
                      sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5, fontWeight: 700 } }}
                    />
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={!editGroupName.trim() || updateGroupMutation.isPending}
                      onClick={() => commitGroupRename(group.id)}
                    >
                      <CheckIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" onClick={onStopEditingGroup}>
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, letterSpacing: "0.06em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {(group.category || t("resume.detail.skillsHeading")).toUpperCase()}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                {t("resume.edit.skillsCount", { count: group.skills.length })}
              </Typography>
              <Box sx={{ display: "flex" }}>
                <IconButton
                  size="small"
                  onClick={() => onStartEditingGroup(group.id, group.category)}
                  disabled={isReordering || editingGroupId === group.id}
                >
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onStartConfirmDelete(group.id)}
                  disabled={isReordering}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onMoveCategory(index, "up")}
                  disabled={index === 0 || isReordering}
                >
                  <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onMoveCategory(index, "down")}
                  disabled={index === sortedCategories.length - 1 || isReordering}
                >
                  <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
            {index < sortedCategories.length - 1 && <Divider />}
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 2 }}>
        <SkillsAddCategoryForm
          adding={addingCategory}
          categoryName={newCategoryName}
          skillName={newCategorySkillName}
          isPending={addMutationPending}
          onCategoryNameChange={onCategoryNameChange}
          onSkillNameChange={onSkillNameChange}
          onCommit={onCommitAddCategory}
          onCancel={onCancelAddCategory}
          onStartAdding={onStartAddingCategory}
        />
      </Box>
    </Box>
  );
}

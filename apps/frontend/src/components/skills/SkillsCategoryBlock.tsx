/**
 * SkillsCategoryBlock — detail-view category block for SkillsEditor.
 * Renders the category header (title + edit/add/delete/sort actions) and
 * the skills themselves as chips. When the category is in "sort" mode,
 * skills render as draggable rows with save/cancel controls instead.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import SortIcon from "@mui/icons-material/Sort";
import type { SkillRow } from "../SkillsEditor";

interface MutationLike {
  isPending: boolean;
  mutate: (
    input: { id: string; name: string },
    options?: { onSuccess?: () => void },
  ) => void;
}

interface DeleteMutationLike {
  mutate: (skillId: string) => void;
}

interface SkillsCategoryBlockProps {
  groupId: string;
  categoryName: string;
  catSkills: SkillRow[];
  isSorting: boolean;
  isEditingGroup: boolean;
  editingSkillId: string | null;
  editName: string;
  addingToCategory: string | null;
  newSkillName: string;
  editGroupName: string;
  draggingSkillId: string | null;
  orderedSkills: SkillRow[];
  isReordering: boolean;
  updateMutation: { isPending: boolean };
  addMutation: { isPending: boolean };
  deleteMutation: DeleteMutationLike;
  updateGroupMutation: MutationLike;
  onEditGroupNameChange: (value: string) => void;
  onEditNameChange: (value: string) => void;
  onNewSkillNameChange: (value: string) => void;
  onCommitEdit: (skillId: string) => void;
  onCancelEdit: () => void;
  onStartAddingToCategory: (groupId: string) => void;
  onCancelAdding: () => void;
  onCommitAddToCategory: (groupId: string) => void;
  onStartEditing: (skill: SkillRow) => void;
  onStartEditingGroup: (groupId: string, currentName: string) => void;
  onStopEditingGroup: () => void;
  onStartConfirmDelete: (groupId: string) => void;
  onStartSorting: (groupId: string, skillIds: string[]) => void;
  onStopSorting: (groupId: string) => void;
  onDragStart: (skillId: string) => void;
  onDragEnd: () => void;
  onDrop: (skillId: string) => void;
  onSaveSkillOrder: (groupId: string) => void;
}

export function SkillsCategoryBlock(props: SkillsCategoryBlockProps) {
  const { t } = useTranslation("common");
  const {
    groupId,
    categoryName,
    catSkills,
    isSorting,
    isEditingGroup,
    editingSkillId,
    editName,
    addingToCategory,
    newSkillName,
    editGroupName,
    draggingSkillId,
    orderedSkills,
    isReordering,
    updateMutation,
    addMutation,
    deleteMutation,
    updateGroupMutation,
    onEditGroupNameChange,
    onEditNameChange,
    onNewSkillNameChange,
    onCommitEdit,
    onCancelEdit,
    onStartAddingToCategory,
    onCancelAdding,
    onCommitAddToCategory,
    onStartEditing,
    onStartEditingGroup,
    onStopEditingGroup,
    onStartConfirmDelete,
    onStartSorting,
    onStopSorting,
    onDragStart,
    onDragEnd,
    onDrop,
    onSaveSkillOrder,
  } = props;

  const commitGroupName = () => {
    const trimmed = editGroupName.trim();
    if (!trimmed) return;
    updateGroupMutation.mutate(
      { id: groupId, name: trimmed },
      { onSuccess: onStopEditingGroup },
    );
  };

  return (
    <Box sx={{ mb: 2.5, minWidth: 0 }}>
      <Box sx={{ bgcolor: "action.hover", px: 1.5, py: 0.75, mb: 1, display: "flex", alignItems: "center", minWidth: 0, gap: 1 }}>
        {isEditingGroup ? (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flex: 1, minWidth: 0 }}>
            <TextField
              value={editGroupName}
              onChange={(event) => onEditGroupNameChange(event.target.value)}
              size="small"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") commitGroupName();
                if (event.key === "Escape") onStopEditingGroup();
              }}
              sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5, fontWeight: 700 } }}
            />
            <IconButton
              size="small"
              color="primary"
              onClick={commitGroupName}
              disabled={!editGroupName.trim() || updateGroupMutation.isPending}
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
            sx={{ fontWeight: 700, letterSpacing: "0.06em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {(categoryName || t("resume.detail.skillsHeading")).toUpperCase()}
          </Typography>
        )}
        <Tooltip title={t("resume.edit.skillEditButton")}>
          <IconButton
            size="small"
            onClick={() => onStartEditingGroup(groupId, categoryName)}
            sx={{ p: 0.25 }}
            disabled={isEditingGroup || isSorting}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("resume.edit.skillAddButton")}>
          <IconButton size="small" onClick={() => onStartAddingToCategory(groupId)} sx={{ p: 0.25 }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("resume.edit.skillDeleteCategoryButton")}>
          <IconButton size="small" onClick={() => onStartConfirmDelete(groupId)} sx={{ p: 0.25 }}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("resume.edit.skillsSortWithinGroupTooltip")}>
          <IconButton
            size="small"
            onClick={() => {
              if (isSorting) {
                onStopSorting(groupId);
                return;
              }
              onStartSorting(groupId, catSkills.map((skill) => skill.id));
            }}
            sx={{ p: 0.25 }}
          >
            <SortIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {isSorting ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {orderedSkills.map((skill) => (
            <Box
              key={skill.id}
              draggable
              onDragStart={() => onDragStart(skill.id)}
              onDragEnd={onDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDrop(skill.id);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 0.75,
                border: "1px solid",
                borderColor: draggingSkillId === skill.id ? "primary.main" : "divider",
                bgcolor: "background.paper",
                cursor: "grab",
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {skill.name}
              </Typography>
            </Box>
          ))}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 0.5 }}>
            <Button size="small" onClick={() => onStopSorting(groupId)}>
              {t("resume.edit.skillCancelButton")}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={isReordering}
              onClick={() => onSaveSkillOrder(groupId)}
            >
              {t("resume.edit.skillSaveButton")}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {catSkills.map((skill) => {
            if (editingSkillId === skill.id) {
              return (
                <Box key={skill.id} sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
                  <TextField
                    value={editName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    size="small"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitEdit(skill.id);
                      if (e.key === "Escape") onCancelEdit();
                    }}
                    sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
                  />
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onCommitEdit(skill.id)}
                    disabled={!editName.trim() || updateMutation.isPending}
                  >
                    <CheckIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={onCancelEdit}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              );
            }

            return (
              <Box key={skill.id} sx={{ display: "flex", alignItems: "center", maxWidth: "100%" }}>
                <Chip
                  label={skill.name}
                  size="small"
                  variant="outlined"
                  onClick={() => onStartEditing(skill)}
                  onDelete={() => deleteMutation.mutate(skill.id)}
                  sx={{ fontSize: "0.75rem", cursor: "pointer", maxWidth: "100%" }}
                />
              </Box>
            );
          })}
          {addingToCategory === groupId && (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
              <TextField
                value={newSkillName}
                onChange={(e) => onNewSkillNameChange(e.target.value)}
                size="small"
                autoFocus
                placeholder={t("resume.edit.skillNameLabel")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCommitAddToCategory(groupId);
                  if (e.key === "Escape") onCancelAdding();
                }}
                sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
              />
              <IconButton
                size="small"
                color="primary"
                onClick={() => onCommitAddToCategory(groupId)}
                disabled={!newSkillName.trim() || addMutation.isPending}
              >
                <CheckIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" onClick={onCancelAdding}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

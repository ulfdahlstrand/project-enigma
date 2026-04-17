/**
 * SkillsCategoryBlock — detail-view category block for SkillsEditor.
 * Renders the category header (drag handle + title + edit/add/delete) and
 * the skills themselves as sortable chips. Dragging a chip reorders skills
 * within the category; dragging the header reorders categories.
 *
 * Drag-and-drop is provided by @dnd-kit via the parent SkillsEditor's
 * DndContext. Each chip is rendered inside a per-category SortableContext.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
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
  isEditingGroup: boolean;
  editingSkillId: string | null;
  editName: string;
  addingToCategory: string | null;
  newSkillName: string;
  editGroupName: string;
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
}

interface SortableSkillChipProps {
  skill: SkillRow;
  onClick: () => void;
  onDelete: () => void;
}

function SortableSkillChip({ skill, onClick, onDelete }: SortableSkillChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: skill.id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: "flex",
        alignItems: "center",
        maxWidth: "100%",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <Chip
        label={skill.name}
        size="small"
        variant="outlined"
        onClick={onClick}
        onDelete={onDelete}
        sx={{ fontSize: "0.75rem", cursor: "grab", maxWidth: "100%" }}
      />
    </Box>
  );
}

export function SkillsCategoryBlock(props: SkillsCategoryBlockProps) {
  const { t } = useTranslation("common");
  const {
    groupId,
    categoryName,
    catSkills,
    isEditingGroup,
    editingSkillId,
    editName,
    addingToCategory,
    newSkillName,
    editGroupName,
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
  } = props;

  const {
    attributes: groupAttributes,
    listeners: groupListeners,
    setNodeRef: setGroupNodeRef,
    transform: groupTransform,
    transition: groupTransition,
    isDragging: isGroupDragging,
  } = useSortable({ id: `group:${groupId}` });

  const commitGroupName = () => {
    const trimmed = editGroupName.trim();
    if (!trimmed) return;
    updateGroupMutation.mutate(
      { id: groupId, name: trimmed },
      { onSuccess: onStopEditingGroup },
    );
  };

  return (
    <Box
      ref={setGroupNodeRef}
      sx={{
        mb: 2.5,
        minWidth: 0,
        transform: CSS.Transform.toString(groupTransform),
        transition: groupTransition,
        opacity: isGroupDragging ? 0.5 : 1,
      }}
    >
      <Box sx={{ bgcolor: "action.hover", px: 1.5, py: 0.75, mb: 1, display: "flex", alignItems: "center", minWidth: 0, gap: 1 }}>
        <Tooltip title={t("resume.edit.skillsDragCategoryTooltip")}>
          <Box
            component="span"
            sx={{ display: "flex", alignItems: "center", cursor: "grab", color: "text.secondary" }}
            {...groupAttributes}
            {...groupListeners}
            aria-label={t("resume.edit.skillsDragCategoryTooltip")}
          >
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
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
            disabled={isEditingGroup}
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
      </Box>
      <SortableContext items={catSkills.map((skill) => skill.id)} strategy={horizontalListSortingStrategy}>
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
              <SortableSkillChip
                key={skill.id}
                skill={skill}
                onClick={() => onStartEditing(skill)}
                onDelete={() => deleteMutation.mutate(skill.id)}
              />
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
      </SortableContext>
    </Box>
  );
}

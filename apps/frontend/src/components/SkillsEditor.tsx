/**
 * SkillsEditor — editable version of the skills page, visually matching
 * SkillsPageContent (two-column gray-header category blocks).
 *
 * Toggle between:
 *   - Detail view  (chips + inline add/edit/delete per skill)
 *   - List view    (numbered category list with up/down reordering)
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import { useSkillsEditor } from "../hooks/useSkillsEditor";
import { SkillsAddCategoryForm } from "./SkillsAddCategoryForm";

export interface SkillRow {
  id: string;
  name: string;
  level: string | null;
  category: string | null;
  sortOrder: number;
}

interface SkillsEditorProps {
  resumeId: string;
  skills: SkillRow[];
  queryKey: readonly unknown[];
}

export function SkillsEditor({ resumeId, skills, queryKey }: SkillsEditorProps) {
  const { t } = useTranslation("common");
  const editor = useSkillsEditor({ resumeId, skills, queryKey });

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderSkill = (skill: SkillRow) => {
    if (editor.editingSkillId === skill.id) {
      return (
        <Box key={skill.id} sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
          <TextField
            value={editor.editName}
            onChange={(e) => editor.setEditName(e.target.value)}
            size="small"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") editor.commitEdit(skill.id);
              if (e.key === "Escape") editor.setEditingSkillId(null);
            }}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
          />
          <IconButton
            size="small"
            color="primary"
            onClick={() => editor.commitEdit(skill.id)}
            disabled={!editor.editName.trim() || editor.updateMutation.isPending}
          >
            <CheckIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => editor.setEditingSkillId(null)}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      );
    }

    return (
      <Chip
        key={skill.id}
        label={skill.name}
        size="small"
        variant="outlined"
        onClick={() => editor.startEditing(skill)}
        onDelete={() => editor.deleteMutation.mutate(skill.id)}
        sx={{ fontSize: "0.75rem", cursor: "pointer", maxWidth: "100%" }}
      />
    );
  };

  const renderAddSkillInput = (cat: string) => (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
      <TextField
        value={editor.newSkillName}
        onChange={(e) => editor.setNewSkillName(e.target.value)}
        size="small"
        autoFocus
        placeholder={t("resume.edit.skillNameLabel")}
        onKeyDown={(e) => {
          if (e.key === "Enter") editor.commitAddToCategory(cat);
          if (e.key === "Escape") editor.setAddingToCategory(null);
        }}
        sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
      />
      <IconButton
        size="small"
        color="primary"
        onClick={() => editor.commitAddToCategory(cat)}
        disabled={!editor.newSkillName.trim() || editor.addMutation.isPending}
      >
        <CheckIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton size="small" onClick={() => editor.setAddingToCategory(null)}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );

  const renderCategoryBlock = (cat: string, catSkills: SkillRow[]) => (
    <Box key={cat} sx={{ mb: 2.5, minWidth: 0 }}>
      <Box sx={{ bgcolor: "action.hover", px: 1.5, py: 0.75, mb: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: "0.06em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {(cat || t("resume.detail.skillsHeading")).toUpperCase()}
        </Typography>
        <Tooltip title={t("resume.edit.skillAddButton")}>
          <IconButton size="small" onClick={() => editor.startAddingToCategory(cat)} sx={{ p: 0.25 }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {catSkills.map(renderSkill)}
        {editor.addingToCategory === cat && renderAddSkillInput(cat)}
      </Box>
    </Box>
  );

  // ---------------------------------------------------------------------------
  // View toggle
  // ---------------------------------------------------------------------------

  const toggle = (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
      <ToggleButtonGroup
        value={editor.view}
        exclusive
        size="small"
        onChange={(_, v) => { if (v) editor.setView(v as "detail" | "list"); }}
      >
        <ToggleButton value="detail">
          <Tooltip title={t("resume.edit.skillsDetailViewTooltip")}>
            <ViewAgendaIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="list">
          <Tooltip title={t("resume.edit.skillsListViewTooltip")}>
            <FormatListBulletedIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );

  // ---------------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------------

  if (editor.view === "list") {
    return (
      <Box>
        {toggle}
        {editor.isReordering && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {editor.sortedCategories.map(([cat, catSkills], index) => (
            <Box key={cat}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, opacity: editor.isReordering ? 0.5 : 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 24, color: "text.disabled" }}>
                  {index + 1}
                </Typography>
                <Box sx={{ flex: 1, bgcolor: "action.hover", px: 1.5, py: 0.75, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, letterSpacing: "0.06em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {(cat || t("resume.detail.skillsHeading")).toUpperCase()}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {t("resume.edit.skillsCount", { count: catSkills.length })}
                </Typography>
                <Box sx={{ display: "flex" }}>
                  <IconButton
                    size="small"
                    onClick={() => void editor.handleMoveCategory(index, "up")}
                    disabled={index === 0 || editor.isReordering}
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => void editor.handleMoveCategory(index, "down")}
                    disabled={index === editor.sortedCategories.length - 1 || editor.isReordering}
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
              {index < editor.sortedCategories.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 2 }}>
          <SkillsAddCategoryForm
            adding={editor.addingCategory}
            categoryName={editor.newCategoryName}
            skillName={editor.newCategorySkillName}
            isPending={editor.addMutation.isPending}
            onCategoryNameChange={editor.setNewCategoryName}
            onSkillNameChange={editor.setNewCategorySkillName}
            onCommit={editor.commitAddCategory}
            onCancel={() => editor.setAddingCategory(false)}
            onStartAdding={() => { editor.setAddingCategory(true); editor.setNewCategoryName(""); editor.setNewCategorySkillName(""); }}
          />
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------------

  return (
    <Box>
      {toggle}
      {skills.length === 0 && !editor.addingCategory ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("resume.detail.noSkills")}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start", mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            {editor.leftCategories.map(([cat, catSkills]) => renderCategoryBlock(cat, catSkills))}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {editor.rightCategories.map(([cat, catSkills]) => renderCategoryBlock(cat, catSkills))}
          </Box>
        </Box>
      )}
      <SkillsAddCategoryForm
        adding={editor.addingCategory}
        categoryName={editor.newCategoryName}
        skillName={editor.newCategorySkillName}
        isPending={editor.addMutation.isPending}
        onCategoryNameChange={editor.setNewCategoryName}
        onSkillNameChange={editor.setNewCategorySkillName}
        onCommit={editor.commitAddCategory}
        onCancel={() => editor.setAddingCategory(false)}
        onStartAdding={() => { editor.setAddingCategory(true); editor.setNewCategoryName(""); editor.setNewCategorySkillName(""); }}
      />
    </Box>
  );
}

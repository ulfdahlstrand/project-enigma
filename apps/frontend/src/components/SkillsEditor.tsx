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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import { orpc } from "../orpc-client";

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

// ---------------------------------------------------------------------------
// Sorting helper
// ---------------------------------------------------------------------------

function sortCategories(grouped: Record<string, SkillRow[]>): [string, SkillRow[]][] {
  return Object.entries(grouped).sort(([a, aSkills], [b, bSkills]) => {
    const minA = Math.min(...aSkills.map((s) => s.sortOrder));
    const minB = Math.min(...bSkills.map((s) => s.sortOrder));
    if (minA !== minB) return minA - minB;
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillsEditor({ resumeId, skills, queryKey }: SkillsEditorProps) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [view, setView] = useState<"detail" | "list">("detail");

  // Inline skill name edit (detail view)
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Add skill to an existing category
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState("");

  // Add a brand-new category
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySkillName, setNewCategorySkillName] = useState("");

  // Reorder pending state (list view)
  const [isReordering, setIsReordering] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      orpc.updateResumeSkill({ id, name }),
    onSuccess: async () => {
      setEditingSkillId(null);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.deleteResumeSkill({ id }),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: ({ name, category }: { name: string; category: string | null }) =>
      orpc.createResumeSkill({ cvId: resumeId, name, category }),
    onSuccess: async () => {
      setAddingToCategory(null);
      setNewSkillName("");
      setAddingCategory(false);
      setNewCategoryName("");
      setNewCategorySkillName("");
      await invalidate();
    },
  });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const grouped = skills.reduce<Record<string, SkillRow[]>>((acc, skill) => {
    const key = skill.category?.trim() || "";
    return { ...acc, [key]: [...(acc[key] ?? []), skill] };
  }, {});

  const sortedCategories = sortCategories(grouped);
  const mid = Math.ceil(sortedCategories.length / 2);
  const leftCategories = sortedCategories.slice(0, mid);
  const rightCategories = sortedCategories.slice(mid);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const startEditing = (skill: SkillRow) => {
    setEditingSkillId(skill.id);
    setEditName(skill.name);
  };

  const commitEdit = (id: string) => {
    if (editName.trim()) updateMutation.mutate({ id, name: editName.trim() });
  };

  const startAddingToCategory = (cat: string) => {
    setAddingToCategory(cat);
    setNewSkillName("");
  };

  const commitAddToCategory = (cat: string) => {
    if (!newSkillName.trim()) return;
    addMutation.mutate({ name: newSkillName.trim(), category: cat || null });
  };

  const commitAddCategory = () => {
    if (!newCategoryName.trim() || !newCategorySkillName.trim()) return;
    addMutation.mutate({ name: newCategorySkillName.trim(), category: newCategoryName.trim() });
  };

  const handleMoveCategory = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedCategories.length) return;

    const reordered = [...sortedCategories];
    const temp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = temp;

    // Assign new sort_orders: category position * 1000 + skill-within-category position
    const updates: { id: string; sortOrder: number }[] = [];
    reordered.forEach(([, catSkills], catIndex) => {
      catSkills.forEach((skill, skillIndex) => {
        updates.push({ id: skill.id, sortOrder: catIndex * 1000 + skillIndex });
      });
    });

    setIsReordering(true);
    try {
      await Promise.all(
        updates.map(({ id, sortOrder }) => orpc.updateResumeSkill({ id, sortOrder }))
      );
      await invalidate();
    } finally {
      setIsReordering(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers (plain functions — avoids remount issues)
  // ---------------------------------------------------------------------------

  const renderSkill = (skill: SkillRow) => {
    if (editingSkillId === skill.id) {
      return (
        <Box key={skill.id} sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
          <TextField
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            size="small"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(skill.id);
              if (e.key === "Escape") setEditingSkillId(null);
            }}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
          />
          <IconButton
            size="small"
            color="primary"
            onClick={() => commitEdit(skill.id)}
            disabled={!editName.trim() || updateMutation.isPending}
          >
            <CheckIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => setEditingSkillId(null)}>
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
        onClick={() => startEditing(skill)}
        onDelete={() => deleteMutation.mutate(skill.id)}
        sx={{ fontSize: "0.75rem", cursor: "pointer", maxWidth: "100%" }}
      />
    );
  };

  const renderAddSkillInput = (cat: string) => (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%", mt: 0.5 }}>
      <TextField
        value={newSkillName}
        onChange={(e) => setNewSkillName(e.target.value)}
        size="small"
        autoFocus
        placeholder={t("resume.edit.skillNameLabel")}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitAddToCategory(cat);
          if (e.key === "Escape") setAddingToCategory(null);
        }}
        sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5 } }}
      />
      <IconButton
        size="small"
        color="primary"
        onClick={() => commitAddToCategory(cat)}
        disabled={!newSkillName.trim() || addMutation.isPending}
      >
        <CheckIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton size="small" onClick={() => setAddingToCategory(null)}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );

  const renderCategoryBlock = (cat: string, catSkills: SkillRow[]) => (
    <Box key={cat} sx={{ mb: 2.5, minWidth: 0 }}>
      <Box
        sx={{
          bgcolor: "action.hover",
          px: 1.5,
          py: 0.75,
          mb: 1,
          display: "flex",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: "0.06em",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {(cat || t("resume.detail.skillsHeading")).toUpperCase()}
        </Typography>
        <Tooltip title={t("resume.edit.skillAddButton")}>
          <IconButton size="small" onClick={() => startAddingToCategory(cat)} sx={{ p: 0.25 }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {catSkills.map(renderSkill)}
        {addingToCategory === cat && renderAddSkillInput(cat)}
      </Box>
    </Box>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const toggle = (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
      <ToggleButtonGroup
        value={view}
        exclusive
        size="small"
        onChange={(_, v) => { if (v) setView(v as "detail" | "list"); }}
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

  if (view === "list") {
    return (
      <Box>
        {toggle}

        {isReordering && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {sortedCategories.map(([cat, catSkills], index) => (
            <Box key={cat}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 1,
                  opacity: isReordering ? 0.5 : 1,
                }}
              >
                {/* Position number */}
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, minWidth: 24, color: "text.disabled" }}
                >
                  {index + 1}
                </Typography>

                {/* Gray category label — matches SkillsPageContent header style */}
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: "action.hover",
                    px: 1.5,
                    py: 0.75,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(cat || t("resume.detail.skillsHeading")).toUpperCase()}
                  </Typography>
                </Box>

                {/* Skill count */}
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {t("resume.edit.skillsCount", { count: catSkills.length })}
                </Typography>

                {/* Up / Down */}
                <Box sx={{ display: "flex" }}>
                  <IconButton
                    size="small"
                    onClick={() => void handleMoveCategory(index, "up")}
                    disabled={index === 0 || isReordering}
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => void handleMoveCategory(index, "down")}
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

        {/* Add category stays available in list view too */}
        <Box sx={{ mt: 2 }}>
          {addingCategory ? (
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
              <TextField
                label={t("resume.edit.skillCategoryLabel")}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                size="small"
                autoFocus
                sx={{ flex: "1 1 160px" }}
              />
              <TextField
                label={t("resume.edit.skillNameLabel")}
                value={newCategorySkillName}
                onChange={(e) => setNewCategorySkillName(e.target.value)}
                size="small"
                onKeyDown={(e) => { if (e.key === "Enter") commitAddCategory(); }}
                sx={{ flex: "1 1 160px" }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={commitAddCategory}
                disabled={!newCategoryName.trim() || !newCategorySkillName.trim() || addMutation.isPending}
              >
                {t("resume.edit.skillSaveButton")}
              </Button>
              <Button variant="outlined" size="small" onClick={() => setAddingCategory(false)}>
                {t("resume.edit.skillCancelButton")}
              </Button>
            </Box>
          ) : (
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => { setAddingCategory(true); setNewCategoryName(""); setNewCategorySkillName(""); }}
            >
              {t("resume.edit.skillAddCategoryButton")}
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // --- Detail view ---
  return (
    <Box>
      {toggle}

      {skills.length === 0 && !addingCategory ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("resume.detail.noSkills")}
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, alignItems: "start", mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            {leftCategories.map(([cat, catSkills]) => renderCategoryBlock(cat, catSkills))}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {rightCategories.map(([cat, catSkills]) => renderCategoryBlock(cat, catSkills))}
          </Box>
        </Box>
      )}

      {addingCategory ? (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap", mt: 1 }}>
          <TextField
            label={t("resume.edit.skillCategoryLabel")}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            size="small"
            autoFocus
            sx={{ flex: "1 1 160px" }}
          />
          <TextField
            label={t("resume.edit.skillNameLabel")}
            value={newCategorySkillName}
            onChange={(e) => setNewCategorySkillName(e.target.value)}
            size="small"
            onKeyDown={(e) => { if (e.key === "Enter") commitAddCategory(); }}
            sx={{ flex: "1 1 160px" }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={commitAddCategory}
            disabled={!newCategoryName.trim() || !newCategorySkillName.trim() || addMutation.isPending}
          >
            {t("resume.edit.skillSaveButton")}
          </Button>
          <Button variant="outlined" size="small" onClick={() => setAddingCategory(false)}>
            {t("resume.edit.skillCancelButton")}
          </Button>
        </Box>
      ) : (
        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => { setAddingCategory(true); setNewCategoryName(""); setNewCategorySkillName(""); }}
        >
          {t("resume.edit.skillAddCategoryButton")}
        </Button>
      )}
    </Box>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../orpc-client";
import type { SkillGroupRow, SkillRow } from "../components/SkillsEditor";
import { resumeBranchHistoryGraphKey, resumeBranchesKey, resumeCommitsKey } from "./versioning";

type SkillCategoryRow = {
  id: string;
  category: string;
  sortOrder: number;
  skills: SkillRow[];
};

export function getNextSkillSortOrder(groups: SkillCategoryRow[], groupId: string): number {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    const maxSortOrder = groups.flatMap((candidate) => candidate.skills).reduce(
      (max, skill) => Math.max(max, skill.sortOrder),
      -1,
    );
    return maxSortOrder + 1;
  }

  return group.skills.reduce((max, skill) => Math.max(max, skill.sortOrder), -1) + 1;
}

export function reorderSkillsInGroup(
  groups: SkillCategoryRow[],
  groupId: string,
  skillId: string,
  direction: "up" | "down",
): SkillRow[] {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return [];

  const currentIndex = group.skills.findIndex((skill) => skill.id === skillId);
  if (currentIndex === -1) return [];

  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= group.skills.length) return [];

  const reordered = [...group.skills];
  const current = reordered[currentIndex]!;
  reordered[currentIndex] = reordered[swapIndex]!;
  reordered[swapIndex] = current;

  return reordered.map((skill, index) => ({
    ...skill,
    sortOrder: index,
  }));
}

export function reorderSkillsByIds(
  groups: SkillCategoryRow[],
  groupId: string,
  orderedSkillIds: string[],
): SkillRow[] {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return [];

  const skillById = new Map(group.skills.map((skill) => [skill.id, skill]));
  const reordered = orderedSkillIds
    .map((id) => skillById.get(id))
    .filter((skill): skill is SkillRow => Boolean(skill));

  if (reordered.length !== group.skills.length) {
    return [];
  }

  return reordered.map((skill, index) => ({
    ...skill,
    sortOrder: index,
  }));
}

function buildSkillGroups(skillGroups: SkillGroupRow[], skills: SkillRow[]): SkillCategoryRow[] {
  const groups = new Map<string, SkillCategoryRow>();

  for (const group of skillGroups) {
    groups.set(group.id, {
      id: group.id,
      category: group.name.trim(),
      sortOrder: group.sortOrder,
      skills: [],
    });
  }

  for (const skill of skills) {
    const existing = groups.get(skill.groupId);
    if (existing) {
      existing.skills.push(skill);
      existing.category = skill.category?.trim() || existing.category;
      continue;
    }

    groups.set(skill.groupId, {
      id: skill.groupId,
      category: skill.category?.trim() || "",
      sortOrder: Number.MAX_SAFE_INTEGER,
      skills: [skill],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      skills: [...group.skills].sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.category === "") return 1;
      if (b.category === "") return -1;
      return a.category.localeCompare(b.category);
    });
}

interface UseSkillsEditorParams {
  resumeId: string;
  branchId: string;
  skillGroups: SkillGroupRow[];
  skills: SkillRow[];
  queryKey: readonly unknown[];
  addingCategory?: boolean | undefined;
  onAddingCategoryChange?: ((open: boolean) => void) | undefined;
}

export function useSkillsEditor({
  resumeId,
  branchId,
  skillGroups,
  skills,
  queryKey,
  addingCategory: externalAddingCategory,
  onAddingCategoryChange,
}: UseSkillsEditorParams) {
  const queryClient = useQueryClient();

  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [internalAddingCategory, setInternalAddingCategory] = useState(false);
  const addingCategory = externalAddingCategory ?? internalAddingCategory;
  const setAddingCategory = (open: boolean) => {
    setInternalAddingCategory(open);
    onAddingCategoryChange?.(open);
  };
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySkillName, setNewCategorySkillName] = useState("");
  const [isReordering, setIsReordering] = useState(false);

  const createTempId = () =>
    globalThis.crypto?.randomUUID?.() ?? `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const buildCommitSnapshot = (nextSkillGroups: SkillGroupRow[], nextSkills: SkillRow[]) => {
    const orderedGroups = [...nextSkillGroups].sort((a, b) => a.sortOrder - b.sortOrder);
    const groupNameById = new Map(orderedGroups.map((group) => [group.id, group.name.trim()]));

    return {
      skillGroups: orderedGroups.map((group) => ({
        name: group.name.trim(),
        sortOrder: group.sortOrder,
      })),
      skills: [...nextSkills]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((skill) => ({
          name: skill.name.trim(),
          category: groupNameById.get(skill.groupId) ?? skill.category?.trim() ?? null,
          sortOrder: skill.sortOrder,
        })),
    };
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["getResume", resumeId] }),
    ]);
  };

  const branchSaveMutation = useMutation({
    mutationFn: ({ nextSkillGroups, nextSkills }: { nextSkillGroups: SkillGroupRow[]; nextSkills: SkillRow[] }) =>
      orpc.saveResumeVersion({
        branchId,
        ...buildCommitSnapshot(nextSkillGroups, nextSkills),
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: resumeBranchesKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: resumeBranchHistoryGraphKey(resumeId) }),
        queryClient.invalidateQueries({ queryKey: resumeCommitsKey(branchId) }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, sortOrder, groupId }: {
      id: string;
      name?: string;
      sortOrder?: number;
      groupId?: string;
    }) => {
      const nextSkills = skills.map((skill) =>
        skill.id === id
          ? {
              ...skill,
              name: name ?? skill.name,
              sortOrder: sortOrder ?? skill.sortOrder,
              groupId: groupId ?? skill.groupId,
            }
          : skill,
      );
      await branchSaveMutation.mutateAsync({ nextSkillGroups: skillGroups, nextSkills });
    },
    onSuccess: () => {
      setEditingSkillId(null);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, name, sortOrder }: { id: string; name?: string; sortOrder?: number }) => {
      const nextSkillGroups = skillGroups.map((group) =>
        group.id === id
          ? {
              ...group,
              name: name ?? group.name,
              sortOrder: sortOrder ?? group.sortOrder,
            }
          : group,
      );
      await branchSaveMutation.mutateAsync({ nextSkillGroups, nextSkills: skills });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const nextSkills = skills.filter((skill) => skill.id !== id);
      await branchSaveMutation.mutateAsync({ nextSkillGroups: skillGroups, nextSkills });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const nextSkillGroups = skillGroups.filter((group) => group.id !== groupId);
      const nextSkills = skills.filter((skill) => skill.groupId !== groupId);
      await branchSaveMutation.mutateAsync({ nextSkillGroups, nextSkills });
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ name, groupId, sortOrder }: { name: string; groupId: string; sortOrder?: number }) => {
      const nextSkills = [
        ...skills,
        {
          id: createTempId(),
          groupId,
          name,
          category: skillGroups.find((group) => group.id === groupId)?.name ?? null,
          sortOrder: sortOrder ?? getNextSkillSortOrder(buildSkillGroups(skillGroups, skills), groupId),
        },
      ];
      await branchSaveMutation.mutateAsync({ nextSkillGroups: skillGroups, nextSkills });
      return { id: groupId };
    },
    onSuccess: () => {
      setAddingToCategory(null);
      setNewSkillName("");
      setAddingCategory(false);
      setNewCategoryName("");
      setNewCategorySkillName("");
    },
  });

  const addGroupMutation = useMutation({
    mutationFn: async ({ name, sortOrder }: { name: string; sortOrder: number }) => {
      const group = {
        id: createTempId(),
        resumeId,
        name,
        sortOrder,
      };
      await branchSaveMutation.mutateAsync({
        nextSkillGroups: [...skillGroups, group],
        nextSkills: skills,
      });
      return group;
    },
  });

  const sortedCategories = buildSkillGroups(skillGroups, skills);
  const mid = Math.ceil(sortedCategories.length / 2);
  const leftCategories = sortedCategories.slice(0, mid);
  const rightCategories = sortedCategories.slice(mid);

  const startEditing = (skill: SkillRow) => {
    setEditingSkillId(skill.id);
    setEditName(skill.name);
  };

  const commitEdit = (id: string) => {
    if (editName.trim()) updateMutation.mutate({ id, name: editName.trim() });
  };

  const startAddingToCategory = (groupId: string) => {
    setAddingToCategory(groupId);
    setNewSkillName("");
  };

  const commitAddToCategory = (groupId: string) => {
    if (!newSkillName.trim()) return;
    addMutation.mutate({
      name: newSkillName.trim(),
      groupId,
      sortOrder: getNextSkillSortOrder(sortedCategories, groupId),
    });
  };

  const commitAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategorySkillName.trim()) return;

    const nextGroupSortOrder = sortedCategories.reduce(
      (max, group) => Math.max(max, group.sortOrder),
      -1,
    ) + 1;

    const nextGroupId = createTempId();
    const nextSkillGroups = [
      ...skillGroups,
      {
        id: nextGroupId,
        resumeId,
        name: newCategoryName.trim(),
        sortOrder: nextGroupSortOrder,
      },
    ];
    const nextSkills = [
      ...skills,
      {
        id: createTempId(),
        groupId: nextGroupId,
        name: newCategorySkillName.trim(),
        category: newCategoryName.trim(),
        sortOrder: 0,
      },
    ];

    await branchSaveMutation.mutateAsync({ nextSkillGroups, nextSkills });
    setAddingCategory(false);
    setNewCategoryName("");
    setNewCategorySkillName("");
  };

  const handleMoveCategory = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedCategories.length) return;

    const reordered = [...sortedCategories];
    const temp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = temp;

    setIsReordering(true);
    try {
      const reorderedGroups = reordered.map((group, groupIndex) => ({
        ...(skillGroups.find((candidate) => candidate.id === group.id) ?? {
          id: group.id,
          resumeId,
          name: group.category,
          sortOrder: groupIndex,
        }),
        sortOrder: groupIndex,
      }));
      await branchSaveMutation.mutateAsync({ nextSkillGroups: reorderedGroups, nextSkills: skills });
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveSkill = async (groupId: string, skillId: string, direction: "up" | "down") => {
    const reorderedSkills = reorderSkillsInGroup(sortedCategories, groupId, skillId, direction);
    if (reorderedSkills.length === 0) return;

    setIsReordering(true);
    try {
      const reorderedSkillMap = new Map(reorderedSkills.map((skill) => [skill.id, skill]));
      const nextSkills = skills.map((skill) => reorderedSkillMap.get(skill.id) ?? skill);
      await branchSaveMutation.mutateAsync({ nextSkillGroups: skillGroups, nextSkills });
    } finally {
      setIsReordering(false);
    }
  };

  const reorderSkills = async (groupId: string, orderedSkillIds: string[]) => {
    const reorderedSkills = reorderSkillsByIds(sortedCategories, groupId, orderedSkillIds);
    if (reorderedSkills.length === 0) return;

    setIsReordering(true);
    try {
      const reorderedSkillMap = new Map(reorderedSkills.map((skill) => [skill.id, skill]));
      const nextSkills = skills.map((skill) => reorderedSkillMap.get(skill.id) ?? skill);
      await branchSaveMutation.mutateAsync({ nextSkillGroups: skillGroups, nextSkills });
    } finally {
      setIsReordering(false);
    }
  };

  return {
    editingSkillId, setEditingSkillId,
    editName, setEditName,
    addingToCategory, setAddingToCategory,
    newSkillName, setNewSkillName,
    addingCategory, setAddingCategory,
    newCategoryName, setNewCategoryName,
    newCategorySkillName, setNewCategorySkillName,
    isReordering,
    updateMutation, updateGroupMutation, deleteMutation, deleteGroupMutation, addMutation, addGroupMutation,
    sortedCategories, leftCategories, rightCategories,
    startEditing, commitEdit,
    startAddingToCategory, commitAddToCategory, commitAddCategory,
    handleMoveCategory,
    handleMoveSkill,
    reorderSkills,
  };
}

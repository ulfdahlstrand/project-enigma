import type { SkillsReviewValue } from "../../components/revision/SkillsReviewContent";
import type { RevisionSuggestions } from "../../lib/ai-tools/registries/resume-tool-schemas";

type SkillLike = {
  groupId?: string;
  name: string;
  category: string | null;
  sortOrder: number;
};

type SkillGroup = {
  category: string;
  skills: SkillLike[];
};

export function formatSkillsSnapshot(skills: Array<{ name: string; category: string | null; sortOrder: number }>) {
  const orderedSkills = [...skills].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups = orderedSkills.reduce<Array<{ category: string; skills: string[] }>>((acc, skill) => {
    const category = skill.category?.trim() || "Other";
    const existing = acc.find((group) => group.category === category);

    if (existing) {
      existing.skills.push(skill.name);
      return acc;
    }

    return [...acc, { category, skills: [skill.name] }];
  }, []);

  return groups.map((group) => `${group.category}: ${group.skills.join(", ")}`).join("\n");
}

export function normalizeSkillCategory(category: string | null | undefined) {
  return category?.trim() || "Other";
}

export function groupSkillsByCategory(skills: SkillLike[]): SkillGroup[] {
  const orderedSkills = [...skills].sort((a, b) => a.sortOrder - b.sortOrder);

  return orderedSkills.reduce<SkillGroup[]>((acc, skill) => {
    const category = normalizeSkillCategory(skill.category);
    const existing = acc.find((group) => group.category === category);

    if (existing) {
      existing.skills.push(skill);
      return acc;
    }

    return [...acc, { category, skills: [skill] }];
  }, []);
}

export function resequenceSkillGroups(groups: SkillGroup[]) {
  return groups.flatMap((group, groupIndex) =>
    group.skills.map((skill, skillIndex) => ({
      ...skill,
      category: group.category,
      sortOrder: groupIndex * 1000 + skillIndex,
    })),
  );
}

export function isSkillsSection(section: string) {
  const normalized = section.trim().toLowerCase();
  return (
    normalized.includes("skill")
    || normalized.includes("kompetens")
    || normalized.includes("färdighet")
  );
}

export function normalizeSkillsLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[\d\s.\-:]+/u, "")
    .replace(/\s+/g, " ");
}

function parseSuggestedGroupOrder(
  suggestedText: string,
  currentSkills: SkillLike[],
) {
  const currentGroups = groupSkillsByCategory(currentSkills);
  const currentGroupsByLabel = new Map(
    currentGroups.map((group) => [normalizeSkillsLabel(group.category), group]),
  );
  const desiredLabels = suggestedText
    .split("\n")
    .map((line) => normalizeSkillsLabel(line))
    .filter(Boolean);

  const desiredGroups = desiredLabels
    .map((label) => currentGroupsByLabel.get(label))
    .filter((group, index, groups): group is NonNullable<typeof group> =>
      Boolean(group) && groups.findIndex((candidate) => candidate?.category === group?.category) === index,
    );

  if (desiredGroups.length < 2) {
    return null;
  }

  const desiredCategorySet = new Set(desiredGroups.map((group) => group.category));
  const remainingGroups = currentGroups.filter((group) => !desiredCategorySet.has(group.category));
  const reorderedSkills = resequenceSkillGroups([...desiredGroups, ...remainingGroups]);

  return {
    skills: reorderedSkills,
    skillScope: {
      type: "group_order" as const,
    },
  };
}

function parseSuggestedGroupContents(
  suggestedText: string,
  currentSkills: SkillLike[],
) {
  const [rawCategory, rawItems] = suggestedText.split(":");
  if (!rawCategory || !rawItems) {
    return null;
  }

  const targetCategory = normalizeSkillsLabel(rawCategory);
  const currentGroups = groupSkillsByCategory(currentSkills);
  const matchingGroup = currentGroups.find((group) => normalizeSkillsLabel(group.category) === targetCategory);

  if (!matchingGroup) {
    return null;
  }

  const desiredNames = rawItems
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (desiredNames.length < 2) {
    return null;
  }

  const desiredNameSet = new Set(desiredNames.map((item) => item.toLowerCase()));
  const skillsByName = new Map(
    matchingGroup.skills.map((skill) => [skill.name.trim().toLowerCase(), skill]),
  );
  const reorderedSkills = desiredNames
    .map((name) => skillsByName.get(name.toLowerCase()))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  if (reorderedSkills.length < 2) {
    return null;
  }

  const remainingSkills = matchingGroup.skills.filter((skill) => !desiredNameSet.has(skill.name.trim().toLowerCase()));
  const nextGroups = currentGroups.map((group) =>
    group.category === matchingGroup.category
      ? { ...group, skills: [...reorderedSkills, ...remainingSkills] }
      : group,
  );

  return {
    skills: resequenceSkillGroups(nextGroups),
    skillScope: {
      type: "group_contents" as const,
      category: matchingGroup.category,
    },
  };
}

function parseSuggestedGroupRename(
  suggestedText: string,
  currentSkills: SkillLike[],
) {
  const [rawCategory, rawItems] = suggestedText.split(":");
  if (!rawCategory || !rawItems) {
    return null;
  }

  const currentGroups = groupSkillsByCategory(currentSkills);
  const desiredNames = rawItems
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (desiredNames.length === 0) {
    return null;
  }

  const desiredNameSet = new Set(desiredNames.map((item) => item.toLowerCase()));
  const matchingGroup = currentGroups.find((group) => {
    if (group.skills.length !== desiredNames.length) {
      return false;
    }

    return group.skills.every((skill) => desiredNameSet.has(skill.name.trim().toLowerCase()));
  });

  if (!matchingGroup) {
    return null;
  }

  const nextCategory = rawCategory.trim();
  if (!nextCategory || normalizeSkillsLabel(nextCategory) === normalizeSkillsLabel(matchingGroup.category)) {
    return null;
  }

  const nextGroups = currentGroups.map((group) =>
    group.category === matchingGroup.category
      ? {
          ...group,
          category: nextCategory,
          skills: group.skills.map((skill) => ({ ...skill, category: nextCategory })),
        }
      : group,
  );

  return {
    skills: resequenceSkillGroups(nextGroups),
    skillScope: {
      type: "group_rename" as const,
      category: matchingGroup.category,
    },
  };
}

function parseSuggestedFlatSkillsList(
  suggestedText: string,
  currentSkills: SkillLike[],
) {
  const suggestedNames = suggestedText.split(",").map((s) => s.trim()).filter(Boolean);
  if (suggestedNames.length < 2) {
    return null;
  }

  const skillsByNormalized = new Map(
    currentSkills.map((skill) => [normalizeSkillsLabel(skill.name), skill]),
  );
  const matchedSkills = suggestedNames
    .map((name) => skillsByNormalized.get(normalizeSkillsLabel(name)))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  if (matchedSkills.length < 2) {
    return null;
  }

  const categories = new Set(matchedSkills.map((skill) => skill.category));
  if (categories.size !== 1) {
    return null;
  }

  const targetCategory = [...categories][0]!;
  const currentGroups = groupSkillsByCategory(currentSkills);
  const matchingGroup = currentGroups.find((g) => g.category === targetCategory);
  if (!matchingGroup) {
    return null;
  }

  const desiredNameSet = new Set(suggestedNames.map((n) => normalizeSkillsLabel(n)));
  const reorderedSkills = suggestedNames
    .map((name) => matchingGroup.skills.find((s) => normalizeSkillsLabel(s.name) === normalizeSkillsLabel(name)))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (reorderedSkills.length < 2) {
    return null;
  }

  const remainingSkills = matchingGroup.skills.filter((s) => !desiredNameSet.has(normalizeSkillsLabel(s.name)));
  const nextGroups = currentGroups.map((group) =>
    group.category === matchingGroup.category
      ? { ...group, skills: [...reorderedSkills, ...remainingSkills] }
      : group,
  );

  return {
    skills: resequenceSkillGroups(nextGroups),
    skillScope: { type: "group_contents" as const, category: matchingGroup.category },
  };
}

export function hydrateSkillsSuggestion(
  suggestion: RevisionSuggestions["suggestions"][number],
  currentSkills: SkillLike[],
) {
  if (!isSkillsSection(suggestion.section)) {
    return suggestion;
  }

  if (suggestion.skills && suggestion.skills.length > 0) {
    return suggestion;
  }

  const parsedGroupRename = parseSuggestedGroupRename(suggestion.suggestedText, currentSkills);
  if (parsedGroupRename) {
    return { ...suggestion, skills: parsedGroupRename.skills, skillScope: parsedGroupRename.skillScope };
  }

  const parsedGroupContents = parseSuggestedGroupContents(suggestion.suggestedText, currentSkills);
  if (parsedGroupContents) {
    return { ...suggestion, skills: parsedGroupContents.skills, skillScope: parsedGroupContents.skillScope };
  }

  const parsedGroupOrder = parseSuggestedGroupOrder(suggestion.suggestedText, currentSkills);
  if (parsedGroupOrder) {
    return { ...suggestion, skills: parsedGroupOrder.skills, skillScope: parsedGroupOrder.skillScope };
  }

  const parsedFlatList = parseSuggestedFlatSkillsList(suggestion.suggestedText, currentSkills);
  if (parsedFlatList) {
    return { ...suggestion, skills: parsedFlatList.skills, skillScope: parsedFlatList.skillScope };
  }

  return suggestion;
}

export function buildSkillsReviewValue(
  currentSkills: SkillLike[],
  suggestion: RevisionSuggestions["suggestions"][number],
): SkillsReviewValue | null {
  if (!suggestion.skills || suggestion.skills.length === 0) {
    return null;
  }

  const originalGroups = groupSkillsByCategory(currentSkills).map((group) => ({
    heading: group.category,
    items: group.skills.map((skill) => skill.name),
  }));
  const suggestedGroups = groupSkillsByCategory(
    suggestion.skills.map((skill) => ({
      name: skill.name,
      category: skill.category,
      sortOrder: skill.sortOrder,
    })),
  ).map((group) => ({
    heading: group.category,
    items: group.skills.map((skill) => skill.name),
  }));

  if (suggestion.skillScope?.type === "group_order") {
    return {
      suggestionId: suggestion.id,
      mode: "group_order",
      originalSections: originalGroups.map((group) => ({ heading: group.heading, items: [] })),
      suggestedSections: suggestedGroups.map((group) => ({ heading: group.heading, items: [] })),
    };
  }

  if (suggestion.skillScope?.type === "group_rename" && suggestion.skillScope.category) {
    const targetCategory = normalizeSkillsLabel(suggestion.skillScope.category);
    const originalSection = originalGroups.find(
      (group) => normalizeSkillsLabel(group.heading) === targetCategory,
    );
    const suggestedSection = suggestedGroups.find(
      (group) => group.items.length === (originalSection?.items.length ?? -1)
        && group.items.every((item) => originalSection?.items.includes(item)),
    );
    const displayCategory =
      originalSection?.heading ?? suggestedSection?.heading ?? suggestion.skillScope.category;

    return {
      suggestionId: suggestion.id,
      mode: "group_rename",
      targetCategory: displayCategory,
      originalSections: originalSection ? [{ heading: originalSection.heading, items: [] }] : [],
      suggestedSections: suggestedSection ? [{ heading: suggestedSection.heading, items: [] }] : [],
    };
  }

  if (suggestion.skillScope?.type === "group_contents" && suggestion.skillScope.category) {
    const targetCategory = normalizeSkillsLabel(suggestion.skillScope.category);
    const originalSection = originalGroups.find(
      (group) => normalizeSkillsLabel(group.heading) === targetCategory,
    );
    const suggestedSection = suggestedGroups.find(
      (group) => normalizeSkillsLabel(group.heading) === targetCategory,
    );
    const displayCategory =
      originalSection?.heading ?? suggestedSection?.heading ?? suggestion.skillScope.category;

    return {
      suggestionId: suggestion.id,
      mode: "group_contents",
      targetCategory: displayCategory,
      originalSections: originalSection ? [originalSection] : [],
      suggestedSections: suggestedSection ? [suggestedSection] : [],
    };
  }

  const suggestedGroupLabels = new Set(suggestedGroups.map((g) => normalizeSkillsLabel(g.heading)));
  const scopedOriginalGroups = originalGroups.filter((g) => suggestedGroupLabels.has(normalizeSkillsLabel(g.heading)));

  return {
    suggestionId: suggestion.id,
    mode: "group_contents",
    originalSections: scopedOriginalGroups.length > 0 ? scopedOriginalGroups : originalGroups,
    suggestedSections: suggestedGroups,
  };
}

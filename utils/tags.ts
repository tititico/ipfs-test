export const parseTags = (tagsStr: string | undefined): string[] => {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === 'string' && t.length > 0);
  } catch {
    if (tagsStr.includes(',')) {
      return tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (tagsStr.trim()) return [tagsStr.trim()];
  }
  return [];
};

export const stringifyTags = (tags: string[]): string => {
  return JSON.stringify(tags);
};
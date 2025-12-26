import { useState, useEffect, useMemo } from 'react';
import { IPFSFileWithTags } from '../types/app';
import { STORAGE_KEY } from '../constants';
import { parseNDJSONObjects } from '../utils/ipfs';
import { parseTags, stringifyTags } from '../utils/tags';

const TAG_OPTIONS_KEY = `${STORAGE_KEY}__tag_options_v1`;

export function useFileManagement() {
  const [files, setFiles] = useState<IPFSFileWithTags[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [updatingTagFileId, setUpdatingTagFileId] = useState<string | null>(null);
  const [tagOptions, setTagOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem(TAG_OPTIONS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.filter((t) => typeof t === 'string' && t.trim().length > 0);
      } catch {
        return [];
      }
    }
    return [];
  });

  const fetchPinsFromCluster = async () => {
    try {
      const response = await fetch('/cluster/pins', { cache: 'no-store' });
      if (response.ok) {
        const text = await response.text();
        const pins = parseNDJSONObjects(text);

        const newFiles: IPFSFileWithTags[] = pins.map((pin: any, idx: number) => {
          const cid = pin?.cid || pin?.Cid || pin?.CID || pin?.pin?.cid || `unknown_${idx}`;
          const name = pin?.name || pin?.Name || pin?.pin?.name || `File ${idx + 1}`;
          const size = pin?.size || pin?.Size || pin?.pin?.size || 0;
          const createdAt = pin?.timestamp || pin?.Timestamp || pin?.pin?.timestamp || new Date().toISOString();

          const metaTags = pin?.metadata?.tags || pin?.meta?.tags || pin?.pin?.metadata?.tags || pin?.pin?.meta?.tags;
          const tags = parseTags(metaTags);

          const owner = pin?.metadata?.owner || pin?.meta?.owner || pin?.pin?.metadata?.owner || pin?.pin?.meta?.owner;

          return {
            id: cid,
            name,
            size,
            createdAt,
            tags,
            owner,
          };
        });

        setFiles(newFiles);
      }
    } catch (error) {
      console.error('Error fetching pins from cluster:', error);
    }
  };

  const addTagToFile = async (fileId: string, newTag: string) => {
    setUpdatingTagFileId(fileId);
    try {
      const file = files.find((f) => f.id === fileId);
      if (!file) return;

      const updatedTags = [...file.tags, newTag].filter(Boolean);
      const response = await fetch(`/cluster/pins/${encodeURIComponent(fileId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: fileId,
          name: file.name,
          metadata: {
            tags: stringifyTags(updatedTags),
            owner: file.owner || '',
          },
        }),
      });

      if (response.ok) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, tags: updatedTags } : f
        ));
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setUpdatingTagFileId(null);
    }
  };

  const removeTagFromFile = async (fileId: string, tagToRemove: string) => {
    setUpdatingTagFileId(fileId);
    try {
      const file = files.find((f) => f.id === fileId);
      if (!file) return;

      const updatedTags = file.tags.filter(tag => tag !== tagToRemove);
      const response = await fetch(`/cluster/pins/${encodeURIComponent(fileId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: fileId,
          name: file.name,
          metadata: {
            tags: stringifyTags(updatedTags),
            owner: file.owner || '',
          },
        }),
      });

      if (response.ok) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, tags: updatedTags } : f
        ));
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setUpdatingTagFileId(null);
    }
  };

  const addTagOption = (tag: string) => {
    if (!tag || tag.trim().length === 0) return;
    const trimmed = tag.trim();
    if (!tagOptions.includes(trimmed)) {
      const updated = [...tagOptions, trimmed].sort((a, b) => a.localeCompare(b, 'ja'));
      setTagOptions(updated);
      localStorage.setItem(TAG_OPTIONS_KEY, JSON.stringify(updated));
    }
  };

  const deleteTagOption = (tag: string) => {
    const updated = tagOptions.filter(t => t !== tag);
    setTagOptions(updated);
    localStorage.setItem(TAG_OPTIONS_KEY, JSON.stringify(updated));
  };

  const usedTags = useMemo(() => {
    const used = new Set<string>();
    files.forEach(file => file.tags.forEach(tag => used.add(tag)));
    return used;
  }, [files]);

  const availableTags = useMemo(() => {
    return Array.from(new Set([...tagOptions, ...Array.from(usedTags)])).sort();
  }, [tagOptions, usedTags]);

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      if (selectedTagFilter !== 'all' && !file.tags.includes(selectedTagFilter)) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          file.name.toLowerCase().includes(query) ||
          file.id.toLowerCase().includes(query) ||
          file.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [files, selectedTagFilter, searchQuery]);

  return {
    files,
    setFiles,
    filteredFiles,
    searchQuery,
    setSearchQuery,
    selectedTagFilter,
    setSelectedTagFilter,
    tagOptions,
    usedTags,
    availableTags,
    updatingTagFileId,
    fetchPinsFromCluster,
    addTagToFile,
    removeTagFromFile,
    addTagOption,
    deleteTagOption,
  };
}
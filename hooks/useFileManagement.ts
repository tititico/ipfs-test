import { useState, useEffect, useMemo } from 'react';
import { IPFSFileWithTags } from '../types/app';
import { STORAGE_KEY } from '../constants';
import { parseNDJSONObjects } from '../utils/ipfs';
import { parseTags, stringifyTags } from '../utils/tags';

const TAG_OPTIONS_KEY = `${STORAGE_KEY}__tag_options_v1`;

export function useFileManagement(walletAccount?: string | null) {
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
          const size = pin?.size || pin?.Size || pin?.pin?.size || 
                      pin?.metadata?.size || pin?.meta?.size || 
                      pin?.pin?.metadata?.size || pin?.pin?.meta?.size || 0;
          const createdAt = pin?.timestamp || pin?.Timestamp || pin?.pin?.timestamp || new Date().toISOString();

          const metaTags = pin?.metadata?.tags || pin?.meta?.tags || pin?.pin?.metadata?.tags || pin?.pin?.meta?.tags;
          const tags = parseTags(metaTags);

          const owner = pin?.metadata?.owner || pin?.meta?.owner || pin?.pin?.metadata?.owner || pin?.pin?.meta?.owner;

          return {
            id: cid,
            name,
            size: typeof size === 'string' ? parseInt(size) || 0 : size || 0,
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

      if (file.tags.includes(newTag)) return;

      const updatedTags = [...file.tags, newTag];
      
      // Use original App.tsx method with URL parameters
      const params = new URLSearchParams();
      params.set('name', file.name);
      params.set('meta-size', String(file.size || 0));
      params.set('meta-tags', stringifyTags(updatedTags));
      params.set('meta-uploadedAt', file.createdAt || new Date().toISOString());
      params.set('meta-originalName', file.name);
      if (file.owner) {
        params.set('meta-owner', file.owner);
      }

      const url = `/cluster/pins/${encodeURIComponent(fileId)}?${params.toString()}`;
      console.log('[AddTag] POST URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
      });

      const text = await response.text().catch(() => '');
      console.log('[AddTag] status=', response.status, 'body=', text);

      if (response.ok) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, tags: updatedTags } : f
        ));
      } else {
        throw new Error(`Update metadata failed: HTTP ${response.status} ${text}`);
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
      
      // Use original App.tsx method with URL parameters
      const params = new URLSearchParams();
      params.set('name', file.name);
      params.set('meta-size', String(file.size || 0));
      params.set('meta-tags', stringifyTags(updatedTags));
      params.set('meta-uploadedAt', file.createdAt || new Date().toISOString());
      params.set('meta-originalName', file.name);
      if (file.owner) {
        params.set('meta-owner', file.owner);
      }

      const url = `/cluster/pins/${encodeURIComponent(fileId)}?${params.toString()}`;
      console.log('[RemoveTag] POST URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
      });

      const text = await response.text().catch(() => '');
      console.log('[RemoveTag] status=', response.status, 'body=', text);

      if (response.ok) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, tags: updatedTags } : f
        ));
      } else {
        throw new Error(`Update metadata failed: HTTP ${response.status} ${text}`);
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

  // 首先过滤当前用户的文件
  const userFiles = useMemo(() => {
    if (!walletAccount) return [];
    return files.filter((f) => (f.owner || '').toLowerCase() === walletAccount.toLowerCase());
  }, [files, walletAccount]);

  const filteredFiles = useMemo(() => {
    return userFiles.filter(file => {
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
  }, [userFiles, selectedTagFilter, searchQuery]);

  return {
    files,
    setFiles,
    userFiles,
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
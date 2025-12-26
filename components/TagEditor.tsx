import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, CheckCircle2, Loader2 } from 'lucide-react';

interface TagEditorProps {
  tags: string[];
  availableTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  isUpdating: boolean;
}

export const TagEditor = ({
  tags,
  availableTags,
  onAddTag,
  onRemoveTag,
  isUpdating,
}: TagEditorProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onAddTag(newTag.trim());
      setNewTag('');
      setIsAdding(false);
    }
  };

  const handleSelectExisting = (tag: string) => {
    if (!tags.includes(tag)) {
      onAddTag(tag);
    }
    setShowDropdown(false);
    setIsAdding(false);
  };

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const unusedTags = availableTags.filter((t) => !tags.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-700"
        >
          {tag}
          <button
            onClick={() => onRemoveTag(tag)}
            disabled={isUpdating}
            className="hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {tags.length === 0 && !isAdding && <span className="text-[10px] text-gray-400 font-bold">タグなし</span>}

      {isAdding ? (
        <div className="relative">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewTag('');
                }
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="新しいタグ..."
              className="w-24 px-2 py-0.5 text-[10px] font-bold border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={isUpdating}
            />
            <button
              onClick={handleAddTag}
              disabled={isUpdating || !newTag.trim()}
              className="p-0.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewTag('');
                setShowDropdown(false);
              }}
              className="p-0.5 text-gray-500 hover:bg-gray-100 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {showDropdown && unusedTags.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px] max-h-32 overflow-y-auto">
              <div className="p-1">
                <p className="text-[9px] text-gray-400 font-bold px-2 py-1">既存のタグ</p>
                {unusedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSelectExisting(tag)}
                    className="w-full text-left px-2 py-1 text-[10px] font-bold text-black hover:bg-indigo-50 rounded transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          disabled={isUpdating}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
        >
          <Plus className="w-3 h-3" />
          追加
        </button>
      )}

      {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />}
    </div>
  );
};
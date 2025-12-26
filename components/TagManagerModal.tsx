import React, { useState, useEffect } from 'react';
import { X, Tag, Trash2 } from 'lucide-react';

interface TagManagerModalProps {
  open: boolean;
  onClose: () => void;
  tagOptions: string[];
  usedTags: Set<string>;
  onAdd: (t: string) => void;
  onDelete: (t: string) => void;
}

export const TagManagerModal = ({
  open,
  onClose,
  tagOptions,
  usedTags,
  onAdd,
  onDelete,
}: TagManagerModalProps) => {
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (open) setNewTag('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-black flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            タグ管理
          </h2>
          <button onClick={onClose} className="text-black hover:text-indigo-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-black text-black mb-2">新しいタグを追加</label>
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onAdd(newTag);
                    setNewTag('');
                  }
                }}
                placeholder="例：請求書 / 契約書 / 写真..."
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-black font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  onAdd(newTag);
                  setNewTag('');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black"
              >
                追加
              </button>
            </div>
            <p className="text-[10px] text-gray-500 font-bold mt-2">※ 既にファイルで使用中のタグは削除できません</p>
          </div>

          <div>
            <label className="block text-sm font-black text-black mb-2">登録済みタグ</label>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl">
              {tagOptions.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 font-bold">タグがありません</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {tagOptions.map((t) => {
                    const inUse = usedTags.has(t);
                    return (
                      <li key={t} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">
                            {t}
                          </span>
                          {inUse && <span className="text-[10px] font-black text-gray-500">使用中</span>}
                        </div>

                        <button
                          type="button"
                          onClick={() => onDelete(t)}
                          disabled={inUse}
                          className={`p-2 rounded transition-all ${
                            inUse ? 'text-gray-300 cursor-not-allowed' : 'text-black hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={inUse ? '使用中のため削除不可' : '削除'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-gray-100 text-black font-black rounded-lg hover:bg-gray-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
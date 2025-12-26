import React from 'react';
import { Search, Filter, Tag, X, ChevronRight, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { TagEditor } from '../components/TagEditor';
import { formatSize, formatDate } from '../utils/formatters';
import { IPFSFileWithTags } from '../types/app';

interface FilesViewProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTagFilter: string;
  setSelectedTagFilter: (filter: string) => void;
  availableTags: string[];
  filteredFiles: IPFSFileWithTags[];
  updatingTagFileId: string | null;
  onAddTag: (file: IPFSFileWithTags, tag: string) => void;
  onRemoveTag: (file: IPFSFileWithTags, tag: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRefresh: () => void;
  onManageTags: () => void;
  copyToClipboard: (text: string) => void;
}

const MANAGE_TAG_VALUE = '__manage_tags__';

export const FilesView = ({
  searchQuery,
  setSearchQuery,
  selectedTagFilter,
  setSelectedTagFilter,
  availableTags,
  filteredFiles,
  updatingTagFileId,
  onAddTag,
  onRemoveTag,
  onDeleteFile,
  onRefresh,
  onManageTags,
  copyToClipboard,
}: FilesViewProps) => (
  <div className="space-y-6 animate-fade-in">
    {/* 搜索 + Tag 筛选栏 */}
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
        <input
          type="text"
          placeholder="ファイル名、CID、タグで検索..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-black font-bold placeholder:text-black placeholder:opacity-50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tag 筛选下拉 */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" />
        <select
          value={selectedTagFilter}
          onChange={(e) => {
            const v = e.target.value;
            if (v === MANAGE_TAG_VALUE) {
              onManageTags();
              return;
            }
            setSelectedTagFilter(v);
          }}
          className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-black font-bold appearance-none cursor-pointer min-w-[160px]"
        >
          <option value="all">すべてのタグ</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
          <option value={MANAGE_TAG_VALUE}>+ タグを管理...</option>
        </select>
        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-black w-4 h-4 rotate-90 pointer-events-none" />
      </div>

      <button
        onClick={onRefresh}
        className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded-lg font-black transition-all"
      >
        再読み込み
      </button>
    </div>

    {/* 当前筛选状态提示 */}
    {(selectedTagFilter !== 'all' || searchQuery) && (
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="text-black font-bold">フィルター:</span>
        {selectedTagFilter !== 'all' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black">
            <Tag className="w-3 h-3" />
            {selectedTagFilter}
            <button onClick={() => setSelectedTagFilter('all')} className="ml-1 hover:text-indigo-900">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {searchQuery && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-black">
            <Search className="w-3 h-3" />
            "{searchQuery}"
            <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-gray-900">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        <span className="text-black font-bold ml-2">{filteredFiles.length} 件</span>
      </div>
    )}

    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider">ファイル名</th>
              <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider">CID (IPFS)</th>
              <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider">タグ</th>
              <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider text-center">
                レプリケーション
              </th>
              <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider">サイズ</th>
              <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredFiles.length > 0 ? (
              filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-black mb-1">{file.name}</span>
                      <span className="text-[10px] text-gray-500 font-bold">{formatDate(file.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 group/cid">
                      <code className="text-xs text-black font-bold bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-[140px]">
                        {file.id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(file.id)}
                        title="CIDをコピー"
                        className="p-1.5 text-black hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`https://ipfs.io/ipfs/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="IPFSで開く"
                        className="p-1.5 text-black hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <TagEditor
                      tags={file.tags}
                      availableTags={availableTags}
                      onAddTag={(tag) => onAddTag(file, tag)}
                      onRemoveTag={(tag) => onRemoveTag(file, tag)}
                      isUpdating={updatingTagFileId === file.id}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-black text-black">
                      {(file.replication || 0) > 0 ? `${file.replication} Nodes` : `-`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-black font-bold">
                    {file.size ? formatSize(file.size) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onDeleteFile(file.id)}
                        className="p-2 text-black hover:text-red-600 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-black">
                  <div className="flex flex-col items-center">
                    <Search className="w-12 h-12 mb-3 opacity-100" />
                    <p className="font-black">ファイルが見つかりません</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
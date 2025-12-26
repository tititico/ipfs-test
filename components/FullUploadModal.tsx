import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Upload, Files, Folder, FolderOpen, CheckCircle2, 
  Loader2, Plus 
} from 'lucide-react';
import { formatSize } from '../utils/formatters';
import { UploadItem } from '../types/app';

interface FullUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (items: UploadItem[], tags: string[]) => void;
  isUploading: boolean;
  uploadProgress: { current: number; total: number } | null;
  tagOptions: string[];
}

// 递归读取文件夹
const readDirectoryRecursive = async (dirEntry: FileSystemDirectoryEntry, basePath: string = ''): Promise<UploadItem[]> => {
  const items: UploadItem[] = [];
  const dirReader = dirEntry.createReader();

  const readEntries = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
  };

  let entries: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await readEntries();
    entries = entries.concat(batch);
  } while (batch.length > 0);

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file: File = await new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      items.push({ file, relativePath });
    } else if (entry.isDirectory) {
      const subItems = await readDirectoryRecursive(entry as FileSystemDirectoryEntry, relativePath);
      items.push(...subItems);
    }
  }
  return items;
};

// 解析拖拽数据
const readDataTransferItems = async (items: DataTransferItemList): Promise<UploadItem[]> => {
  const uploadItems: UploadItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file: File = await new Promise((resolve, reject) => {
            fileEntry.file(resolve, reject);
          });
          uploadItems.push({ file, relativePath: file.name });
        } else if (entry.isDirectory) {
          const dirItems = await readDirectoryRecursive(entry as FileSystemDirectoryEntry, entry.name);
          uploadItems.push(...dirItems);
        }
      }
    }
  }
  return uploadItems;
};

export const FullUploadModal = ({
  open,
  onClose,
  onUpload,
  isUploading,
  uploadProgress,
  tagOptions,
}: FullUploadModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [droppedItems, setDroppedItems] = useState<UploadItem[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const clearDroppedItems = () => {
    setDroppedItems([]);
    setFolderName(null);
  };

  const totalDroppedSize = droppedItems.reduce((acc, item) => acc + item.file.size, 0);

  // 拖拽事件处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (isUploading) return;

    try {
      const items = await readDataTransferItems(e.dataTransfer.items);
      if (items.length > 0) {
        setDroppedItems(items);
        
        // 检查是否为文件夹（所有文件都有共同前缀）
        const paths = items.map(item => item.relativePath);
        const commonPrefix = paths.reduce((prefix, path) => {
          const parts = path.split('/');
          if (parts.length > 1 && prefix === null) {
            return parts[0];
          }
          if (prefix && path.startsWith(prefix + '/')) {
            return prefix;
          }
          return null;
        }, null as string | null);

        if (commonPrefix) {
          setFolderName(commonPrefix);
        }
      }
    } catch (error) {
      console.error('Error reading dropped items:', error);
    }
  };

  // 文件选择处理
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const items: UploadItem[] = Array.from(e.target.files).map(file => ({
        file,
        relativePath: file.name,
      }));
      setDroppedItems(items);
      setFolderName(null);
    }
  };

  // 文件夹选择处理
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const items: UploadItem[] = Array.from(e.target.files).map(file => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      }));
      setDroppedItems(items);
      
      // 提取文件夹名称
      if (items.length > 0) {
        const firstPath = items[0].relativePath;
        const folderName = firstPath.split('/')[0];
        setFolderName(folderName);
      }
    }
  };

  const handleUpload = () => {
    if (droppedItems.length > 0) {
      onUpload(droppedItems, selectedUploadTags);
    }
  };

  // 重置状态
  const handleClose = () => {
    if (!isUploading) {
      clearDroppedItems();
      setSelectedUploadTags([]);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleClose}
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-black">ファイル / フォルダをアップロード</h2>
          <button onClick={handleClose} className="text-black hover:text-indigo-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drag & Drop 区域 */}
          <div>
            <label className="block text-sm font-black text-black mb-2">ファイルまたはフォルダを選択</label>
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
                    : droppedItems.length > 0
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }
                ${isUploading ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              <input 
                ref={fileInputRef} 
                type="file" 
                multiple 
                onChange={handleFileInputChange} 
                disabled={isUploading} 
                className="hidden" 
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                multiple
                onChange={handleFolderInputChange}
                disabled={isUploading}
                className="hidden"
              />

              {droppedItems.length > 0 ? (
                <div className="flex flex-col items-center">
                  {folderName ? (
                    <FolderOpen className="w-12 h-12 text-green-500 mb-3" />
                  ) : (
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  )}
                  <p className="text-sm font-black text-green-700 mb-1">
                    {folderName ? (
                      <span className="inline-flex items-center gap-1">
                        <Folder className="w-4 h-4" />
                        {folderName}
                      </span>
                    ) : droppedItems.length === 1 ? (
                      droppedItems[0].relativePath
                    ) : (
                      `${droppedItems.length} 件のファイル`
                    )}
                  </p>
                  <p className="text-xs text-green-600 font-bold">
                    {droppedItems.length} ファイル・{formatSize(totalDroppedSize)}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearDroppedItems();
                    }}
                    className="mt-3 text-xs font-black text-red-600 hover:text-red-700 hover:underline"
                  >
                    クリア
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className={`w-12 h-12 mb-3 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
                  <p className="text-sm font-black text-black mb-1">
                    {isDragging ? 'ここにドロップ！' : 'ドラッグ＆ドロップ'}
                  </p>
                  <p className="text-xs text-gray-500 font-bold mb-3">ファイルまたはフォルダをドロップ</p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Files className="w-4 h-4" />
                      ファイル選択
                    </button>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Folder className="w-4 h-4" />
                      フォルダ選択
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ファイル一覧 */}
          {droppedItems.length > 1 && (
            <div>
              <label className="block text-sm font-black text-black mb-2">
                アップロードファイル一覧（{droppedItems.length} 件）
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50">
                <ul className="divide-y divide-gray-100 text-xs">
                  {droppedItems.slice(0, 50).map((item, idx) => (
                    <li key={idx} className="px-3 py-1.5 flex items-center justify-between">
                      <span className="text-gray-700 font-bold truncate max-w-[240px]" title={item.relativePath}>
                        {item.relativePath}
                      </span>
                      <span className="text-gray-500 font-bold ml-2 shrink-0">{formatSize(item.file.size)}</span>
                    </li>
                  ))}
                  {droppedItems.length > 50 && (
                    <li className="px-3 py-1.5 text-gray-400 font-bold text-center">
                      ...他 {droppedItems.length - 50} 件
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* タグ選択 */}
          <div>
            <label className="block text-sm font-black text-black mb-2">タグを選択（複数可）</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg min-h-[60px]">
              {selectedUploadTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-black bg-indigo-100 text-indigo-700">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setSelectedUploadTags((prev) => prev.filter((t) => t !== tag))}
                    disabled={isUploading}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !selectedUploadTags.includes(e.target.value)) {
                    setSelectedUploadTags((prev) => [...prev, e.target.value]);
                  }
                }}
                disabled={isUploading}
                className="px-2 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">タグを選択</option>
                {tagOptions.filter((t) => !selectedUploadTags.includes(t)).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">タグは後から追加・削除できます</p>
          </div>

          {/* アップロード進度 */}
          {uploadProgress && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-indigo-700">アップロード中...</span>
                <span className="text-xs font-bold text-indigo-600">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* アップロードボタン */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-black hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleUpload}
              disabled={droppedItems.length === 0 || isUploading}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  アップロード中
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  アップロード開始
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
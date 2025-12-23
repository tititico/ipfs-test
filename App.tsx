import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Files,
  Settings,
  Search,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  HardDrive,
  Activity,
  ChevronRight,
  Loader2,
  X,
  Server,
  Cloud,
  Upload,
  Tag,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { IPFSFile, FileType } from './types';
import { STORAGE_KEY, SERVER_IP, CLUSTER_PORT, FILE_TYPES } from './constants';

type ViewType = 'dashboard' | 'files' | 'cluster' | 'settings';

// ✅ 扩展文件类型支持多标签
interface IPFSFileWithTags extends Omit<IPFSFile, 'type'> {
  tags: string[];
}

// --- Components ---
const Sidebar = ({
  activeView,
  onViewChange,
}: {
  activeView: ViewType;
  onViewChange: (v: ViewType) => void;
}) => {
  const navItems = [
    { id: 'dashboard' as ViewType, label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'files' as ViewType, label: 'ファイル管理', icon: Files },
    { id: 'cluster' as ViewType, label: 'クラスター状況', icon: Activity },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 hidden md:flex flex-col z-50">
      <div className="p-4 md:p-6 border-b border-gray-100">
        <div className="flex items-center">
          <img 
            src="/AIOdropdrive_logo.png" 
            alt="AIO DropDrive Logo" 
            className="h-12 md:h-14 object-contain"
          />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold transition-colors ${
              activeView === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-black hover:bg-gray-50'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold transition-colors ${
            activeView === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-black hover:bg-gray-50'
          }`}
        >
          <Settings className="w-5 h-5" />
          設定
        </button>
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  unit = '',
}: {
  title: string;
  value: string | number;
  icon: any;
  unit?: string;
}) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-bold text-black mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="text-2xl font-black text-black">{value}</h3>
        {unit && <span className="text-sm text-black font-bold">{unit}</span>}
      </div>
    </div>
    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
      <Icon className="w-6 h-6" />
    </div>
  </div>
);

const Toast = ({
  message,
  type = 'success',
  onClose,
}: {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          type === 'success'
            ? 'bg-green-50 border-green-200 text-green-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}
      >
        {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
        <span className="font-black text-sm">{message}</span>
      </div>
    </div>
  );
};

// ✅ 多标签编辑组件
const TagEditor = ({
  tags,
  availableTags,
  onAddTag,
  onRemoveTag,
  isUpdating,
}: {
  tags: string[];
  availableTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  isUpdating: boolean;
}) => {
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

  // 未使用的现有标签
  const unusedTags = availableTags.filter(t => !tags.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* 显示现有标签 */}
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

      {/* 无标签时显示占位符 */}
      {tags.length === 0 && !isAdding && (
        <span className="text-[10px] text-gray-400 font-bold">タグなし</span>
      )}

      {/* 添加标签 */}
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

          {/* 下拉选择现有标签 */}
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

// --- Utils ---
const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const parseIpfsAddResponse = (rawText: string) => {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: any[] = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }

  if (parsed.length === 0) {
    return { last: {}, cid: undefined, linesCount: 0 };
  }

  const fileEntry = parsed.find(p => p?.Name && p.Name.length > 0) || parsed[parsed.length - 1];
  
  console.log('[parseIpfsAddResponse] All entries:', parsed);
  console.log('[parseIpfsAddResponse] Selected entry:', fileEntry);

  const cid: string | undefined = fileEntry?.Hash || fileEntry?.Cid || fileEntry?.cid || fileEntry?.CID;
  return { last: fileEntry, cid, linesCount: lines.length };
};

const parseNDJSONObjects = (rawText: string) => {
  const lines = (rawText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const objs: any[] = [];
  for (const line of lines) {
    try {
      objs.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }
  return objs;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitForPinVisible = async (cid: string, tries = 12) => {
  console.log(`[waitForPinVisible] Waiting for CID: ${cid}`);
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`/cluster/pins/${encodeURIComponent(cid)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      console.log(`[waitForPinVisible] Try ${i + 1}: /cluster/pins/${cid} status=${r.status}`);
      if (r.ok) return true;

      const r2 = await fetch(`/cluster/pins`, { method: 'GET', cache: 'no-store' });
      if (r2.ok) {
        const text = await r2.text();
        const nd = parseNDJSONObjects(text);
        if (nd.length) {
          if (nd.some((p: any) => (p?.cid || p?.Cid || p?.CID || p?.pin?.cid) === cid)) return true;
        } else {
          try {
            const json = JSON.parse(text);
            const pins = Array.isArray(json)
              ? json
              : Array.isArray(json?.pins)
                ? json.pins
                : json && typeof json === 'object'
                  ? Object.values(json)
                  : [];
            if (Array.isArray(pins) && pins.some((p: any) => (p?.cid || p?.Cid || p?.CID || p?.pin?.cid) === cid))
              return true;
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.log(`[waitForPinVisible] Try ${i + 1} error:`, err);
    }

    await sleep(500 + i * 300);
  }
  return false;
};

const pinToClusterAPI = async (cid: string, name: string, meta: Record<string, string>) => {
  const params = new URLSearchParams();
  params.set('name', name);
  
  Object.entries(meta).forEach(([key, value]) => {
    params.append(`meta-${key}`, value);
  });

  const url = `/cluster/pins/${encodeURIComponent(cid)}?${params.toString()}`;
  console.log('[pinToClusterAPI] POST URL:', url);

  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
  });
  
  const text = await res.text().catch(() => '');
  console.log('[pinToClusterAPI] status=', res.status, 'body=', text);
  
  if (!res.ok) throw new Error(`Cluster API pin 失敗: HTTP ${res.status} ${text}`);
  return text;
};

const pinToPinningAPI = async (cid: string, name: string, meta: Record<string, string>) => {
  const res = await fetch(`/pinning/pins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, name, meta }),
    cache: 'no-store',
  });
  const text = await res.text().catch(() => '');
  console.log('[pinToPinningAPI] status=', res.status, 'body=', text);
  if (!res.ok) throw new Error(`Pinning API pin 失敗: HTTP ${res.status} ${text}`);
  return text;
};

// ✅ 更新 pin 的 metadata（用于修改 tags）
const updatePinMetadata = async (cid: string, name: string, meta: Record<string, string>) => {
  const params = new URLSearchParams();
  params.set('name', name);
  
  Object.entries(meta).forEach(([key, value]) => {
    params.append(`meta-${key}`, value);
  });

  const url = `/cluster/pins/${encodeURIComponent(cid)}?${params.toString()}`;
  console.log('[updatePinMetadata] POST URL:', url);

  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
  });
  
  const text = await res.text().catch(() => '');
  console.log('[updatePinMetadata] status=', res.status, 'body=', text);
  
  if (!res.ok) throw new Error(`Update metadata 失敗: HTTP ${res.status} ${text}`);
  return text;
};

// ✅ 解析 tags 字符串为数组
const parseTags = (tagsStr: string | undefined): string[] => {
  if (!tagsStr) return [];
  try {
    // 尝试 JSON 解析
    const parsed = JSON.parse(tagsStr);
    if (Array.isArray(parsed)) return parsed.filter(t => typeof t === 'string' && t.length > 0);
  } catch {
    // 如果不是 JSON，按逗号分隔
    if (tagsStr.includes(',')) {
      return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    }
    // 单个标签
    if (tagsStr.trim()) return [tagsStr.trim()];
  }
  return [];
};

// ✅ 将 tags 数组转为存储字符串
const stringifyTags = (tags: string[]): string => {
  return JSON.stringify(tags);
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [files, setFiles] = useState<IPFSFileWithTags[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(0);
  
  // Drag & Drop 状态
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // ✅ Tag 筛选状态
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  
  // ✅ Tag 更新状态
  const [updatingTagFileId, setUpdatingTagFileId] = useState<string | null>(null);

  // ✅ 上传时选择的多个 tags
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // ---- Cluster API ----
  const fetchNodeCount = useCallback(async () => {
    try {
      const res = await fetch('/cluster/peers', { method: 'GET', cache: 'no-store' });
      if (res.status === 204) {
        setNodeCount(0);
        return;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      let peers: any = null;
      try {
        peers = JSON.parse(text);
      } catch {
        const arr = parseNDJSONObjects(text);
        peers = arr.length ? arr : null;
      }

      if (Array.isArray(peers)) setNodeCount(peers.length);
      else if (peers && typeof peers === 'object') setNodeCount(Object.keys(peers).length);
      else setNodeCount(0);
    } catch (e) {
      console.error('Failed to fetch peers:', e);
      setNodeCount(0);
    }
  }, []);

  const fetchPinsFromCluster = useCallback(async () => {
    try {
      console.log('[fetchPinsFromCluster] Fetching...');
      const res = await fetch('/cluster/pins', { method: 'GET', cache: 'no-store' });

      if (res.status === 204) {
        setFiles([]);
        return;
      }

      const text = await res.text();
      console.log('[fetchPinsFromCluster] Raw response length:', text.length);
      
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      let pins: any[] = parseNDJSONObjects(text);
      console.log('[fetchPinsFromCluster] NDJSON parsed count:', pins.length);

      if (!pins.length) {
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) pins = json;
          else if (json?.pins && Array.isArray(json.pins)) pins = json.pins;
          else if (json && typeof json === 'object') {
            const vals = Object.values(json);
            pins = vals.filter((v) => v && typeof v === 'object');
          }
        } catch {
          // ignore
        }
      }

      if (!pins.length) {
        console.warn('fetchPinsFromCluster: parsed 0 pins.');
        setFiles([]);
        return;
      }

      const clusterFiles: IPFSFileWithTags[] = pins.map((p: any) => {
        const cid = p?.cid || p?.Cid || p?.CID || p?.pin?.cid || '';
        const meta =
          p?.meta ||
          p?.metadata ||
          p?.pin?.meta ||
          p?.pin?.metadata ||
          p?.pin?.pin?.meta ||
          p?.pin?.pin?.metadata ||
          {};

        const createdAt =
          meta?.uploadedAt ||
          p?.created ||
          p?.timestamp ||
          p?.pin?.created ||
          p?.pin?.timestamp ||
          new Date().toISOString();

        const rep =
          (Array.isArray(p?.allocations) && p.allocations.length) ||
          (Array.isArray(p?.pin?.allocations) && p.pin.allocations.length) ||
          (p?.peer_map && typeof p.peer_map === 'object' ? Object.keys(p.peer_map).length : 0) ||
          (p?.pin?.peer_map && typeof p.pin.peer_map === 'object' ? Object.keys(p.pin.peer_map).length : 0) ||
          0;

        const name =
          (typeof p?.name === 'string' && p.name) ||
          (typeof p?.pin?.name === 'string' && p.pin.name) ||
          (typeof meta?.name === 'string' && meta.name) ||
          (typeof meta?.originalName === 'string' && meta.originalName) ||
          cid;

        const size =
          typeof meta?.size === 'number'
            ? meta.size
            : typeof meta?.size === 'string'
              ? Number(meta.size) || 0
              : 0;

        // ✅ 解析 tags（支持新格式和旧格式兼容）
        let tags: string[] = [];
        if (meta?.tags) {
          tags = parseTags(meta.tags);
        } else if (meta?.type) {
          // 兼容旧的单 type 字段
          tags = parseTags(meta.type);
        }

        return {
          id: crypto.randomUUID(),
          name,
          cid,
          size,
          createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
          tags,
          replication: typeof rep === 'number' ? rep : 0,
        };
      });

      clusterFiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      console.log('[fetchPinsFromCluster] Processed files count:', clusterFiles.length);
      setFiles(clusterFiles);
    } catch (e) {
      console.error('Failed to fetch pins:', e);
    }
  }, []);

  // ---- Persistence ----
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 兼容旧数据格式
        const converted = parsed.map((f: any) => ({
          ...f,
          tags: f.tags || (f.type ? [f.type] : []),
        }));
        setFiles(converted);
      } catch (e) {
        console.error('Failed to parse saved files', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    fetchPinsFromCluster();
    fetchNodeCount();
  }, [fetchPinsFromCluster, fetchNodeCount]);

  // 核心上传逻辑
  const uploadFile = async (file: File, tags: string[]) => {
    console.log('=== Upload Start ===');
    console.log('[Upload] File name:', file.name);
    console.log('[Upload] File size:', file.size);
    console.log('[Upload] Tags:', tags);

    console.log('[Upload] Step 1: Adding file to IPFS...');
    
    const ipfsFormData = new FormData();
    ipfsFormData.append('file', file);
    
    const response = await fetch('/ipfs/api/v0/add?progress=false&wrap-with-directory=false', {
      method: 'POST',
      body: ipfsFormData,
      cache: 'no-store',
    });
    const rawText = await response.text();

    console.log('[IPFS add] Raw response:', rawText);

    if (!response.ok) {
      console.error('IPFS add failed:', response.status, rawText);
      throw new Error(`IPFS add 失敗: HTTP ${response.status}`);
    }

    const { cid, last, linesCount } = parseIpfsAddResponse(rawText);
    console.log('[IPFS add] Parsed result:');
    console.log('  - CID:', cid);
    console.log('  - Selected entry:', JSON.stringify(last, null, 2));
    console.log('  - Total lines:', linesCount);

    if (!cid) throw new Error('CID を取得できませんでした');

    const meta: Record<string, string> = {
      size: String(file.size),
      tags: stringifyTags(tags),
      uploadedAt: new Date().toISOString(),
      originalName: file.name,
    };
    console.log('[Upload] Metadata:', meta);

    console.log('[Upload] Step 2: Pinning to cluster...');
    try {
      await pinToClusterAPI(cid, file.name, meta);
      console.log('[Upload] Cluster API pin success!');
    } catch (clusterErr) {
      console.warn('[Upload] Cluster API failed, trying Pinning API (9097)...', clusterErr);
      await pinToPinningAPI(cid, file.name, meta);
      console.log('[Upload] Pinning API pin success!');
    }

    console.log('[Upload] Step 3: Waiting for pin to be visible...');
    const visible = await waitForPinVisible(cid, 12);
    console.log('[Upload] Pin visible:', visible);
    
    if (!visible) {
      console.warn('[Upload] Pin not visible in cluster, but continuing...');
    }

    const newFile: IPFSFileWithTags = {
      id: crypto.randomUUID(),
      name: file.name,
      cid,
      size: file.size,
      createdAt: meta.uploadedAt,
      tags,
      replication: 0,
    };
    
    console.log('=== Upload Complete ===');
    return newFile;
  };

  // ---- Actions ----
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    const fileInput = droppedFile;

    if (!fileInput || fileInput.size === 0) {
      showToast('ファイルを選択してください', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const newFile = await uploadFile(fileInput, selectedUploadTags);
      setFiles((prev) => [newFile, ...prev]);

      showToast(`アップロード成功: ${newFile.cid.slice(0, 12)}...`);

      form.reset();
      setDroppedFile(null);
      setSelectedUploadTags([]);
      setShowUploadModal(false);

      await fetchPinsFromCluster();
      await fetchNodeCount();
    } catch (err) {
      console.error('[Upload] Error:', err);
      showToast('アップロードに失敗しました。コンソールログを確認してください。', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (id: string) => {
    const target = files.find((f) => f.id === id);
    if (!target) {
      setDeleteConfirm(null);
      return;
    }

    console.log('[Delete] Deleting pin:', target.cid);

    try {
      const res = await fetch(`/cluster/pins/${encodeURIComponent(target.cid)}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const t = await res.text().catch(() => '');
      console.log('[Delete] Response:', res.status, t);
      
      if (!res.ok) {
        console.error('Unpin failed:', res.status, t);
        throw new Error(`unpin 失敗: HTTP ${res.status} ${t}`);
      }

      setDeleteConfirm(null);
      showToast('削除（unpin）が完了しました');
      await fetchPinsFromCluster();
      await fetchNodeCount();
    } catch (e) {
      console.error(e);
      showToast('削除（unpin）に失敗しました。ログを確認してください。', 'error');
      setDeleteConfirm(null);
    }
  };

  // ✅ 添加 tag
  const handleAddTag = async (file: IPFSFileWithTags, newTag: string) => {
    if (file.tags.includes(newTag)) return;

    setUpdatingTagFileId(file.id);
    try {
      const newTags = [...file.tags, newTag];
      const meta: Record<string, string> = {
        size: String(file.size),
        tags: stringifyTags(newTags),
        uploadedAt: file.createdAt,
        originalName: file.name,
      };

      await updatePinMetadata(file.cid, file.name, meta);

      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, tags: newTags } : f
      ));

      showToast('タグを追加しました');
    } catch (err) {
      console.error('[AddTag] Error:', err);
      showToast('タグの追加に失敗しました', 'error');
    } finally {
      setUpdatingTagFileId(null);
    }
  };

  // ✅ 删除 tag
  const handleRemoveTag = async (file: IPFSFileWithTags, tagToRemove: string) => {
    setUpdatingTagFileId(file.id);
    try {
      const newTags = file.tags.filter(t => t !== tagToRemove);
      const meta: Record<string, string> = {
        size: String(file.size),
        tags: stringifyTags(newTags),
        uploadedAt: file.createdAt,
        originalName: file.name,
      };

      await updatePinMetadata(file.cid, file.name, meta);

      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, tags: newTags } : f
      ));

      showToast('タグを削除しました');
    } catch (err) {
      console.error('[RemoveTag] Error:', err);
      showToast('タグの削除に失敗しました', 'error');
    } finally {
      setUpdatingTagFileId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('CIDをコピーしました');
  };

  // Drag & Drop 事件处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      setDroppedFile(file);
      console.log('[Drag & Drop] File dropped:', file.name, file.size);
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setDroppedFile(files[0]);
    }
  }, []);

  const clearDroppedFile = useCallback(() => {
    setDroppedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ✅ 获取所有唯一的 tags（用于筛选下拉）
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    files.forEach(f => {
      f.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [files]);

  // ✅ 筛选逻辑：同时支持搜索和 tag 筛选
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return files.filter((f) => {
      // Tag 筛选
      if (selectedTagFilter !== 'all' && !f.tags.includes(selectedTagFilter)) {
        return false;
      }
      // 搜索筛选
      if (q) {
        return (
          (f.name || '').toLowerCase().includes(q) ||
          (f.cid || '').toLowerCase().includes(q) ||
          f.tags.some(t => t.toLowerCase().includes(q)) ||
          formatDate(f.createdAt).includes(q)
        );
      }
      return true;
    });
  }, [files, searchQuery, selectedTagFilter]);

  const stats = useMemo(
    () => ({
      totalSize: files.reduce((acc, f) => acc + (f.size || 0), 0),
      fileCount: files.length,
      nodeCount: nodeCount || 0,
    }),
    [files, nodeCount]
  );

  // --- Views ---
  const DashboardView = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="総ストレージ容量"
          value={formatSize(stats.totalSize).split(' ')[0]}
          unit={formatSize(stats.totalSize).split(' ')[1]}
          icon={HardDrive}
        />
        <StatCard title="管理ファイル数" value={stats.fileCount} icon={Files} />
        <StatCard title="アクティブノード" value={stats.nodeCount} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2">
            <Files className="w-5 h-5 text-indigo-600" />
            最近のアップロード
          </h3>
          <div className="space-y-3">
            {files.slice(0, 5).map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setCurrentView('files')}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black text-black truncate max-w-[200px]">{file.name}</span>
                  <span className="text-[10px] text-black font-bold">{formatDate(file.createdAt)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-black" />
              </div>
            ))}
            {files.length === 0 && <p className="text-sm text-black font-bold text-center py-4">データがありません</p>}
          </div>
          <button
            onClick={() => setCurrentView('files')}
            className="w-full mt-4 text-center text-sm font-black text-indigo-600 hover:underline"
          >
            すべて表示
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-600" />
            システムステータス
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black font-bold">IPFS Cluster API</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                オンライン
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black font-bold">サーバー</span>
              <span className="text-xs font-mono text-black font-bold">
                {SERVER_IP}:{CLUSTER_PORT}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black font-bold">フロント → API</span>
              <span className="text-xs font-mono text-black font-bold">/ipfs (9095), /cluster (9094), /pinning (9097)</span>
            </div>

            <button
              onClick={() => {
                fetchPinsFromCluster();
                fetchNodeCount();
                showToast('最新状態を取得しました');
              }}
              className="w-full mt-2 text-center text-sm font-black text-indigo-600 hover:underline"
            >
              再読み込み
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const FilesView = () => (
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
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-black font-bold appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="all">すべてのタグ</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-black w-4 h-4 rotate-90 pointer-events-none" />
        </div>

        <button
          onClick={() => {
            fetchPinsFromCluster();
            fetchNodeCount();
            showToast('最新状態を取得しました');
          }}
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
              <button
                onClick={() => setSelectedTagFilter('all')}
                className="ml-1 hover:text-indigo-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-black">
              <Search className="w-3 h-3" />
              "{searchQuery}"
              <button
                onClick={() => setSearchQuery('')}
                className="ml-1 hover:text-gray-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span className="text-black font-bold ml-2">
            {filteredFiles.length} 件
          </span>
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
                <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider text-center">レプリケーション</th>
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
                          {file.cid}
                        </code>
                        <button
                          onClick={() => copyToClipboard(file.cid)}
                          title="CIDをコピー"
                          className="p-1.5 text-black hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`https://ipfs.io/ipfs/${file.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="IPFSで開く"
                          className="p-1.5 text-black hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                    {/* ✅ 多标签编辑列 */}
                    <td className="px-6 py-4">
                      <TagEditor
                        tags={file.tags}
                        availableTags={availableTags}
                        onAddTag={(tag) => handleAddTag(file, tag)}
                        onRemoveTag={(tag) => handleRemoveTag(file, tag)}
                        isUpdating={updatingTagFileId === file.id}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-black text-black">
                        {(file.replication || 0) > 0 ? `${file.replication} Nodes` : `-`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-black font-bold">{file.size ? formatSize(file.size) : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDeleteConfirm(file.id)}
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

  const ClusterView = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-black flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-600" />
            クラスター概要
          </h3>
          <button
            onClick={() => {
              fetchPinsFromCluster();
              fetchNodeCount();
              showToast('最新状態を取得しました');
            }}
            className="text-sm font-black text-indigo-600 hover:underline"
          >
            再読み込み
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-black text-black mb-1">Peers</div>
            <div className="text-2xl font-black text-black">{stats.nodeCount}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-black text-black mb-1">Pins</div>
            <div className="text-2xl font-black text-black">{stats.fileCount}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-black text-black mb-1">API</div>
            <div className="text-xs font-mono text-black font-bold">/cluster (9094)</div>
            <div className="text-xs font-mono text-black font-bold">/ipfs (9095)</div>
            <div className="text-xs font-mono text-black font-bold">/pinning (9097)</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* 移动端顶部 Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 p-3 flex items-center justify-between md:hidden z-50">
        <img 
          src="/AIOdropdrive_logo.png" 
          alt="AIO DropDrive Logo" 
          className="h-10 object-contain"
        />
        <button
          onClick={() => setShowUploadModal(true)}
          className="p-2 bg-indigo-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <Sidebar activeView={currentView} onViewChange={setCurrentView} />

      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-black">
              {currentView === 'dashboard' && 'ダッシュボード'}
              {currentView === 'files' && 'ファイル管理'}
              {currentView === 'cluster' && 'クラスター状況'}
              {currentView === 'settings' && '設定'}
            </h1>
            <p className="text-black font-bold text-sm">
              {currentView === 'dashboard' && 'IPFS クラスターバックアップの概要'}
              {currentView === 'files' && 'アップロードされたファイルの一覧と管理（pins）'}
              {currentView === 'cluster' && 'クラスターの稼働状況と pins 状態'}
              {currentView === 'settings' && 'アプリケーションとAPIの接続設定'}
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="hidden md:inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-black transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-5 h-5" />
            新規アップロード
          </button>
        </header>

        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'files' && <FilesView />}
        {currentView === 'cluster' && <ClusterView />}
        {currentView === 'settings' && (
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-black mb-4">API 設定</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-black text-black mb-1">IPFS Cluster IP</label>
                <input
                  type="text"
                  readOnly
                  value={SERVER_IP}
                  className="w-full p-2 bg-gray-50 border rounded text-sm text-black font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-black mb-1">Port</label>
                <input
                  type="text"
                  readOnly
                  value={CLUSTER_PORT}
                  className="w-full p-2 bg-gray-50 border rounded text-sm text-black font-bold outline-none"
                />
              </div>
              <p className="text-xs text-black font-black">
                ※ 開発時は Vite Proxy： <span className="font-mono">/ipfs</span>（9095）、<span className="font-mono">/cluster</span>（9094）、<span className="font-mono">/pinning</span>（9097）
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 上传模态框 */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isUploading && setShowUploadModal(false)}
          ></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-black">ファイルをアップロード</h2>
              <button
                onClick={() => {
                  if (!isUploading) {
                    setShowUploadModal(false);
                    setDroppedFile(null);
                    setSelectedUploadTags([]);
                  }
                }}
                className="text-black hover:text-indigo-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* Drag & Drop 区域 */}
              <div>
                <label className="block text-sm font-black text-black mb-2">ファイルを選択</label>
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${isDragging 
                      ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' 
                      : droppedFile 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                    }
                    ${isUploading ? 'pointer-events-none opacity-60' : ''}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="file"
                    onChange={handleFileInputChange}
                    disabled={isUploading}
                    className="hidden"
                  />
                  
                  {droppedFile ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                      <p className="text-sm font-black text-green-700 mb-1">{droppedFile.name}</p>
                      <p className="text-xs text-green-600 font-bold">{formatSize(droppedFile.size)}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearDroppedFile();
                        }}
                        className="mt-3 text-xs font-black text-red-600 hover:text-red-700 hover:underline"
                      >
                        ファイルを変更
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className={`w-12 h-12 mb-3 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
                      <p className="text-sm font-black text-black mb-1">
                        {isDragging ? 'ここにドロップ！' : 'ドラッグ＆ドロップ'}
                      </p>
                      <p className="text-xs text-gray-500 font-bold">
                        またはクリックしてファイルを選択
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ 多标签选择 */}
              <div>
                <label className="block text-sm font-black text-black mb-2">タグを選択（複数可）</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg min-h-[60px]">
                  {/* 已选择的标签 */}
                  {selectedUploadTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-black bg-indigo-100 text-indigo-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setSelectedUploadTags(prev => prev.filter(t => t !== tag))}
                        disabled={isUploading}
                        className="hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  
                  {/* 添加标签下拉 */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !selectedUploadTags.includes(e.target.value)) {
                        setSelectedUploadTags(prev => [...prev, e.target.value]);
                      }
                    }}
                    disabled={isUploading}
                    className="px-2 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">+ タグを追加</option>
                    {FILE_TYPES.filter(t => !selectedUploadTags.includes(t)).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">タグは後から追加・削除できます</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isUploading || !droppedFile}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      アップロード中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      クラスターへ追加
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative p-6 animate-scale-in">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-black mb-2">ファイルを削除しますか？</h3>
            <p className="text-black font-bold text-sm mb-6">
              この操作は取り消せません。IPFS クラスターからピンが削除されます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-black font-black rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteFile(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-black rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes bounce-in { 0% { transform: translateY(100%); opacity: 0; } 70% { transform: translateY(-10%); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </div>
  );
}

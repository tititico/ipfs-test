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
  Folder,
  FolderOpen,
  Wallet,
  LogOut,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { IPFSFile } from './types';
import { STORAGE_KEY, SERVER_IP, CLUSTER_PORT, FILE_TYPES } from './constants';
import { useMetaMask } from './hooks/useMetaMask';
import { useFileManagement } from './hooks/useFileManagement';
import { useUpload } from './hooks/useUpload';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { Toast } from './components/Toast';
import { TagEditor } from './components/TagEditor';
import { TagManagerModal } from './components/TagManagerModal';
import { DashboardView } from './views/DashboardView';
import { formatSize, formatDate } from './utils/formatters';
import { parseIpfsAddResponse, parseNDJSONObjects, sleep, waitForPinVisible } from './utils/ipfs';
import { parseTags, stringifyTags } from './utils/tags';
import { ViewType, IPFSFileWithTags, UploadItem } from './types/app';



// ✅ Tag options persistence key (for "global" tags list)
const TAG_OPTIONS_KEY = `${STORAGE_KEY}__tag_options_v1`;
const MANAGE_TAG_VALUE = '__manage_tags__';




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

  const fileEntry = parsed.find((p) => p?.Name && p.Name.length > 0) || parsed[parsed.length - 1];

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
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === 'string' && t.length > 0);
  } catch {
    // 如果不是 JSON，按逗号分隔
    if (tagsStr.includes(',')) {
      return tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
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

// ✅ 递归读取 FileSystemDirectoryEntry 中的所有文件
const readDirectoryRecursive = async (dirEntry: FileSystemDirectoryEntry, basePath: string = ''): Promise<UploadItem[]> => {
  const items: UploadItem[] = [];
  const dirReader = dirEntry.createReader();

  const readEntries = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
  };

  // 需要多次调用 readEntries 直到返回空数组
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
      const file = await new Promise<File>((resolve, reject) => {
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

// ✅ 从 DataTransferItemList 读取文件和文件夹
const readDataTransferItems = async (items: DataTransferItemList): Promise<UploadItem[]> => {
  const uploadItems: UploadItem[] = [];

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
      }
    }
  }

  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      uploadItems.push({ file, relativePath: file.name });
    } else if (entry.isDirectory) {
      const dirItems = await readDirectoryRecursive(entry as FileSystemDirectoryEntry, entry.name);
      uploadItems.push(...dirItems);
    }
  }

  return uploadItems;
};

export default function App() {
  // ✅ MetaMask 状态
  const {
    isInstalled: isMetaMaskInstalled,
    isConnecting: isMetaMaskConnecting,
    isConnected: isMetaMaskConnected,
    account: walletAccount,
    error: metaMaskError,
    connect: connectMetaMask,
    disconnect: disconnectMetaMask,
    shortAddress,
  } = useMetaMask();

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
  const [droppedItems, setDroppedItems] = useState<UploadItem[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null); // 文件夹名称
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // ✅ 上传进度状态
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // ✅ Tag 筛选状态
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');

  // ✅ Tag 更新状态
  const [updatingTagFileId, setUpdatingTagFileId] = useState<string | null>(null);

  // ✅ 上传时选择的多个 tags（保持原来的 UI：只从 FILE_TYPES 选择，不加管理入口）
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);

  // ✅ 全局 Tag 列表（可维护），用于「ファイル管理」的筛选下拉 + TagEditor 的可选项
  const [tagOptions, setTagOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(TAG_OPTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t) => typeof t === 'string' && t.trim().length > 0);
        }
      }
    } catch {}
    return [...FILE_TYPES];
  });

  // ✅ Tag 管理弹窗（只从「ファイル管理」筛选下拉打开）
  const [showTagManager, setShowTagManager] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // ✅ usedTags：文件实际使用中的 tag，用于阻止删除正在使用的 tag
  const usedTags = useMemo(() => {
    const s = new Set<string>();
    files.forEach((f) => f.tags.forEach((t) => s.add(t)));
    return s;
  }, [files]);

  // ✅ persist tagOptions
  useEffect(() => {
    try {
      localStorage.setItem(TAG_OPTIONS_KEY, JSON.stringify(tagOptions));
    } catch {}
  }, [tagOptions]);

  const addGlobalTag = useCallback(
    (newTag: string) => {
      const t = newTag.trim();
      if (!t) return;
      setTagOptions((prev) => {
        if (prev.includes(t)) return prev;
        return [...prev, t].sort((a, b) => a.localeCompare(b, 'ja'));
      });
      showToast(`タグを追加しました: ${t}`);
    },
    [showToast]
  );

  const deleteGlobalTag = useCallback(
    (tag: string) => {
      if (usedTags.has(tag)) {
        showToast('このタグは既に使用されているため削除できません', 'error');
        return;
      }
      setTagOptions((prev) => prev.filter((t) => t !== tag));
      setSelectedTagFilter((prev) => (prev === tag ? 'all' : prev));
      showToast(`タグを削除しました: ${tag}`);
    },
    [usedTags, showToast]
  );

  // ✅✅✅ 修复核心：更新 metadata 时保留 owner/isFolder/fileCount/relativePath，避免改标签后 owner 丢失
  const normalizeOriginalName = useCallback((name: string) => {
    return (name || '').replace(/^📁\s*/, '');
  }, []);

  const buildMetaForUpdate = useCallback(
    (file: IPFSFileWithTags, tags: string[]) => {
      const meta: Record<string, string> = {
        size: String(file.size || 0),
        tags: stringifyTags(tags),
        uploadedAt: file.createdAt || new Date().toISOString(),
        originalName: normalizeOriginalName(String(file.name || '')),
      };

      const owner = (file.owner || walletAccount || '').toLowerCase();
      if (owner) meta.owner = owner;

      if (file.isFolder) meta.isFolder = 'true';
      if (typeof file.fileCount === 'number') meta.fileCount = String(file.fileCount);
      if (file.relativePath) meta.relativePath = String(file.relativePath);

      return meta;
    },
    [walletAccount, normalizeOriginalName]
  );

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
      console.log('[fetchPinsFromCluster] walletAccount=', walletAccount);

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

      // ✅ Debug: 看 pin 里 owner/tags 有没有丢
      try {
        const preview = pins.map((p: any) => {
          const cid = p?.cid || p?.Cid || p?.CID || p?.pin?.cid || '';
          const meta =
            p?.meta ||
            p?.metadata ||
            p?.pin?.meta ||
            p?.pin?.metadata ||
            p?.pin?.pin?.meta ||
            p?.pin?.pin?.metadata ||
            {};
          const name =
            (typeof p?.name === 'string' && p.name) ||
            (typeof p?.pin?.name === 'string' && p.pin.name) ||
            (typeof meta?.originalName === 'string' && meta.originalName) ||
            cid;
          return {
            cid,
            name,
            meta_owner: meta?.owner ?? '(missing)',
            meta_tags: meta?.tags ?? meta?.type ?? '(missing)',
            meta_isFolder: meta?.isFolder ?? '',
            meta_fileCount: meta?.fileCount ?? '',
            meta_relativePath: meta?.relativePath ?? '',
          };
        });
        console.table(preview);
        const total = preview.length;
        const withOwner = preview.filter(
          (x) => x.meta_owner !== '(missing)' && String(x.meta_owner).trim() !== ''
        ).length;
        const match = walletAccount
          ? preview.filter((x) => String(x.meta_owner).toLowerCase() === walletAccount.toLowerCase()).length
          : 0;
        console.log(
          `[fetchPinsFromCluster][DEBUG] totalPins=${total}, pinsWithOwner=${withOwner}, matchCurrentWallet=${match}`
        );
      } catch (e) {
        console.warn('[fetchPinsFromCluster][DEBUG] table failed:', e);
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

        const rawName =
          (typeof p?.name === 'string' && p.name) ||
          (typeof p?.pin?.name === 'string' && p.pin.name) ||
          (typeof meta?.name === 'string' && meta.name) ||
          (typeof meta?.originalName === 'string' && meta.originalName) ||
          cid;

        // ✅ 检查是否是文件夹
        const isFolder = meta?.isFolder === 'true';
        const fileCount = meta?.fileCount ? Number(meta.fileCount) : 0;
        const name = isFolder && !rawName.startsWith('📁') ? `📁 ${rawName}` : rawName;

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
          tags = parseTags(meta.type);
        }

        // ✅ 获取文件所有者
        const owner = meta?.owner || null;

        return {
          id: crypto.randomUUID(),
          name,
          cid,
          size,
          createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
          tags,
          replication: typeof rep === 'number' ? rep : 0,
          isFolder,
          fileCount,
          owner,
        } as IPFSFileWithTags;
      });

      clusterFiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      console.log('[fetchPinsFromCluster] Processed files count:', clusterFiles.length);
      setFiles(clusterFiles);
    } catch (e) {
      console.error('Failed to fetch pins:', e);
    }
  }, [walletAccount]);

  // ---- Persistence ----
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
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

  // 核心上传逻辑（单个文件）
  const uploadSingleFile = async (file: File, tags: string[], owner: string, relativePath?: string) => {
    const displayName = relativePath || file.name;
    console.log('=== Upload Start ===');
    console.log('[Upload] File name:', displayName);
    console.log('[Upload] File size:', file.size);
    console.log('[Upload] Tags:', tags);
    console.log('[Upload] Owner:', owner);

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
      originalName: displayName,
      owner: owner, // ✅ 添加 owner
    };
    if (relativePath) {
      meta.relativePath = relativePath;
    }
    console.log('[Upload] Metadata:', meta);

    console.log('[Upload] Step 2: Pinning to cluster...');
    try {
      await pinToClusterAPI(cid, displayName, meta);
      console.log('[Upload] Cluster API pin success!');
    } catch (clusterErr) {
      console.warn('[Upload] Cluster API failed, trying Pinning API (9097)...', clusterErr);
      await pinToPinningAPI(cid, displayName, meta);
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
      name: displayName,
      cid,
      size: file.size,
      createdAt: meta.uploadedAt,
      tags,
      replication: 0,
      owner, // ✅ 添加 owner
      relativePath,
    };

    console.log('=== Upload Complete ===');
    return newFile;
  };

  // ✅ 文件夹上传逻辑（使用 MFS 分块上传，绕过 Cloudflare 100MB 限制）
  const uploadFolder = async (
    items: UploadItem[],
    folderName: string,
    tags: string[],
    owner: string,
    onProgress?: (current: number, total: number) => void
  ) => {
    console.log('=== Folder Upload Start (MFS Method) ===');
    console.log('[Folder Upload] Folder name:', folderName);
    console.log('[Folder Upload] Total files:', items.length);
    console.log('[Folder Upload] Tags:', tags);

    // 计算总大小
    const totalSize = items.reduce((acc, item) => acc + item.file.size, 0);
    console.log('[Folder Upload] Total size:', totalSize);

    // MFS 临时目录路径（使用时间戳避免冲突）
    const mfsBasePath = `/upload-temp-${Date.now()}`;
    const mfsFolderPath = `${mfsBasePath}/${folderName}`;

    try {
      // Step 1: 创建 MFS 临时目录
      console.log('[Folder Upload] Step 1: Creating MFS directory:', mfsFolderPath);
      const mkdirRes = await fetch(
        `/ipfs/api/v0/files/mkdir?arg=${encodeURIComponent(mfsFolderPath)}&parents=true`,
        {
          method: 'POST',
          cache: 'no-store',
        }
      );
      if (!mkdirRes.ok) {
        const errText = await mkdirRes.text();
        console.error('[MFS mkdir] Failed:', mkdirRes.status, errText);
        throw new Error(`MFS mkdir 失敗: ${mkdirRes.status}`);
      }
      console.log('[Folder Upload] MFS directory created');

      // Step 2: 逐个上传文件并复制到 MFS
      console.log('[Folder Upload] Step 2: Uploading files individually...');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        onProgress?.(i + 1, items.length);

        console.log(`[Folder Upload] Uploading (${i + 1}/${items.length}): ${item.relativePath}`);

        // 2a: 上传单个文件到 IPFS，获取 CID
        const formData = new FormData();
        formData.append('file', item.file);

        const addRes = await fetch('/ipfs/api/v0/add?progress=false&pin=false', {
          method: 'POST',
          body: formData,
          cache: 'no-store',
        });

        if (!addRes.ok) {
          const errText = await addRes.text();
          console.error(`[IPFS add] Failed for ${item.relativePath}:`, addRes.status, errText);
          throw new Error(`ファイル追加失敗: ${item.relativePath}`);
        }

        const addResult = await addRes.text();
        const { cid: fileCid } = parseIpfsAddResponse(addResult);

        if (!fileCid) {
          throw new Error(`CID 取得失敗: ${item.relativePath}`);
        }

        console.log(`[Folder Upload] File CID: ${fileCid}`);

        // 2b: 确保目标目录存在（处理子目录）
        const relativePath = item.relativePath;
        const pathParts = relativePath.split('/');

        if (pathParts.length > 1) {
          // 有子目录，需要创建
          const subDir = pathParts.slice(0, -1).join('/');
          const fullSubDirPath = `${mfsBasePath}/${subDir}`;

          const subMkdirRes = await fetch(
            `/ipfs/api/v0/files/mkdir?arg=${encodeURIComponent(fullSubDirPath)}&parents=true`,
            {
              method: 'POST',
              cache: 'no-store',
            }
          );

          if (!subMkdirRes.ok) {
            const errText = await subMkdirRes.text();
            // 忽略 "already exists" 错误
            if (!errText.includes('already exists') && !errText.includes('file already exists')) {
              console.warn(`[MFS mkdir] Warning for ${fullSubDirPath}:`, errText);
            }
          }
        }

        // 2c: 将文件复制到 MFS 目录
        const mfsFilePath = `${mfsBasePath}/${relativePath}`;
        const cpRes = await fetch(
          `/ipfs/api/v0/files/cp?arg=/ipfs/${fileCid}&arg=${encodeURIComponent(mfsFilePath)}`,
          {
            method: 'POST',
            cache: 'no-store',
          }
        );

        if (!cpRes.ok) {
          const errText = await cpRes.text();
          console.error(`[MFS cp] Failed for ${mfsFilePath}:`, cpRes.status, errText);
          throw new Error(`MFS コピー失敗: ${relativePath}`);
        }
      }

      console.log('[Folder Upload] All files uploaded and copied to MFS');

      // Step 3: 获取文件夹的 CID
      console.log('[Folder Upload] Step 3: Getting folder CID...');
      const statRes = await fetch(`/ipfs/api/v0/files/stat?arg=${encodeURIComponent(mfsFolderPath)}&hash=true`, {
        method: 'POST',
        cache: 'no-store',
      });

      if (!statRes.ok) {
        const errText = await statRes.text();
        console.error('[MFS stat] Failed:', statRes.status, errText);
        throw new Error(`MFS stat 失敗: ${statRes.status}`);
      }

      const statResult = await statRes.json();
      const cid = statResult.Hash;
      console.log('[Folder Upload] Folder CID:', cid);

      if (!cid) throw new Error('フォルダの CID を取得できませんでした');

      // Step 4: Pin 到 Cluster
      const meta: Record<string, string> = {
        size: String(totalSize),
        tags: stringifyTags(tags),
        uploadedAt: new Date().toISOString(),
        originalName: folderName,
        isFolder: 'true',
        fileCount: String(items.length),
        owner: owner,
      };
      console.log('[Folder Upload] Metadata:', meta);

      console.log('[Folder Upload] Step 4: Pinning to cluster...');
      try {
        await pinToClusterAPI(cid, folderName, meta);
        console.log('[Folder Upload] Cluster API pin success!');
      } catch (clusterErr) {
        console.warn('[Folder Upload] Cluster API failed, trying Pinning API (9097)...', clusterErr);
        await pinToPinningAPI(cid, folderName, meta);
        console.log('[Folder Upload] Pinning API pin success!');
      }

      console.log('[Folder Upload] Step 5: Waiting for pin to be visible...');
      const visible = await waitForPinVisible(cid, 12);
      console.log('[Folder Upload] Pin visible:', visible);

      if (!visible) {
        console.warn('[Folder Upload] Pin not visible in cluster, but continuing...');
      }

      // Step 6: 清理 MFS 临时目录
      console.log('[Folder Upload] Step 6: Cleaning up MFS temp directory...');
      try {
        await fetch(`/ipfs/api/v0/files/rm?arg=${encodeURIComponent(mfsBasePath)}&recursive=true`, {
          method: 'POST',
          cache: 'no-store',
        });
        console.log('[Folder Upload] MFS cleanup done');
      } catch (cleanupErr) {
        console.warn('[Folder Upload] MFS cleanup failed (non-critical):', cleanupErr);
      }

      const newFile: IPFSFileWithTags = {
        id: crypto.randomUUID(),
        name: `📁 ${folderName}`,
        cid,
        size: totalSize,
        createdAt: meta.uploadedAt,
        tags,
        replication: 0,
        owner,
        isFolder: true,
        fileCount: items.length,
      };

      console.log('=== Folder Upload Complete ===');
      return newFile;
    } catch (error) {
      // 出错时也尝试清理 MFS
      console.error('[Folder Upload] Error occurred, attempting cleanup...');
      try {
        await fetch(`/ipfs/api/v0/files/rm?arg=${encodeURIComponent(mfsBasePath)}&recursive=true`, {
          method: 'POST',
          cache: 'no-store',
        });
      } catch {
        // ignore cleanup error
      }
      throw error;
    }
  };

  // ---- Actions ----
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    if (droppedItems.length === 0) {
      showToast('ファイルを選択してください', 'error');
      return;
    }

    // ✅ 确保用户已登录
    if (!walletAccount) {
      showToast('ウォレットに接続してください', 'error');
      return;
    }

    setIsUploading(true);

    try {
      let newFile: IPFSFileWithTags;

      // 判断是文件夹上传还是单/多文件上传
      if (folderName && droppedItems.length > 0) {
        // ✅ 文件夹上传：使用 MFS 方式，整个文件夹生成一个 CID
        setUploadProgress({ current: 0, total: droppedItems.length });
        newFile = await uploadFolder(
          droppedItems,
          folderName,
          selectedUploadTags,
          walletAccount,
          (current, total) => setUploadProgress({ current, total })
        );
        setFiles((prev) => [newFile, ...prev]);
        showToast(`フォルダをアップロードしました: ${folderName} (${droppedItems.length} ファイル)`);
      } else if (droppedItems.length === 1) {
        // ✅ 单文件上传
        setUploadProgress({ current: 0, total: 1 });
        const item = droppedItems[0];
        newFile = await uploadSingleFile(item.file, selectedUploadTags, walletAccount, item.relativePath);
        setUploadProgress({ current: 1, total: 1 });
        setFiles((prev) => [newFile, ...prev]);
        showToast(`アップロード成功: ${newFile.cid.slice(0, 12)}...`);
      } else {
        // ✅ 多文件上传（非文件夹）：每个文件单独 CID
        setUploadProgress({ current: 0, total: droppedItems.length });
        const uploadedFiles: IPFSFileWithTags[] = [];
        let failedCount = 0;

        for (let i = 0; i < droppedItems.length; i++) {
          const item = droppedItems[i];
          setUploadProgress({ current: i + 1, total: droppedItems.length });

          try {
            const uploaded = await uploadSingleFile(item.file, selectedUploadTags, walletAccount, item.relativePath);
            uploadedFiles.push(uploaded);
          } catch (err) {
            console.error(`[Upload] Failed to upload ${item.relativePath}:`, err);
            failedCount++;
          }
        }

        if (uploadedFiles.length > 0) {
          setFiles((prev) => [...uploadedFiles, ...prev]);
        }

        if (failedCount === 0) {
          showToast(`${uploadedFiles.length} 件のファイルをアップロードしました`);
        } else {
          showToast(`${uploadedFiles.length} 件成功、${failedCount} 件失敗`, 'error');
        }
      }

      form.reset();
      setDroppedItems([]);
      setFolderName(null);
      setSelectedUploadTags([]);
      setShowUploadModal(false);

      await fetchPinsFromCluster();
      await fetchNodeCount();
    } catch (err) {
      console.error('[Upload] Error:', err);
      showToast('アップロードに失敗しました。コンソールログを確認してください。', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
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

  // ✅ 添加 tag（给文件）—— ✅修复：更新 meta 时保留 owner / folder 信息，避免 owner 丢失导致过滤消失
  const handleAddTag = async (file: IPFSFileWithTags, newTag: string) => {
    if (file.tags.includes(newTag)) return;

    setUpdatingTagFileId(file.id);
    try {
      const newTags = [...file.tags, newTag];

      const meta = buildMetaForUpdate(file, newTags);
      console.log('[AddTag][DEBUG] cid=', file.cid, 'meta=', meta);

      await updatePinMetadata(file.cid, normalizeOriginalName(file.name), meta);

      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, tags: newTags } : f)));

      showToast('タグを追加しました');
    } catch (err) {
      console.error('[AddTag] Error:', err);
      showToast('タグの追加に失敗しました', 'error');
    } finally {
      setUpdatingTagFileId(null);
    }
  };

  // ✅ 删除 tag（给文件）—— ✅修复：更新 meta 时保留 owner / folder 信息，避免 owner 丢失导致过滤消失
  const handleRemoveTag = async (file: IPFSFileWithTags, tagToRemove: string) => {
    setUpdatingTagFileId(file.id);
    try {
      const newTags = file.tags.filter((t) => t !== tagToRemove);

      const meta = buildMetaForUpdate(file, newTags);
      console.log('[RemoveTag][DEBUG] cid=', file.cid, 'meta=', meta);

      await updatePinMetadata(file.cid, normalizeOriginalName(file.name), meta);

      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, tags: newTags } : f)));

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

  // ✅ 支持文件夹的 Drop 处理
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      try {
        const uploadItems = await readDataTransferItems(items);
        if (uploadItems.length > 0) {
          setDroppedItems(uploadItems);

          // 检测是否是文件夹上传
          const firstItem = items[0];
          const entry = firstItem.webkitGetAsEntry();
          if (entry?.isDirectory) {
            setFolderName(entry.name);
          } else {
            setFolderName(null);
          }

          console.log('[Drag & Drop] Items dropped:', uploadItems.length);
        }
      } catch (err) {
        console.error('[Drag & Drop] Error reading items:', err);
      }
    }
  }, []);

  // 普通文件选择
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const items: UploadItem[] = Array.from(files).map((f) => ({
        file: f,
        relativePath: f.name,
      }));
      setDroppedItems(items);
      setFolderName(null);
    }
  }, []);

  // ✅ 文件夹选择
  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const items: UploadItem[] = Array.from(files).map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      setDroppedItems(items);

      // 从第一个文件的路径中提取文件夹名
      const firstPath = (files[0] as any).webkitRelativePath || '';
      const folderNameMatch = firstPath.split('/')[0];
      setFolderName(folderNameMatch || null);

      console.log('[Folder Select] Files:', items.length, 'Folder:', folderNameMatch);
    }
  }, []);

  const clearDroppedItems = useCallback(() => {
    setDroppedItems([]);
    setFolderName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }, []);

  // ✅ 可用标签：用户维护的 tagOptions + 文件里出现过的 tag
  const availableTags = useMemo(() => {
    const s = new Set<string>(tagOptions);
    files.forEach((f) => f.tags.forEach((t) => s.add(t)));
    return Array.from(s)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ja'));
  }, [files, tagOptions]);

  // ✅ 用户文件过滤：只显示当前用户的文件
  const userFiles = useMemo(() => {
    if (!walletAccount) return [];
    return files.filter((f) => (f.owner || '').toLowerCase() === walletAccount.toLowerCase());
  }, [files, walletAccount]);

  // ✅ Debug: 你遇到“8 个只显示 4 个”时，这里能快速确认是不是 owner 缺失造成过滤
  useEffect(() => {
    if (!walletAccount) return;
    const owners = Array.from(new Set(files.map((f) => (f.owner || '').toLowerCase()))).filter(Boolean);
    const matchCount = files.filter((f) => (f.owner || '').toLowerCase() === walletAccount.toLowerCase()).length;
    console.log('[DEBUG userFiles] wallet=', walletAccount);
    console.log('[DEBUG userFiles] filesTotal=', files.length, 'uniqueOwners=', owners.length, 'matchCount=', matchCount);
    console.log('[DEBUG userFiles] owners=', owners);
  }, [files, walletAccount]);

  // ✅ 筛选逻辑：同时支持搜索、tag 筛选和用户过滤
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return userFiles.filter((f) => {
      if (selectedTagFilter !== 'all' && !f.tags.includes(selectedTagFilter)) return false;
      if (q) {
        return (
          (f.name || '').toLowerCase().includes(q) ||
          (f.cid || '').toLowerCase().includes(q) ||
          f.tags.some((t) => t.toLowerCase().includes(q)) ||
          formatDate(f.createdAt).includes(q)
        );
      }
      return true;
    });
  }, [userFiles, searchQuery, selectedTagFilter]);

  const stats = useMemo(
    () => ({
      totalSize: userFiles.reduce((acc, f) => acc + (f.size || 0), 0),
      fileCount: userFiles.length,
      nodeCount: nodeCount || 0,
    }),
    [userFiles, nodeCount]
  );

  // ✅ 计算待上传文件的总大小
  const totalDroppedSize = useMemo(() => {
    return droppedItems.reduce((acc, item) => acc + item.file.size, 0);
  }, [droppedItems]);

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
            {userFiles.slice(0, 5).map((file) => (
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
            {userFiles.length === 0 && (
              <p className="text-sm text-black font-bold text-center py-4">データがありません</p>
            )}
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
              <span className="text-xs font-mono text-black font-bold">
                /ipfs (9095), /cluster (9094), /pinning (9097)
              </span>
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

        {/* ✅ Tag 筛选下拉（这里加入"タグを管理..."） */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-4 h-4" />
          <select
            value={selectedTagFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v === MANAGE_TAG_VALUE) {
                setShowTagManager(true);
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
                    <td className="px-6 py-4 text-sm text-black font-bold">
                      {file.size ? formatSize(file.size) : '-'}
                    </td>
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

  // ✅ 登录界面组件
  const LoginView = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/AIOdropdrive_logo.png" alt="AIO DropDrive Logo" className="h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-black text-gray-800 mb-2">AIO DropDrive</h1>
          <p className="text-gray-600 font-bold">分散型ファイルストレージ</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">ウォレット接続</h2>
            <p className="text-sm text-gray-600 font-bold">MetaMask でログインして、安全にファイルを管理しましょう</p>
          </div>

          {/* MetaMask 未安装 */}
          {!isMetaMaskInstalled && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-800 mb-1">MetaMask が見つかりません</p>
                  <p className="text-xs text-amber-700 font-bold">MetaMask をインストールしてから、再度お試しください。</p>
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-black text-amber-700 hover:text-amber-900 underline"
                  >
                    MetaMask をダウンロード
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {metaMaskError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-red-800">{metaMaskError}</p>
              </div>
            </div>
          )}

          {/* 接続ボタン */}
          <button
            onClick={connectMetaMask}
            disabled={!isMetaMaskInstalled || isMetaMaskConnecting}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-4 px-6 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isMetaMaskConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                接続中...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                MetaMask で接続
              </>
            )}
          </button>

          {/* 説明テキスト */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-start gap-3 text-xs text-gray-500">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="font-bold">
                ウォレットアドレスを使用してファイルの所有権を管理します。秘密鍵やシードフレーズは一切要求されません。
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-xs text-gray-400 font-bold mt-6">Powered by IPFS Cluster</p>
      </div>
    </div>
  );

  // ✅ 未登录时显示登录界面
  if (!isMetaMaskConnected) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* 移动端顶部 Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 p-3 flex items-center justify-between md:hidden z-50">
        <img src="/AIOdropdrive_logo.png" alt="AIO DropDrive Logo" className="h-10 object-contain" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{shortAddress}</span>
          <button onClick={() => setShowUploadModal(true)} className="p-2 bg-indigo-600 text-white rounded-lg">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <Sidebar
        activeView={currentView}
        onViewChange={setCurrentView}
        account={walletAccount}
        shortAddress={shortAddress}
        onDisconnect={disconnectMetaMask}
      />

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
                ※ 開発時は Vite Proxy： <span className="font-mono">/ipfs</span>（9095）、{' '}
                <span className="font-mono">/cluster</span>（9094）、 <span className="font-mono">/pinning</span>（9097）
              </p>
            </div>

            {/* ✅ 用户信息设置 */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-black text-black mb-4">ウォレット情報</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-black text-black mb-1">接続中のアドレス</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={walletAccount || ''}
                      className="flex-1 p-2 bg-gray-50 border rounded text-sm text-black font-mono font-bold outline-none"
                    />
                    <button
                      onClick={() => {
                        if (walletAccount) {
                          navigator.clipboard.writeText(walletAccount);
                          showToast('アドレスをコピーしました');
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={disconnectMetaMask}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-black rounded-lg hover:bg-red-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  ウォレットを切断
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ✅ 上传模态框（支持文件夹） */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isUploading && setShowUploadModal(false)}
          ></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-black">ファイル / フォルダをアップロード</h2>
              <button
                onClick={() => {
                  if (!isUploading) {
                    setShowUploadModal(false);
                    setDroppedItems([]);
                    setFolderName(null);
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
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileInputChange} disabled={isUploading} className="hidden" />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    // @ts-ignore
                    directory=""
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
                      <p className="text-sm font-black text-black mb-1">{isDragging ? 'ここにドロップ！' : 'ドラッグ＆ドロップ'}</p>
                      <p className="text-xs text-gray-500 font-bold mb-3">ファイルまたはフォルダをドロップ</p>

                      {/* ✅ ファイル・フォルダ選択ボタン */}
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

              {/* ✅ ファイル一覧 */}
              {droppedItems.length > 1 && (
                <div>
                  <label className="block text-sm font-black text-black mb-2">アップロードファイル一覧（{droppedItems.length} 件）</label>
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
                        <li className="px-3 py-1.5 text-gray-400 font-bold text-center">...他 {droppedItems.length - 50} 件</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* ✅ 多标签选择（保持原 UI：从 FILE_TYPES 选择） */}
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

              {/* ✅ 上传进度 */}
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

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isUploading || droppedItems.length === 0}
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
                      {droppedItems.length > 1 && <span className="text-sm opacity-80">({droppedItems.length} 件)</span>}
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

      {/* ✅ Tag 管理弹窗 */}
      <TagManagerModal
        open={showTagManager}
        onClose={() => {
          setShowTagManager(false);
          setSelectedTagFilter((prev) => (prev === MANAGE_TAG_VALUE ? 'all' : prev));
        }}
        tagOptions={tagOptions}
        usedTags={usedTags}
        onAdd={addGlobalTag}
        onDelete={deleteGlobalTag}
      />

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


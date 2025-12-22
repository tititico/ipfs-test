import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ShieldCheck,
  ChevronRight,
  Loader2,
  X,
  Server,
  Cloud,
} from 'lucide-react';
import { IPFSFile, FileType } from './types';
import { STORAGE_KEY, SERVER_IP, CLUSTER_PORT, FILE_TYPES } from './constants';

type ViewType = 'dashboard' | 'files' | 'cluster' | 'settings';

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
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-black tracking-tight">AIO IPFS</span>
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

// IPFS /api/v0/add は NDJSON（複数行JSON）を返すことがある
const parseIpfsAddResponse = (rawText: string) => {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const last = JSON.parse(lines[lines.length - 1] ?? '{}');
  const cid: string | undefined = last?.Hash || last?.Cid || last?.cid || last?.CID;
  return { last, cid, linesCount: lines.length };
};

// ✅ NDJSON（1行1JSON）を配列にする
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
      // ignore non-json line
    }
  }
  return objs;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ✅ /cluster/pins/:cid がダメでも /cluster/pins を見に行く（一覧から探す）
const waitForPinVisible = async (cid: string, tries = 12) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`/cluster/pins/${encodeURIComponent(cid)}`, {
        method: 'GET',
        cache: 'no-store',
      });
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
    } catch {
      // ignore
    }

    await sleep(500 + i * 300);
  }
  return false;
};

// ✅ 9097 pinning API（Vite proxy の /pinning -> 9097 を想定）
const pinToPinningAPI = async (cid: string, name: string, meta: Record<string, string>) => {
  const res = await fetch(`/pinning/pins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, name, meta }),
    cache: 'no-store',
  });
  const text = await res.text().catch(() => '');
  console.log('[pinning pin] status=', res.status, 'body=', text);
  if (!res.ok) throw new Error(`Pinning API pin 失敗: HTTP ${res.status} ${text}`);
  return text;
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [files, setFiles] = useState<IPFSFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(0);

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
      const res = await fetch('/cluster/pins', { method: 'GET', cache: 'no-store' });

      if (res.status === 204) {
        setFiles([]);
        return;
      }

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      // 1) NDJSON で試す
      let pins: any[] = parseNDJSONObjects(text);

      // 2) NDJSON が空なら JSON も試す
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
        console.warn('fetchPinsFromCluster: parsed 0 pins. raw head:', text.slice(0, 300));
        setFiles([]);
        return;
      }

      const clusterFiles: IPFSFile[] = pins.map((p: any) => {
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

        const type = (typeof meta?.type === 'string' && meta.type) || 'その他';

        return {
          id: crypto.randomUUID(),
          name,
          cid,
          size,
          createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
          type,
          replication: typeof rep === 'number' ? rep : 0,
        };
      });

      clusterFiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
        setFiles(JSON.parse(saved));
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

  // ---- Actions ----
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    const formData = new FormData(form);
    const fileInput = formData.get('file') as File;
    const type = (formData.get('type') as FileType) || 'その他';

    if (!fileInput || fileInput.size === 0) {
      showToast('ファイルを選択してください', 'error');
      return;
    }

    setIsUploading(true);
    try {
      // 1) add to IPFS
      const response = await fetch('/ipfs/api/v0/add?progress=false', {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      });
      const rawText = await response.text();

      if (!response.ok) {
        console.error('IPFS add failed:', response.status, rawText);
        throw new Error(`IPFS add 失敗: HTTP ${response.status}`);
      }

      const { cid } = parseIpfsAddResponse(rawText);
      if (!cid) throw new Error('CID を取得できませんでした');

      // ✅ metadata を pinning API に保存（curl 成功形式）
      const meta: Record<string, string> = {
        size: String(fileInput.size),
        type: String(type),
        uploadedAt: new Date().toISOString(),
        originalName: fileInput.name,
      };

      // 2) pin to 9097 pinning API（/pinning proxy）
      await pinToPinningAPI(cid, fileInput.name, meta);

      // ✅ 反查确认（cluster側一覧に反映される前提）
      const visible = await waitForPinVisible(cid, 12);
      if (!visible) {
        throw new Error(`pinning は成功しましたが、/cluster/pins に反映されません（9097と9094が別クラスタの可能性）`);
      }

      const newFile: IPFSFile = {
        id: crypto.randomUUID(),
        name: fileInput.name,
        cid,
        size: fileInput.size,
        createdAt: meta.uploadedAt,
        type,
        replication: 0,
      };
      setFiles((prev) => [newFile, ...prev]);

      showToast(`アップロード + pin 成功: ${cid.slice(0, 12)}...`);

      form.reset();
      setShowUploadModal(false);

      await fetchPinsFromCluster();
      await fetchNodeCount();
    } catch (err) {
      console.error(err);
      showToast('アップロードに失敗しました。ログを確認してください。', 'error');
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

    try {
      const res = await fetch(`/cluster/pins/${encodeURIComponent(target.cid)}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const t = await res.text().catch(() => '');
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('CIDをコピーしました');
  };

  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.cid || '').toLowerCase().includes(q) ||
        (f.type || '').toLowerCase().includes(q) ||
        formatDate(f.createdAt).includes(q)
    );
  }, [files, searchQuery]);

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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider">ファイル名</th>
                <th className="px-6 py-4 text-xs font-black text-black uppercase tracking-wider">CID (IPFS)</th>
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
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase w-fit bg-gray-200 text-black">
                          {file.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 group/cid">
                        <code className="text-xs text-black font-bold bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-[160px]">
                          {file.cid}
                        </code>
                        <button
                          onClick={() => copyToClipboard(file.cid)}
                          className="p-1.5 text-black hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
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
                  <td colSpan={5} className="px-6 py-12 text-center text-black">
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
      <Sidebar activeView={currentView} onViewChange={setCurrentView} />

      <main className="flex-1 md:ml-64 p-4 md:p-8">
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
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-black transition-all shadow-sm active:scale-95"
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
                onClick={() => !isUploading && setShowUploadModal(false)}
                className="text-black hover:text-indigo-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-black text-black mb-2">ファイルを選択</label>
                <input
                  type="file"
                  name="file"
                  required
                  disabled={isUploading}
                  className="w-full text-sm text-black font-bold file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-black mb-2">ファイルタイプ</label>
                <select
                  name="type"
                  required
                  disabled={isUploading}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold text-black focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                >
                  {FILE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 disabled:bg-indigo-400"
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


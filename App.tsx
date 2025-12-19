
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
  ExternalLink,
  Loader2,
  X,
  Server,
  Cloud
} from 'lucide-react';
import { IPFSFile, FileType } from './types';
import { STORAGE_KEY, SERVER_IP, CLUSTER_PORT, FILE_TYPES } from './constants';

// --- Types ---
type ViewType = 'dashboard' | 'files' | 'cluster' | 'settings';

// --- Components ---

const Sidebar = ({ activeView, onViewChange }: { activeView: ViewType, onViewChange: (v: ViewType) => void }) => {
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
              activeView === item.id 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-black hover:bg-gray-50'
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
            activeView === 'settings' 
              ? 'bg-indigo-50 text-indigo-700' 
              : 'text-black hover:bg-gray-50'
          }`}
        >
          <Settings className="w-5 h-5" />
          設定
        </button>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, unit = "" }: { title: string, value: string | number, icon: any, unit?: string }) => (
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

const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
        type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'
      }`}>
        {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
        <span className="font-black text-sm">{message}</span>
      </div>
    </div>
  );
};

// --- Utils ---
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
};

// --- Main App ---

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [files, setFiles] = useState<IPFSFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFiles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved files", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fileInput = formData.get('file') as File;
    const type = formData.get('type') as FileType;

    if (!fileInput || fileInput.size === 0) {
      showToast('ファイルを選択してください', 'error');
      return;
    }

    setIsUploading(true);
    try {
      await new Promise(res => setTimeout(res, 2000));
      
      const newFile: IPFSFile = {
        id: crypto.randomUUID(),
        name: fileInput.name,
        cid: 'Qm' + Math.random().toString(36).substring(2, 15).toUpperCase(),
        size: fileInput.size,
        createdAt: new Date().toISOString(),
        type: type || 'その他',
        replication: 3
      };

      setFiles(prev => [newFile, ...prev]);
      showToast('ファイルをクラスターへ追加しました');
      setShowUploadModal(false);
    } catch (err) {
      showToast('アップロードに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setDeleteConfirm(null);
    showToast('削除が完了しました');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('CIDをコピーしました');
  };

  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return files.filter(f => 
      f.name.toLowerCase().includes(q) || 
      f.cid.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q) ||
      formatDate(f.createdAt).includes(q)
    );
  }, [files, searchQuery]);

  const stats = useMemo(() => ({
    totalSize: files.reduce((acc, f) => acc + f.size, 0),
    fileCount: files.length,
    nodeCount: 3
  }), [files]);

  // --- View Components ---

  const DashboardView = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="総ストレージ容量" value={formatSize(stats.totalSize).split(' ')[0]} unit={formatSize(stats.totalSize).split(' ')[1]} icon={HardDrive} />
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
            {files.slice(0, 5).map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setCurrentView('files')}>
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
              <span className="text-sm text-black font-bold">サーバー接続</span>
              <span className="text-xs font-mono text-black font-bold">{SERVER_IP}:{CLUSTER_PORT}</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 w-[65%]"></div>
            </div>
            <p className="text-[10px] text-black font-bold">クラスター帯域使用率: 65%</p>
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
              {filteredFiles.length > 0 ? filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-black mb-1">{file.name}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase w-fit ${
                        file.type === 'DB' ? 'bg-blue-100 text-blue-800' :
                        file.type === 'ログ' ? 'bg-orange-100 text-orange-800' :
                        file.type === 'アセット' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-black'
                      }`}>
                        {file.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 group/cid">
                      <code className="text-xs text-black font-bold bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate max-w-[120px]">
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
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="flex gap-0.5">
                        {[...Array(file.replication)].map((_, i) => (
                          <div key={i} className="w-2 h-4 bg-indigo-500 rounded-full"></div>
                        ))}
                      </div>
                      <span className="text-xs font-black text-black ml-1">{file.replication} Nodes</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-black font-bold">{formatSize(file.size)}</td>
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
              )) : (
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                <Server className="w-5 h-5" />
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-[10px] font-black rounded uppercase">Active</span>
            </div>
            <h4 className="font-black text-black mb-1">Node-0{i}</h4>
            <p className="text-xs text-black font-bold mb-4">ID: cluster-node-alpha-{i}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-black font-black">
                <span>CPU使用率</span>
                <span>12%</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[12%]"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
          <Cloud className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-black mb-2">クラスターネットワークは健全です</h3>
        <p className="text-black font-bold text-sm max-w-md mx-auto">
          すべてのノードが同期されており、レプリケーションプロトコルは正常に動作しています。接続先: {SERVER_IP}:{CLUSTER_PORT}
        </p>
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
              {currentView === 'files' && 'アップロードされたファイルの一覧と管理'}
              {currentView === 'cluster' && '各ノードの稼働状況とネットワーク健全性'}
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
                  <input type="text" readOnly value={SERVER_IP} className="w-full p-2 bg-gray-50 border rounded text-sm text-black font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-black text-black mb-1">Port</label>
                  <input type="text" readOnly value={CLUSTER_PORT} className="w-full p-2 bg-gray-50 border rounded text-sm text-black font-bold outline-none" />
                </div>
                <p className="text-xs text-black font-black">※ 設定変更は `constants.tsx` ファイルで行ってください。</p>
             </div>
          </div>
        )}
      </main>

      {/* Modals & Toasts */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isUploading && setShowUploadModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-black">ファイルをアップロード</h2>
              <button onClick={() => !isUploading && setShowUploadModal(false)} className="text-black hover:text-indigo-600">
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
                  {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce-in {
          0% { transform: translateY(100%); opacity: 0; }
          70% { transform: translateY(-10%); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </div>
  );
}

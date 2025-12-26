import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useMetaMask } from './hooks/useMetaMask';
import { useFileManagement } from './hooks/useFileManagement';
import { useUpload } from './hooks/useUpload';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { TagManagerModal } from './components/TagManagerModal';
import { UploadModal } from './components/UploadModal';
import { DashboardView } from './views/DashboardView';
import { FilesView } from './views/FilesView';
import { ClusterView } from './views/ClusterView';
import { SettingsView } from './views/SettingsView';
import { formatSize } from './utils/formatters';
import { ViewType } from './types/app';

export default function App() {
  const {
    isConnected: isMetaMaskConnected,
    account: walletAccount,
    connect: connectMetaMask,
    disconnect: disconnectMetaMask,
    shortAddress,
  } = useMetaMask();

  const {
    files,
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
  } = useFileManagement();

  const {
    showUploadModal,
    setShowUploadModal,
  } = useUpload();

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    if (isMetaMaskConnected) {
      fetchPinsFromCluster();
      fetchNodeCount();
    }
  }, [isMetaMaskConnected]);

  const fetchNodeCount = async () => {
    try {
      const response = await fetch('/cluster/peers', { cache: 'no-store' });
      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        setNodeCount(lines.length);
      }
    } catch (error) {
      console.error('Error fetching node count:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('コピーしました');
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/cluster/pins/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchPinsFromCluster();
        showToast('ファイルを削除しました');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('削除に失敗しました', 'error');
    }
    setDeleteConfirm(null);
  };

  const handleUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        formData.append('metadata', JSON.stringify({
          owner: walletAccount,
          tags: JSON.stringify([]), // 可以后续添加tag功能
          size: file.size,
        }));

        // Upload to IPFS
        const uploadResponse = await fetch('/ipfs/api/v0/add', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadText = await uploadResponse.text();
          const lines = uploadText.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.Hash) {
                // Pin to cluster
                await fetch('/cluster/pins', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cid: parsed.Hash,
                    name: file.name,
                    metadata: {
                      owner: walletAccount,
                      tags: JSON.stringify([]),
                      size: file.size.toString(),
                    },
                  }),
                });
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      showToast('アップロードが完了しました');
      setShowUploadModal(false);
      await fetchPinsFromCluster();
    } catch (error) {
      console.error('Upload error:', error);
      showToast('アップロードに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter files for current user
  const userFiles = useMemo(() => {
    if (!walletAccount) return [];
    return files.filter((f) => (f.owner || '').toLowerCase() === walletAccount.toLowerCase());
  }, [files, walletAccount]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSize = userFiles.reduce((acc, file) => acc + (file.size || 0), 0);
    return {
      totalSize,
      fileCount: userFiles.length,
      nodeCount,
    };
  }, [userFiles, nodeCount]);

  const handleRefresh = () => {
    fetchPinsFromCluster();
    fetchNodeCount();
    showToast('最新状態を取得しました');
  };

  // Handle login
  if (!isMetaMaskConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <img src="/AIOdropdrive_logo.png" alt="AIO DropDrive Logo" className="mx-auto h-20 object-contain mb-8" />
            <h2 className="mt-6 text-3xl font-black text-black">AIO DropDrive</h2>
            <p className="mt-2 text-sm text-black font-bold">IPFS分散ストレージプラットフォーム</p>
            <p className="text-xs text-gray-500 font-bold mt-1">MetaMaskでアカウント接続してください</p>
          </div>
          
          <div className="mt-8 space-y-4">
            <button
              onClick={connectMetaMask}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-black rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg active:scale-95"
            >
              MetaMaskで接続
            </button>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm text-yellow-800 font-bold space-y-1">
                <p>• MetaMaskが必要です</p>
                <p>• 接続したアカウントでファイルを管理</p>
                <p>• プライベート分散ストレージ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* Mobile Header */}
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

        {currentView === 'dashboard' && (
          <DashboardView
            stats={stats}
            userFiles={userFiles}
            onViewChange={setCurrentView}
            onRefresh={handleRefresh}
          />
        )}

        {currentView === 'files' && (
          <FilesView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTagFilter={selectedTagFilter}
            setSelectedTagFilter={setSelectedTagFilter}
            availableTags={availableTags}
            filteredFiles={filteredFiles}
            updatingTagFileId={updatingTagFileId}
            onAddTag={addTagToFile}
            onRemoveTag={removeTagFromFile}
            onDeleteFile={(fileId) => setDeleteConfirm(fileId)}
            onRefresh={handleRefresh}
            onManageTags={() => setShowTagManager(true)}
            copyToClipboard={copyToClipboard}
          />
        )}

        {currentView === 'cluster' && (
          <ClusterView
            stats={stats}
            onRefresh={handleRefresh}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            walletAccount={walletAccount}
            onCopyAddress={() => {
              if (walletAccount) {
                copyToClipboard(walletAccount);
                showToast('アドレスをコピーしました');
              }
            }}
            onDisconnect={disconnectMetaMask}
          />
        )}
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showTagManager && (
        <TagManagerModal
          open={showTagManager}
          onClose={() => setShowTagManager(false)}
          tagOptions={tagOptions}
          usedTags={usedTags}
          onAdd={addTagOption}
          onDelete={deleteTagOption}
        />
      )}

      {showUploadModal && (
        <UploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          isUploading={isUploading}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="bg-white rounded-xl p-6 max-w-sm w-full relative">
            <h3 className="text-lg font-black text-black mb-4">ファイルを削除</h3>
            <p className="text-sm text-gray-600 mb-6">このファイルを削除しますか？この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-black hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDeleteFile(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-black hover:bg-red-700"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
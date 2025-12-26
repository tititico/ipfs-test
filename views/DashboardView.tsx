import React from 'react';
import { Files, Activity, HardDrive, Server, ChevronRight } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { formatSize, formatDate } from '../utils/formatters';
import { SERVER_IP, CLUSTER_PORT } from '../constants';
import { IPFSFileWithTags, ViewType } from '../types/app';

interface DashboardViewProps {
  stats: {
    totalSize: number;
    fileCount: number;
    nodeCount: number;
  };
  userFiles: IPFSFileWithTags[];
  onViewChange: (view: ViewType) => void;
  onRefresh: () => void;
}

export const DashboardView = ({ 
  stats, 
  userFiles, 
  onViewChange, 
  onRefresh 
}: DashboardViewProps) => (
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
              onClick={() => onViewChange('files')}
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
          onClick={() => onViewChange('files')}
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
            onClick={onRefresh}
            className="w-full mt-2 text-center text-sm font-black text-indigo-600 hover:underline"
          >
            再読み込み
          </button>
        </div>
      </div>
    </div>
  </div>
);
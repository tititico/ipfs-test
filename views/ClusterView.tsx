import React from 'react';
import { Cloud } from 'lucide-react';

interface ClusterViewProps {
  stats: {
    nodeCount: number;
    fileCount: number;
  };
  onRefresh: () => void;
}

export const ClusterView = ({ stats, onRefresh }: ClusterViewProps) => (
  <div className="space-y-6 animate-fade-in">
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-black flex items-center gap-2">
          <Cloud className="w-5 h-5 text-indigo-600" />
          クラスター概要
        </h3>
        <button
          onClick={onRefresh}
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
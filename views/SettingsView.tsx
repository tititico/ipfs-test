import React from 'react';
import { Copy, LogOut } from 'lucide-react';
import { SERVER_IP, CLUSTER_PORT } from '../constants';

interface SettingsViewProps {
  walletAccount: string | null;
  onCopyAddress: () => void;
  onDisconnect: () => void;
}

export const SettingsView = ({ 
  walletAccount, 
  onCopyAddress, 
  onDisconnect 
}: SettingsViewProps) => (
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

    {/* ウォレット情報設定 */}
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
              onClick={onCopyAddress}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-black rounded-lg hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ウォレットを切断
        </button>
      </div>
    </div>
  </div>
);
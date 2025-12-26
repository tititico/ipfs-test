import React from 'react';
import { LayoutDashboard, Files, Settings, Activity, Wallet, LogOut } from 'lucide-react';

type ViewType = 'dashboard' | 'files' | 'cluster' | 'settings';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (v: ViewType) => void;
  account: string | null;
  shortAddress: string | null;
  onDisconnect: () => void;
}

export const Sidebar = ({
  activeView,
  onViewChange,
  account,
  shortAddress,
  onDisconnect,
}: SidebarProps) => {
  const navItems = [
    { id: 'dashboard' as ViewType, label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'files' as ViewType, label: 'ファイル管理', icon: Files },
    { id: 'cluster' as ViewType, label: 'クラスター状況', icon: Activity },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 hidden md:flex flex-col z-50">
      <div className="p-4 md:p-6 border-b border-gray-100">
        <div className="flex items-center">
          <img src="/AIOdropdrive_logo.png" alt="AIO DropDrive Logo" className="h-12 md:h-14 object-contain" />
        </div>
      </div>

      {account && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-500">接続中</p>
              <p className="text-sm font-black text-gray-800 truncate" title={account}>
                {shortAddress}
              </p>
            </div>
            <button
              onClick={onDisconnect}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="切断"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
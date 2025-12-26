import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

const METAMASK_STORAGE_KEY = 'metamask_connected_account';

export function useMetaMask() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkInstalled = () => {
      const installed = typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;
      setIsInstalled(installed);
    };

    checkInstalled();

    if (!window.ethereum) {
      const timer = setTimeout(checkInstalled, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!isInstalled) return;

    const savedAccount = localStorage.getItem(METAMASK_STORAGE_KEY);
    if (savedAccount && window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0 && accounts[0].toLowerCase() === savedAccount.toLowerCase()) {
            setIsConnected(true);
            setAccount(accounts[0].toLowerCase());
            window.ethereum?.request({ method: 'eth_chainId' }).then((cId: string) => {
              setChainId(cId);
            });
          } else {
            localStorage.removeItem(METAMASK_STORAGE_KEY);
          }
        })
        .catch(() => {
          localStorage.removeItem(METAMASK_STORAGE_KEY);
        });
    }
  }, [isInstalled, isInstalled]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setIsConnected(false);
        setAccount(null);
        localStorage.removeItem(METAMASK_STORAGE_KEY);
      } else {
        const newAccount = accounts[0].toLowerCase();
        setIsConnected(true);
        setAccount(newAccount);
        localStorage.setItem(METAMASK_STORAGE_KEY, newAccount);
      }
    };

    const handleChainChanged = (cId: string) => {
      setChainId(cId);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [isInstalled]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask がインストールされていません');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const acc = accounts[0].toLowerCase();
        const cId = await window.ethereum.request({ method: 'eth_chainId' });

        setIsConnecting(false);
        setIsConnected(true);
        setAccount(acc);
        setChainId(cId);
        setError(null);

        localStorage.setItem(METAMASK_STORAGE_KEY, acc);
      }
    } catch (err: any) {
      let errorMessage = '接続に失敗しました';
      if (err.code === 4001) {
        errorMessage = 'ユーザーが接続を拒否しました';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setIsConnecting(false);
      setError(errorMessage);
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAccount(null);
    setChainId(null);
    localStorage.removeItem(METAMASK_STORAGE_KEY);
  }, []);

  const shortAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null;

  return {
    isInstalled,
    isConnecting,
    isConnected,
    account,
    chainId,
    error,
    connect,
    disconnect,
    shortAddress,
  };
}
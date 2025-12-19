
export type FileType = 'DB' | 'ログ' | 'アセット' | 'その他';

export interface IPFSFile {
  id: string;
  name: string;
  cid: string;
  size: number; // in bytes
  createdAt: string;
  type: FileType;
  replication: number;
}

export interface Stats {
  totalSize: number;
  fileCount: number;
  nodeCount: number;
}

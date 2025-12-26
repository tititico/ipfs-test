import { IPFSFile } from '../types';

export type ViewType = 'dashboard' | 'files' | 'cluster' | 'settings';

export interface IPFSFileWithTags extends Omit<IPFSFile, 'type'> {
  tags: string[];
  owner?: string;
  isFolder?: boolean;
  fileCount?: number;
  relativePath?: string;
}

export interface UploadItem {
  file: File;
  relativePath: string;
}
import { useState, useRef } from 'react';
import { UploadItem } from '../types/app';

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedItems, setDroppedItems] = useState<UploadItem[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const resetUpload = () => {
    setDroppedItems([]);
    setFolderName(null);
    setSelectedUploadTags([]);
    setUploadProgress(null);
  };

  const calculateTotalSize = () => {
    return droppedItems.reduce((acc, item) => acc + item.file.size, 0);
  };

  return {
    isUploading,
    setIsUploading,
    showUploadModal,
    setShowUploadModal,
    isDragging,
    setIsDragging,
    droppedItems,
    setDroppedItems,
    folderName,
    setFolderName,
    uploadProgress,
    setUploadProgress,
    selectedUploadTags,
    setSelectedUploadTags,
    fileInputRef,
    folderInputRef,
    dragCounterRef,
    resetUpload,
    calculateTotalSize,
  };
}
import React, { useState, useRef } from 'react';
import { X, Upload, Files, Folder } from 'lucide-react';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (files: FileList) => void;
  isUploading: boolean;
}

export const UploadModal = ({ open, onClose, onUpload, isUploading }: UploadModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isUploading ? onClose : undefined} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-black">ファイルをアップロード</h2>
          <button onClick={!isUploading ? onClose : undefined} className="text-black hover:text-indigo-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="text-center py-8">
            <Upload className="w-12 h-12 mb-3 text-gray-400 mx-auto" />
            <p className="text-sm font-black text-black mb-4">ファイルを選択してアップロード</p>
            
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Files className="w-4 h-4" />
                ファイル選択
              </button>
              
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-black hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Folder className="w-4 h-4" />
                フォルダ選択
              </button>
            </div>
            
            {isUploading && (
              <p className="text-sm text-gray-500 mt-4">アップロード中...</p>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
          
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};
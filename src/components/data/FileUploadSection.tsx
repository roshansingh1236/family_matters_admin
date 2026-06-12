import React, { useRef, useState } from 'react';
import { storageService, STORAGE_BUCKETS } from '../../services/storageService';
import Button from '../base/Button';
import ConfirmationDialog from '../base/ConfirmationDialog';
import { formatMMDDYYYY } from '../../utils/dateFormat';

type FileCategory = 'Legal' | 'Financial' | 'Medical' | 'Personal' | 'Other';

const CATEGORIES: FileCategory[] = ['Legal', 'Financial', 'Medical', 'Personal', 'Other'];

export type FileRecord = {
  name: string;
  url: string;
  category: FileCategory;
  uploadedAt: string;
  type: string;
  path: string;
};

type FileUploadSectionProps = {
  title: string;
  description?: string;
  userId: string;
  bucket?: string;
  defaultCategory?: FileCategory;
  files?: FileRecord[];
  onFilesChange: (files: FileRecord[]) => Promise<void> | void;
};

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  title,
  description,
  userId,
  bucket = STORAGE_BUCKETS.USERS,
  defaultCategory = 'Other',
  files = [],
  onFilesChange
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>(defaultCategory);
  
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
  const handleResetZoom = () => setZoom(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      void handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    if (!userId) {
      setUploadError('User ID is missing. Cannot upload.');
      setIsUploading(false);
      return;
    }

    try {
      const storagePath = `${userId}/${selectedCategory}/${Date.now()}_${file.name}`;
      
      const { url } = await storageService.uploadFile(bucket as any, storagePath, file);

      const newFile: FileRecord = {
        name: file.name,
        url,
        category: selectedCategory,
        uploadedAt: new Date().toISOString(),
        type: file.type,
        path: storagePath
      };

      const updatedFiles = [...files, newFile];
      await onFilesChange(updatedFiles);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadError(`Upload failed: ${error.message || 'Unknown error'}`);
      setIsUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      if (fileToDelete.path) {
          await storageService.deleteFile(bucket as any, fileToDelete.path);
      } else {
          console.warn('Could not determine storage path, removing record only.');
      }

      const updatedFiles = files.filter((f) => f.url !== fileToDelete.url);
      await onFilesChange(updatedFiles);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file.');
    } finally {
        setFileToDelete(null);
    }
  };

  const formatDate = (dateString: string) => formatMMDDYYYY(dateString);

  // Group files by type for display
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  const documentFiles = files.filter(f => !f.type.startsWith('image/'));

  return (
    <div className="space-y-6">
      <ConfirmationDialog
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete ${fileToDelete?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive={true}
      />

      <div>
        <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-50">{title}</h3>
        {description && <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/70">{description}</p>}
      </div>

      {/* Upload Area */}
      <div 
        className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 transition-all
          ${dragActive 
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' 
            : 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-[#0e0b1a]/50'
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-emerald-100 p-5 dark:bg-emerald-900/30">
            {isUploading ? (
              <div className="relative">
                <i className="ri-loader-4-line animate-spin text-3xl text-emerald-600 dark:text-emerald-400"></i>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            ) : (
              <i className="ri-upload-cloud-2-line text-3xl text-emerald-600 dark:text-emerald-400"></i>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isUploading ? 'Uploading your file...' : 'Drop files here or click to upload'}
            </p>
            {isUploading && (
              <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            {!isUploading && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Supports Images, PDF, and Documents
              </p>
            )}
          </div>
        </div>

        {!isUploading && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
             <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FileCategory)}
              className="rounded-xl border-rose-100/60 bg-gray-50 py-2 pl-3 pr-8 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:ring-emerald-500 dark:bg-[#15111f] dark:border-white/5 dark:text-gray-200"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <Button 
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl px-6"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
          </div>
        )}
        
        {uploadError && (
           <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
             <i className="ri-error-warning-line"></i>
             {uploadError}
           </div>
        )}
      </div>

      {/* Image Gallery */}
      {imageFiles.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Photos</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {imageFiles.map((file, index) => (
              <div key={`${file.path}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 dark:bg-[#15111f]">
                <img 
                  src={file.url} 
                  alt={file.name} 
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs font-medium text-white">{file.name}</p>
                  <p className="text-[10px] text-white/80">{file.category}</p>
                </div>
                <button
                  onClick={() => setPreviewFile(file)}
                  className="absolute left-2 top-2 rounded-full bg-white/20 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-emerald-500 opacity-0 group-hover:opacity-100"
                  title="Preview image"
                >
                  <i className="ri-eye-line text-sm"></i>
                </button>
                <button
                  onClick={() => setFileToDelete(file)}
                  className="absolute right-2 top-2 rounded-full bg-white/20 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-red-500"
                  title="Delete image"
                >
                  <i className="ri-delete-bin-line text-sm"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document List */}
      {documentFiles.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Documents</h4>
          <div className="grid gap-3">
            {documentFiles.map((file, index) => (
              <div key={`${file.path}-${index}`} className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md dark:border-gray-800 dark:bg-[#0e0b1a] dark:hover:border-emerald-800">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl 
                  ${file.type.includes('pdf') ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20'}`}>
                   <i className={`${file.type.includes('pdf') ? 'ri-file-pdf-line' : 'ri-file-text-line'} text-2xl`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="block truncate text-base font-semibold text-gray-900 hover:text-emerald-600 dark:text-gray-100 dark:hover:text-emerald-400">
                    {file.name}
                  </a>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{file.category}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button 
                    onClick={() => setPreviewFile(file)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20"
                    title="Preview"
                  >
                    <i className="ri-eye-line text-lg"></i>
                  </button>
                  <a 
                    href={file.url} 
                    download 
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-gray-800"
                    title="Download"
                  >
                    <i className="ri-download-line text-lg"></i>
                  </a>
                  <button
                    onClick={() => setFileToDelete(file)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <i className="ri-delete-bin-line text-lg"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {files.length === 0 && !isUploading && (
         <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No documents or media uploaded yet.</p>
         </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#15111f] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-4">{previewFile.name}</h3>
              <div className="flex items-center gap-2">
                {previewFile.type.includes('image') && (
                  <div className="hidden sm:flex items-center gap-1 mr-2 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                    <button onClick={handleZoomOut} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-white dark:hover:bg-white/10 transition-colors">
                      <i className="ri-zoom-out-line"></i>
                    </button>
                    <span className="text-xs font-medium w-12 text-center text-gray-600 dark:text-gray-300">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-white dark:hover:bg-white/10 transition-colors">
                      <i className="ri-zoom-in-line"></i>
                    </button>
                    <button onClick={handleResetZoom} className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-white dark:hover:bg-white/10 transition-colors ml-1" title="Reset Zoom">
                      <i className="ri-refresh-line"></i>
                    </button>
                  </div>
                )}
                <a 
                  href={previewFile.url} 
                  download={previewFile.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-medium text-sm mr-2"
                >
                  <i className="ri-download-line text-lg"></i>
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button onClick={() => { setPreviewFile(null); setZoom(1); }} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full bg-gray-100 dark:bg-white/10 transition-colors">
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black/50 p-4 flex items-center justify-center">
              {previewFile.type.includes('image') ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center">
                  <img 
                    src={previewFile.url} 
                    alt={previewFile.name} 
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} 
                  />
                </div>
              ) : previewFile.type.includes('pdf') ? (
                <iframe src={previewFile.url} className="w-full h-full border-0" title={previewFile.name} />
              ) : (
                <div className="text-center p-8">
                  <i className="ri-file-text-line text-6xl text-gray-400 mb-4"></i>
                  <p className="text-gray-600 dark:text-gray-300">Preview not available for this file type.</p>
                  <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700">Download File</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadSection;

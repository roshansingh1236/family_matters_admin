import React, { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import Button from '../base/Button';
import ConfirmationDialog from '../base/ConfirmationDialog';

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
  files?: FileRecord[];
  onFilesChange: (files: FileRecord[]) => Promise<void> | void;
};

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  title,
  description,
  userId,
  files = [],
  onFilesChange
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('Other');
  
  // Dialog State
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  
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
      const storagePath = `users/${userId}/${selectedCategory}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload failed:', error);
          let friendlyError = `Upload failed: ${error.message}`;
          setUploadError(friendlyError);
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            const newFile: FileRecord = {
              name: file.name,
              url: downloadURL,
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
          } catch (urlError) {
             console.error('Error getting download URL:', urlError);
             setUploadError('Upload succeeded but failed to get file URL.');
             setIsUploading(false);
          }
        }
      );
    } catch (error) {
      console.error('Error starting upload:', error);
      setUploadError('Failed to start upload.');
      setIsUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    // Helper to get path from URL if missing
    const getStoragePath = (file: FileRecord): string | null => {
        if (file.path) return file.path;
        try {
            const urlObj = new URL(file.url);
            const pathStart = urlObj.pathname.indexOf('/o/');
            if (pathStart === -1) return null;
            const encodedPath = urlObj.pathname.substring(pathStart + 3);
            return decodeURIComponent(encodedPath);
        } catch {
            return null;
        }
    };

    const storagePath = getStoragePath(fileToDelete);

    try {
      if (storagePath) {
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef).catch((error) => {
            console.warn('File might not exist in storage or invalid path, proceeding to remove record:', error);
          });
      } else {
          console.warn('Could not determine storage path, removing record only.');
      }

      const updatedFiles = files.filter((f) => f.url !== fileToDelete.url); // Filter by URL as it's more unique/stable
      await onFilesChange(updatedFiles);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file.');
    } finally {
        setFileToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
            : 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-gray-900/50'
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
              className="rounded-xl border-gray-200 bg-gray-50 py-2 pl-3 pr-8 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
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
              <div key={`${file.path}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
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
              <div key={`${file.path}-${index}`} className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-800">
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
    </div>
  );
};

export default FileUploadSection;

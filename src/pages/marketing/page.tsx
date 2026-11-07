import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { supabase } from '../../lib/supabase';
import { STORAGE_BUCKETS } from '../../services/storageService';
import Toast from '../../components/base/Toast';

// Private bucket (see 20261027_private_marketing_assets.sql): only Admin /
// Agency Staff can read it, and files open through short-lived signed links.
const MARKETING_BUCKET = 'marketing';
const SIGNED_URL_SECONDS = 10 * 60;

// Files used to live under marketing/<folder>/ in the public `users` bucket.
// Move any still there into the private bucket, once per folder per session.
const movedFolders = new Set<string>();
async function moveLegacyFiles(folder: string): Promise<number> {
  if (movedFolders.has(folder)) return 0;
  const { data: legacy, error } = await supabase.storage
    .from(STORAGE_BUCKETS.USERS)
    .list(`marketing/${folder}`, { limit: 1000 });
  if (error) throw error;

  let moved = 0;
  // `list` also returns a placeholder entry for empty folders; skip it.
  for (const file of (legacy || []).filter(f => f.id && f.name !== '.emptyFolderPlaceholder')) {
    const { error: moveError } = await supabase.storage
      .from(STORAGE_BUCKETS.USERS)
      .move(`marketing/${folder}/${file.name}`, `${folder}/${file.name}`, { destinationBucket: MARKETING_BUCKET });
    if (moveError) throw moveError;
    await supabase
      .from('marketing_assets')
      .update({ storage_path: `${folder}/${file.name}`, file_url: null })
      .eq('folder_id', folder)
      .eq('name', file.name);
    moved++;
  }
  movedFolders.add(folder);
  return moved;
}

const FOLDERS = [
  { id: 'marketing_materials', label: 'Marketing Materials', icon: 'ri-advertisement-line', color: 'rose' },
  { id: 'design_files', label: 'Design Files', icon: 'ri-brush-line', color: 'indigo' },
  { id: 'videos', label: 'Videos', icon: 'ri-video-line', color: 'purple' },
  { id: 'pdfs', label: 'PDFs & Documents', icon: 'ri-file-pdf-line', color: 'red' },
  { id: 'pictures', label: 'Pictures & Assets', icon: 'ri-image-line', color: 'emerald' },
] as const;

export default function MarketingPage() {
  const [activeFolder, setActiveFolder] = useState<typeof FOLDERS[number]['id']>('marketing_materials');
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      try {
        const moved = await moveLegacyFiles(activeFolder);
        if (moved > 0) {
          setToast({ message: `Moved ${moved} file${moved === 1 ? '' : 's'} to private storage`, type: 'success' });
        }
      } catch (moveErr) {
        // Leave them where they are; the next visit tries again.
        console.error('Moving marketing files to private storage failed:', moveErr);
        setToast({ message: 'Some older files could not be moved to private storage yet', type: 'error' });
      }

      // Fetch dynamic metadata from database
      const { data: dbAssets } = await supabase
        .from('marketing_assets')
        .select('*')
        .eq('folder_id', activeFolder)
        .order('created_at', { ascending: false });

      // Also list physical files in storage
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from(MARKETING_BUCKET)
        .list(activeFolder, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (storageError) throw storageError;
      
      const mergedFiles = (storageFiles || []).filter(f => f.id && f.name !== '.emptyFolderPlaceholder').map(file => {
        const dbMatch = dbAssets?.find(a => a.name === file.name);
        return {
          ...file,
          dbId: dbMatch?.id,
          path: `${activeFolder}/${file.name}`,
          displayName: dbMatch?.metadata?.originalName || file.name.split('-').slice(1).join('-') || file.name
        };
      });
      
      setFiles(mergedFiles);
    } catch (err: any) {
      console.error('Error fetching assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    fetchFiles();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('marketing-assets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_assets' }, () => fetchFiles())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [fetchFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const path = `${activeFolder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(MARKETING_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      // Register in Database for dynamic tracking
      await supabase.from('marketing_assets').insert({
        name: fileName,
        folder_id: activeFolder,
        storage_path: path,
        file_type: file.type,
        file_size: file.size,
        metadata: { originalName: file.name }
      });

      setToast({ message: 'Asset indexed successfully', type: 'success' });
      fetchFiles();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setToast({ message: 'Upload failed', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (fileName: string, dbId?: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    try {
      const { error: removeError } = await supabase.storage
        .from(MARKETING_BUCKET)
        .remove([`${activeFolder}/${fileName}`]);
      if (removeError) throw removeError;
      if (dbId) {
        await supabase.from('marketing_assets').delete().eq('id', dbId);
      }
      setToast({ message: 'Asset removed', type: 'success' });
      fetchFiles();
    } catch (err: any) {
      console.error('Delete failed:', err);
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  // Private files: fetch a short-lived link when the file is opened. The tab
  // is opened first (synchronously) so the browser doesn't block it as a popup.
  const openFile = async (path: string, downloadName?: string) => {
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage
      .from(MARKETING_BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS, downloadName ? { download: downloadName } : undefined);
    if (error || !data?.signedUrl) {
      tab?.close();
      console.error('Could not open file:', error);
      setToast({ message: 'Could not open the file', type: 'error' });
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = data.signedUrl;
    } else {
      window.location.href = data.signedUrl;
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return 'ri-image-line text-emerald-500';
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) return 'ri-video-line text-purple-500';
    if (ext === 'pdf') return 'ri-file-pdf-line text-red-500';
    return 'ri-file-line text-gray-500';
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Marketing Assets</h1>
              <p className="text-gray-500 font-medium mt-1">
                <i className="ri-lock-line mr-1"></i>Private brand and media storage, visible only to logged-in staff.
              </p>
            </div>
            <Button color="blue" onClick={() => fileInputRef.current?.click()} isLoading={isUploading}>
              <i className="ri-upload-cloud-line mr-2"></i> Add Asset
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2 mb-4">Storage Folders</h3>
              {FOLDERS.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
                    activeFolder === folder.id 
                    ? 'bg-white dark:bg-white/10 shadow-lg shadow-rose-500/5 text-rose-500 border border-rose-100/50 dark:border-white/5' 
                    : 'text-gray-500 hover:bg-white dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-${folder.color}-500/10 flex items-center justify-center text-${folder.color}-500`}>
                    <i className={`${folder.icon} text-xl`}></i>
                  </div>
                  <span className="font-bold text-sm text-left">{folder.label}</span>
                  {activeFolder === folder.id && <i className="ri-arrow-right-s-line ml-auto"></i>}
                </button>
              ))}
            </div>

            <div className="lg:col-span-3">
              <Card className="min-h-[600px] flex flex-col">
                <div className="p-6 border-b border-rose-100/50 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <i className={FOLDERS.find(f => f.id === activeFolder)?.icon}></i>
                    </div>
                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs">
                      {FOLDERS.find(f => f.id === activeFolder)?.label}
                    </h3>
                  </div>
                  <Badge color="rose" variant="outline">{files.length} Assets</Badge>
                </div>

                <div className="p-6">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                      <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 font-medium text-sm">Synchronizing cloud storage...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                      <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-300 mb-6">
                        <i className="ri-folder-open-line text-4xl"></i>
                      </div>
                      <h4 className="text-gray-900 dark:text-white font-bold">Folder is Empty</h4>
                      <p className="text-gray-500 text-sm mt-1 max-w-xs">Upload marketing materials to this folder to share them with the team.</p>
                      <Button variant="outline" className="mt-6" onClick={() => fileInputRef.current?.click()}>
                        Upload First Asset
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {files.map((file) => (
                        <div key={file.id} className="group relative rounded-2xl border border-rose-100/50 dark:border-white/5 bg-white dark:bg-[#15111f] p-4 hover:shadow-xl hover:-translate-y-1 transition-all">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-lg">
                              <i className={`${getFileIcon(file.name)} text-2xl`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-rose-500 transition-colors" title={file.displayName}>
                                {file.displayName}
                              </p>
                              <p className="text-[10px] text-gray-400 font-medium uppercase mt-1">
                                {(file.metadata?.size / 1024 / 1024).toFixed(2)} MB • {file.metadata?.mimetype?.split('/')[1] || 'Asset'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                            <button onClick={() => openFile(file.path)} className="flex-1 py-2 rounded-lg bg-rose-500 text-white text-[10px] font-black uppercase text-center shadow-lg shadow-rose-500/20">
                              Open File
                            </button>
                            <button onClick={() => openFile(file.path, file.displayName)} aria-label="Download" title="Download" className="w-10 h-9 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-500 hover:text-rose-500 transition-colors flex items-center justify-center">
                              <i className="ri-download-2-line"></i>
                            </button>
                            <button onClick={() => handleDelete(file.name, file.dbId)} className="w-10 h-9 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-500 hover:text-rose-500 transition-colors flex items-center justify-center">
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

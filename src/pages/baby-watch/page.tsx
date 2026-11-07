import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { 
  babyWatchService, 
  type BabyWatchUpdate, 
  type MediaType, 
  getMediaType, 
  getFileNameFromUrl 
} from '../../services/babyWatchService';
import { supabase } from '../../lib/supabase';

interface AttachedMediaItem {
  id: string;
  file?: File;
  url?: string;
  name: string;
  type: MediaType;
  size?: number;
  previewUrl?: string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getMediaMeta = (type: MediaType) => {
  switch (type) {
    case 'video':
      return {
        label: 'Video Clip',
        icon: 'ri-movie-line',
        badgeBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        textColor: 'text-purple-600 dark:text-purple-400'
      };
    case 'audio':
      return {
        label: 'Heartbeat / Audio',
        icon: 'ri-heart-pulse-line',
        badgeBg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        textColor: 'text-rose-600 dark:text-rose-400'
      };
    case 'document':
      return {
        label: 'Medical Report',
        icon: 'ri-file-pdf-2-line',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-600 dark:text-amber-400'
      };
    case 'image':
    default:
      return {
        label: 'Ultrasound Photo',
        icon: 'ri-image-line',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-600 dark:text-blue-400'
      };
  }
};

const BabyWatchPage: React.FC = () => {
  const [updates, setUpdates] = useState<BabyWatchUpdate[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [selectedUpdate, setSelectedUpdate] = useState<BabyWatchUpdate | null>(null);
  const [detailMediaIndex, setDetailMediaIndex] = useState<number>(0);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-media management state
  const [mediaList, setMediaList] = useState<AttachedMediaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<BabyWatchUpdate>>({
    caseId: '',
    parentId: '',
    parentName: '',
    surrogateId: '',
    surrogateName: '',
    date: new Date().toISOString().split('T')[0],
    gestationalAge: '',
    weight: '',
    heartRate: '',
    medicalNotes: '',
    sharedWithParents: true
  });

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      const data = await babyWatchService.getAllUpdates();
      setUpdates(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load updates');
      setUpdates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('journeys')
        .select(`
          id,
          case_number,
          parent_id,
          surrogate_id,
          status,
          parent:parent_id(id, full_name),
          surrogate:surrogate_id(id, full_name)
        `);

      if (fetchError) {
        const { data: simpleData } = await supabase.from('journeys').select('*');
        const casesData = (simpleData || []).map((c: any) => ({
          id: c.id,
          ...c,
          displayName: `Journey #${c.case_number}`
        }));
        setCases(casesData);
        return;
      }

      // Names of each journey's surrogate and intended parent.
      const userIds = [...new Set((data || []).flatMap(c => [c.surrogate_id, c.parent_id]).filter(Boolean))];
      const names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('*').in('id', userIds);
        for (const u of users || []) {
          const fd = u.form_data && typeof u.form_data === 'object' ? u.form_data : {};
          names[u.id] =
            u.full_name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') ||
            [fd.firstName, fd.lastName].filter(Boolean).join(' ') ||
            u.email ||
            'Unknown';
        }
      }

      const casesData = (data || []).map(c => {
        const surrogateName = c.surrogate_id ? names[c.surrogate_id] : '';
        const parentName = c.parent_id ? names[c.parent_id] : '';
        return {
          ...c,
          id: c.id,
          surrogateId: c.surrogate_id || '',
          surrogateName: surrogateName || '',
          parentId: c.parent_id || '',
          parentName: parentName || '',
          displayName: `Journey #${c.case_number}${surrogateName || parentName ? ` · ${[surrogateName, parentName].filter(Boolean).join(' & ')}` : ''}`
        };
      });
      setCases(casesData);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  };

  useEffect(() => {
    fetchUpdates();
    fetchCases();
  }, []);

  // The journey an update belongs to (with its people), for cards and details.
  const journeyFor = (caseId?: string) => cases.find(c => c.id === caseId);

  const filteredUpdates = selectedCase === 'all' 
    ? updates 
    : updates.filter(u => u.caseId === selectedCase);

  const handleOpenNewModal = () => {
    // Revoke any previous preview URLs
    mediaList.forEach(m => {
      if (m.previewUrl && m.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(m.previewUrl);
      }
    });

    setFormData({
      caseId: '',
      parentId: '',
      parentName: '',
      surrogateId: '',
      surrogateName: '',
      date: new Date().toISOString().split('T')[0],
      gestationalAge: '',
      weight: '',
      heartRate: '',
      medicalNotes: '',
      sharedWithParents: true
    });
    setMediaList([]);
    setShowModal(true);
  };

  const handleOpenEditModal = (update: BabyWatchUpdate) => {
    // Revoke previous blob URLs
    mediaList.forEach(m => {
      if (m.previewUrl && m.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(m.previewUrl);
      }
    });

    setFormData(update);

    const existingUrls = update.attachments && update.attachments.length > 0 
      ? update.attachments 
      : (update.imageUrl ? [update.imageUrl] : []);

    const initialMedia: AttachedMediaItem[] = existingUrls.map((url, idx) => ({
      id: `existing_${idx}_${url}`,
      url,
      name: getFileNameFromUrl(url) || `Attachment #${idx + 1}`,
      type: getMediaType(url),
      previewUrl: url
    }));

    setMediaList(initialMedia);
    setShowModal(true);
    setSelectedUpdate(null);
  };

  const appendFiles = (files: File[]) => {
    const newItems: AttachedMediaItem[] = files.map(file => {
      const type = getMediaType(file.name, file.type);
      const previewUrl = URL.createObjectURL(file);
      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        type,
        size: file.size,
        previewUrl
      };
    });
    setMediaList(prev => [...prev, ...newItems]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveMedia = (id: string) => {
    setMediaList(prev => {
      const target = prev.find(item => item.id === id);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleCloseModal = () => {
    mediaList.forEach(m => {
      if (m.previewUrl && m.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(m.previewUrl);
      }
    });
    setMediaList([]);
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.caseId) {
      setError('Please select a journey/case');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const existingUrls = mediaList
        .filter(item => item.url && !item.file)
        .map(item => item.url!);
      const newFiles = mediaList
        .filter(item => item.file)
        .map(item => item.file!);

      if (formData.id) {
        await babyWatchService.updateUpdate(formData.id, formData, newFiles, existingUrls);
      } else {
        await babyWatchService.createUpdate(formData as Omit<BabyWatchUpdate, 'id'>, newFiles, existingUrls);
      }

      // Cleanup object URLs
      mediaList.forEach(m => {
        if (m.previewUrl && m.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(m.previewUrl);
        }
      });
      setMediaList([]);

      await fetchUpdates();
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, imagePath?: string, attachments?: string[]) => {
    if (!window.confirm('Are you sure you want to delete this update and all its attachments?')) return;
    setIsLoading(true);
    try {
      await babyWatchService.deleteUpdate(id, imagePath, attachments);
      await fetchUpdates();
      setSelectedUpdate(null);
    } catch (err) {
      setError('Failed to delete update');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Baby Watch</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Medical updates, ultrasounds, video scans, fetal heartbeats & clinical notes.
                </p>
              </div>
              <Button color="blue" onClick={handleOpenNewModal}>
                <i className="ri-add-line mr-2"></i>
                New Update
              </Button>
            </div>
          </div>

          {/* Case Filter */}
          <div className="mb-6">
            <select
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200/50 dark:border-white/5/50 bg-white/80 dark:bg-[#15111f]/80 backdrop-blur-md text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none transition-all shadow-sm hover:shadow-md"
            >
              <option value="all">All Cases ({updates.length})</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({updates.filter(u => u.caseId === c.id).length})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-error-warning-line text-lg"></i>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="hover:opacity-75">
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}

          {isLoading && !showModal ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUpdates.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white dark:bg-[#15111f] rounded-2xl border border-dashed border-gray-300 dark:border-white/5">
                  <i className="ri-heart-pulse-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">No updates found.</p>
                </div>
              ) : (
                filteredUpdates.map((update) => {
                  const attachments = update.attachments && update.attachments.length > 0 
                    ? update.attachments 
                    : (update.imageUrl ? [update.imageUrl] : []);
                  const primaryMedia = attachments[0];
                  const primaryType = primaryMedia ? getMediaType(primaryMedia) : null;
                  const primaryMeta = primaryType ? getMediaMeta(primaryType) : null;

                  return (
                    <Card 
                      key={update.id} 
                      padding="none"
                      className="group hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border-0 bg-white/70 dark:bg-[#15111f]/70 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 hover:-translate-y-1 flex flex-col"
                      onClick={() => {
                        setSelectedUpdate(update);
                        setDetailMediaIndex(0);
                      }}
                    >
                      {primaryMedia ? (
                        <div className="w-full h-56 bg-gray-100 dark:bg-[#0e0b1a] overflow-hidden relative flex items-center justify-center">
                          {primaryType === 'image' && (
                            <img 
                              src={primaryMedia} 
                              alt="Ultrasound" 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          )}

                          {primaryType === 'video' && (
                            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden group/video">
                              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-3xl shadow-xl group-hover:scale-110 transition-transform">
                                <i className="ri-play-fill ml-1"></i>
                              </div>
                              <span className="text-xs font-semibold text-white/90 mt-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                                Ultrasound Video
                              </span>
                            </div>
                          )}

                          {primaryType === 'audio' && (
                            <div className="w-full h-full bg-gradient-to-br from-rose-500/20 via-purple-500/10 to-blue-500/20 flex flex-col items-center justify-center p-6 text-center">
                              <div className="w-16 h-16 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 mb-3 group-hover:scale-110 transition-transform">
                                <i className="ri-heart-pulse-line text-3xl animate-pulse"></i>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                Fetal Heartbeat Audio
                              </span>
                              <span className="text-xs text-rose-500 font-semibold mt-1">
                                Click to listen
                              </span>
                            </div>
                          )}

                          {primaryType === 'document' && (
                            <div className="w-full h-full bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-red-500/15 flex flex-col items-center justify-center p-6 text-center">
                              <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 mb-3 group-hover:scale-110 transition-transform">
                                <i className="ri-file-pdf-2-line text-3xl"></i>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 px-4">
                                {getFileNameFromUrl(primaryMedia) || 'Medical Report (PDF)'}
                              </span>
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                Clinical Document
                              </span>
                            </div>
                          )}

                          {primaryType === 'other' && (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex flex-col items-center justify-center">
                              <i className="ri-attachment-2 text-4xl text-gray-400 mb-2"></i>
                              <span className="text-xs text-gray-500">Attachment</span>
                            </div>
                          )}

                          {/* Media count pill if multiple */}
                          {attachments.length > 1 && (
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/60 text-white backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                              <i className="ri-folder-image-line"></i>
                              <span>{attachments.length} files</span>
                            </div>
                          )}

                          {/* Media Type Badge in Bottom Left */}
                          {primaryMeta && (
                            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold bg-black/60 text-white backdrop-blur-md flex items-center gap-1.5">
                              <i className={primaryMeta.icon}></i>
                              <span>{primaryMeta.label}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-40 bg-gradient-to-br from-rose-500/5 to-purple-500/5 dark:bg-[#0e0b1a] flex flex-col items-center justify-center text-gray-400 border-b border-gray-100 dark:border-white/5">
                          <i className="ri-heart-pulse-line text-4xl text-rose-400 mb-1"></i>
                          <span className="text-xs text-gray-400">Clinical Log</span>
                        </div>
                      )}
                      
                      <div className="p-6 space-y-4 flex-1 flex flex-col">
                        {(() => {
                          const journey = journeyFor(update.caseId);
                          return (
                            <div className="rounded-xl bg-rose-50/60 dark:bg-white/5 px-3 py-2 text-xs">
                              <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                                <i className="ri-route-line text-rose-500"></i>
                                {journey ? `Journey #${journey.case_number}` : 'Journey not found'}
                                {journey?.stage && (
                                  <span className="ml-auto font-medium text-gray-500 dark:text-gray-400">{journey.stage}</span>
                                )}
                              </div>
                              {journey && (journey.surrogateName || journey.parentName) && (
                                <div className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
                                  {journey.surrogateName && <div className="truncate"><i className="ri-user-heart-line mr-1"></i>Surrogate: {journey.surrogateName}</div>}
                                  {journey.parentName && <div className="truncate"><i className="ri-parent-line mr-1"></i>Parent: {journey.parentName}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-rose-500 dark:text-rose-400">
                            {update.gestationalAge || 'Growth Milestone'}
                          </span>
                          {update.sharedWithParents && (
                            <Badge color="green">Shared</Badge>
                          )}
                        </div>

                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-rose-500 dark:text-rose-400">
                              <i className="ri-calendar-line"></i>
                            </div>
                            <span>{update.date}</span>
                          </div>
                          {update.weight && (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                <i className="ri-scales-line"></i>
                              </div>
                              <span>{update.weight}</span>
                            </div>
                          )}
                          {update.heartRate && (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                                <i className="ri-heart-pulse-line"></i>
                              </div>
                              <span>{update.heartRate}</span>
                            </div>
                          )}
                        </div>

                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {update.medicalNotes}
                        </p>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Update Detail Modal */}
          {selectedUpdate && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xl transition-all duration-300 animate-in fade-in">
              <div className="bg-white/95 dark:bg-gray-900/95 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="relative">
                  <button
                    onClick={() => setSelectedUpdate(null)}
                    className="absolute top-4 right-4 z-20 p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>

                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Left: Dynamic Media Viewer */}
                    <div className="bg-gray-100 dark:bg-[#15111f] flex flex-col justify-between p-6 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-white/5">
                      {(() => {
                        const attachments = selectedUpdate.attachments && selectedUpdate.attachments.length > 0 
                          ? selectedUpdate.attachments 
                          : (selectedUpdate.imageUrl ? [selectedUpdate.imageUrl] : []);
                        
                        const safeIndex = Math.min(detailMediaIndex, Math.max(0, attachments.length - 1));
                        const currentUrl = attachments[safeIndex];
                        const currentType = currentUrl ? getMediaType(currentUrl) : null;
                        const currentMeta = currentType ? getMediaMeta(currentType) : null;

                        if (!currentUrl) {
                          return (
                            <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-gray-400 p-8">
                              <i className="ri-folder-open-line text-6xl mb-3 text-gray-300 dark:text-gray-600"></i>
                              <p className="font-medium">No media attached to this update</p>
                            </div>
                          );
                        }

                        return (
                          <div className="flex flex-col h-full justify-between space-y-4">
                            {/* Media Header with Badge & External Link */}
                            <div className="flex items-center justify-between">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${currentMeta?.badgeBg}`}>
                                <i className={currentMeta?.icon}></i>
                                {currentMeta?.label}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 font-medium">
                                  {safeIndex + 1} of {attachments.length}
                                </span>
                                <a 
                                  href={currentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-white/80 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:text-rose-500 transition-colors shadow-sm"
                                  title="Open in new window"
                                >
                                  <i className="ri-external-link-line"></i>
                                </a>
                              </div>
                            </div>

                            {/* Active Media Container */}
                            <div className="flex-1 flex items-center justify-center min-h-[300px] max-h-[460px] rounded-2xl overflow-hidden bg-black/5 dark:bg-black/40 p-2">
                              {currentType === 'image' && (
                                <img 
                                  src={currentUrl} 
                                  alt="Ultrasound" 
                                  className="max-h-[440px] max-w-full w-auto object-contain rounded-xl shadow-md"
                                />
                              )}

                              {currentType === 'video' && (
                                <video 
                                  key={currentUrl}
                                  src={currentUrl} 
                                  controls 
                                  playsInline
                                  className="max-h-[440px] w-full rounded-xl bg-black shadow-lg"
                                />
                              )}

                              {currentType === 'audio' && (
                                <div className="w-full max-w-md p-8 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-purple-950/20 border border-rose-200/50 dark:border-rose-900/30 flex flex-col items-center text-center shadow-lg">
                                  <div className="w-20 h-20 rounded-full bg-rose-500 text-white flex items-center justify-center text-4xl shadow-xl shadow-rose-500/30 mb-4 animate-pulse">
                                    <i className="ri-heart-pulse-line"></i>
                                  </div>
                                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Fetal Heartbeat Recording
                                  </h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-6">
                                    {getFileNameFromUrl(currentUrl)}
                                  </p>
                                  <audio 
                                    key={currentUrl}
                                    src={currentUrl} 
                                    controls 
                                    className="w-full focus:outline-none"
                                  />
                                </div>
                              )}

                              {currentType === 'document' && (
                                <div className="w-full max-w-md p-8 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 flex flex-col items-center text-center shadow-lg">
                                  <div className="w-20 h-20 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-4xl shadow-xl shadow-amber-500/30 mb-4">
                                    <i className="ri-file-pdf-2-line"></i>
                                  </div>
                                  <h4 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                                    {getFileNameFromUrl(currentUrl) || 'Clinical Ultrasound Report'}
                                  </h4>
                                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-1 mb-6">
                                    Medical Document / PDF
                                  </p>
                                  <div className="flex gap-3">
                                    <a 
                                      href={currentUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md transition-colors"
                                    >
                                      <i className="ri-eye-line"></i>
                                      View PDF
                                    </a>
                                    <a 
                                      href={currentUrl} 
                                      download
                                      className="px-5 py-2.5 rounded-xl bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-gray-800 dark:text-white text-sm font-semibold flex items-center gap-2 border border-gray-200 dark:border-white/10 transition-colors"
                                    >
                                      <i className="ri-download-line"></i>
                                      Download
                                    </a>
                                  </div>
                                </div>
                              )}

                              {currentType === 'other' && (
                                <div className="text-center p-8">
                                  <i className="ri-file-line text-6xl text-gray-400 mb-3"></i>
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                                    {getFileNameFromUrl(currentUrl)}
                                  </p>
                                  <a 
                                    href={currentUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"
                                  >
                                    Download Attachment
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Carousel / Thumbnail Strip when multiple media */}
                            {attachments.length > 1 && (
                              <div className="pt-2 border-t border-gray-200 dark:border-white/5">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                  All Attached Media ({attachments.length})
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                  {attachments.map((url, idx) => {
                                    const itemType = getMediaType(url);
                                    const isSelected = idx === safeIndex;
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setDetailMediaIndex(idx)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 relative transition-all ${
                                          isSelected 
                                            ? 'border-rose-500 ring-2 ring-rose-500/30 scale-105' 
                                            : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300 dark:hover:border-white/20'
                                        }`}
                                      >
                                        {itemType === 'image' && (
                                          <img src={url} alt="Thumb" className="w-full h-full object-cover" />
                                        )}
                                        {itemType === 'video' && (
                                          <div className="w-full h-full bg-purple-900/60 flex items-center justify-center text-white">
                                            <i className="ri-movie-line text-xl"></i>
                                          </div>
                                        )}
                                        {itemType === 'audio' && (
                                          <div className="w-full h-full bg-rose-900/60 flex items-center justify-center text-white">
                                            <i className="ri-heart-pulse-line text-xl"></i>
                                          </div>
                                        )}
                                        {itemType === 'document' && (
                                          <div className="w-full h-full bg-amber-900/60 flex items-center justify-center text-white">
                                            <i className="ri-file-pdf-2-line text-xl"></i>
                                          </div>
                                        )}
                                        {itemType === 'other' && (
                                          <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white">
                                            <i className="ri-attachment-2 text-xl"></i>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right: Content & Metadata */}
                    <div className="p-8 space-y-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-rose-500 dark:text-rose-400 rounded-full text-xs font-bold uppercase tracking-wider">
                            Medical Update
                          </span>
                          {selectedUpdate.sharedWithParents && (
                            <Badge color="green">Shared with Parents</Badge>
                          )}
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">
                          {selectedUpdate.gestationalAge || 'Development Milestone'}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <i className="ri-calendar-line text-blue-500"></i> Date
                          </p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">{selectedUpdate.date}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <i className="ri-scales-line text-pink-500"></i> Weight
                          </p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">{selectedUpdate.weight || 'N/A'}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <i className="ri-heart-pulse-line text-red-500"></i> Heart Rate
                          </p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">{selectedUpdate.heartRate || 'N/A'}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-route-line text-purple-500"></i> Journey
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {journeyFor(selectedUpdate.caseId) ? `#${journeyFor(selectedUpdate.caseId).case_number}` : 'N/A'}
                          </p>
                          {journeyFor(selectedUpdate.caseId)?.stage && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{journeyFor(selectedUpdate.caseId).stage}</p>
                          )}
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-user-heart-line text-purple-500"></i> Surrogate
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{journeyFor(selectedUpdate.caseId)?.surrogateName || 'N/A'}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 items-center flex gap-2">
                            <i className="ri-parent-line text-purple-500"></i> Intended Parent
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{journeyFor(selectedUpdate.caseId)?.parentName || 'N/A'}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Medical Notes</h4>
                        <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 max-h-48 overflow-y-auto">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic text-sm">
                            "{selectedUpdate.medicalNotes}"
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                        <Button color="blue" className="flex-1 py-3 text-base rounded-2xl shadow-lg shadow-blue-500/20" onClick={() => handleOpenEditModal(selectedUpdate)}>
                          <i className="ri-edit-line mr-2"></i>
                          Edit Update
                        </Button>
                        <Button 
                          color="red" 
                          variant="outline" 
                          className="flex-1 py-3 text-base rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10" 
                          onClick={() => selectedUpdate.id && handleDelete(selectedUpdate.id, selectedUpdate.imagePath, selectedUpdate.attachments)}
                        >
                          <i className="ri-delete-bin-line mr-2"></i>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xl animate-in fade-in transition-all">
              <div className="bg-white/95 dark:bg-gray-900/95 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-white/5 animate-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit} className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formData.id ? 'Edit Update' : 'New Update'}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Add medical notes and upload any kind of media (photos, videos, heartbeats, reports).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Multi-Media Upload Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                          Medical & Ultrasound Media
                        </label>
                        <span className="text-xs text-gray-500">
                          Photos, Videos, Heartbeat Audio, or PDF reports
                        </span>
                      </div>

                      {/* Dropzone */}
                      <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                          isDragging 
                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 scale-[1.01]' 
                            : 'border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 bg-gray-50/50 dark:bg-white/[0.02]'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="media-file-upload"
                        />

                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center gap-3 text-3xl mb-3 text-gray-400 dark:text-gray-500">
                            <span title="Ultrasound Images" className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                              <i className="ri-image-line"></i>
                            </span>
                            <span title="Ultrasound Video" className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-500">
                              <i className="ri-movie-line"></i>
                            </span>
                            <span title="Fetal Heartbeat Audio" className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                              <i className="ri-heart-pulse-line"></i>
                            </span>
                            <span title="Medical Report PDF" className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                              <i className="ri-file-pdf-2-line"></i>
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Click to upload or drag and drop all kinds of media
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Supports Images (JPG, PNG), Videos (MP4, MOV), Audio (MP3, WAV), and Documents (PDF)
                          </p>

                          <label
                            htmlFor="media-file-upload"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                          >
                            <i className="ri-upload-cloud-2-line text-lg"></i>
                            Choose Media Files
                          </label>
                        </div>
                      </div>

                      {/* Uploaded / Existing Media Gallery in Form */}
                      {mediaList.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <span>Attached Media ({mediaList.length})</span>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 lowercase first-letter:uppercase"
                            >
                              <i className="ri-add-line"></i> add more files
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                            {mediaList.map((item) => {
                              const meta = getMediaMeta(item.type);
                              const src = item.previewUrl || item.url || '';

                              return (
                                <div 
                                  key={item.id}
                                  className="relative group p-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/80 shadow-sm flex items-center gap-3 overflow-hidden"
                                >
                                  {/* Thumbnail / Icon Preview */}
                                  <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                                    {item.type === 'image' && (
                                      <img src={src} alt={item.name} className="w-full h-full object-cover" />
                                    )}

                                    {item.type === 'video' && (
                                      <div className="w-full h-full bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-300">
                                        <i className="ri-movie-line text-2xl"></i>
                                      </div>
                                    )}

                                    {item.type === 'audio' && (
                                      <div className="w-full h-full bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-300">
                                        <i className="ri-heart-pulse-line text-2xl"></i>
                                      </div>
                                    )}

                                    {item.type === 'document' && (
                                      <div className="w-full h-full bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-300">
                                        <i className="ri-file-pdf-2-line text-2xl"></i>
                                      </div>
                                    )}

                                    {item.type === 'other' && (
                                      <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white">
                                        <i className="ri-attachment-2 text-2xl"></i>
                                      </div>
                                    )}
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0 pr-6">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 border ${meta.badgeBg}`}>
                                      <i className={meta.icon}></i>
                                      {meta.label}
                                    </span>
                                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate" title={item.name}>
                                      {item.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {item.size ? formatFileSize(item.size) : (item.url ? 'Uploaded' : 'Pending')}
                                    </p>
                                  </div>

                                  {/* Remove Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMedia(item.id)}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Remove file"
                                  >
                                    <i className="ri-delete-bin-line"></i>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Journey / Case</label>
                        <select
                          required
                          value={formData.caseId}
                          onChange={e => {
                            const caseId = e.target.value;
                            const selectedCaseObj = cases.find(c => c.id === caseId);
                            setFormData({ 
                              ...formData, 
                              caseId,
                              parentId: selectedCaseObj?.parentId || selectedCaseObj?.parent_id || '',
                              parentName: selectedCaseObj?.parentName || selectedCaseObj?.parent?.full_name || '',
                              surrogateId: selectedCaseObj?.surrogateId || selectedCaseObj?.surrogate_id || '',
                              surrogateName: selectedCaseObj?.surrogateName || selectedCaseObj?.surrogate?.full_name || ''
                            });
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        >
                          <option value="">Select Case</option>
                          {cases.map(c => (
                            <option key={c.id} value={c.id}>{c.displayName}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={e => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Gestational Age
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.gestationalAge}
                          onChange={e => setFormData({ ...formData, gestationalAge: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          placeholder="e.g. 12 Weeks"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
                        <input
                          type="text"
                          value={formData.weight}
                          onChange={e => setFormData({ ...formData, weight: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          placeholder="e.g. 50g"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heart Rate</label>
                        <input
                          type="text"
                          value={formData.heartRate}
                          onChange={e => setFormData({ ...formData, heartRate: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          placeholder="e.g. 150 bpm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medical Notes</label>
                      <textarea
                        required
                        value={formData.medicalNotes}
                        onChange={e => setFormData({ ...formData, medicalNotes: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        placeholder="Everything looks great! Baby is developing well..."
                      ></textarea>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="shared"
                        checked={formData.sharedWithParents}
                        onChange={e => setFormData({ ...formData, sharedWithParents: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-rose-500"
                      />
                      <label htmlFor="shared" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        Share with parents
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <Button type="button" variant="outline" className="flex-1 py-4 text-lg rounded-2xl" onClick={handleCloseModal}>
                      Cancel
                    </Button>
                    <Button type="submit" color="blue" className="flex-1 py-4 text-lg rounded-2xl shadow-lg shadow-blue-500/20" disabled={isLoading}>
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <i className="ri-loader-4-line animate-spin"></i>
                          Saving Update...
                        </span>
                      ) : 'Save Update'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default BabyWatchPage;


import { supabase } from '../lib/supabase';
import { storageService, STORAGE_BUCKETS } from './storageService';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

export const getMediaType = (urlOrName: string, mimeType?: string): MediaType => {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('sheet') ||
      mimeType.includes('text/')
    ) return 'document';
  }

  const clean = (urlOrName || '').split('?')[0].split('#')[0].toLowerCase();
  const ext = clean.substring(clean.lastIndexOf('.'));

  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic', '.avif'].includes(ext)) {
    return 'image';
  }
  if (['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv', '.ogv', '.quicktime'].includes(ext)) {
    return 'video';
  }
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.flac', '.opus', '.m4r'].includes(ext)) {
    return 'audio';
  }
  if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'].includes(ext)) {
    return 'document';
  }
  return 'other';
};

export const getFileNameFromUrl = (url: string): string => {
  if (!url) return '';
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop() || '';
    // Strip timestamp prefix if formatted as caseId_timestamp_filename
    const parts = name.split('_');
    if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
      return decodeURIComponent(parts.slice(2).join('_'));
    }
    return decodeURIComponent(name);
  } catch {
    const rawName = url.split('/').pop()?.split('?')[0] || url;
    return decodeURIComponent(rawName);
  }
};

export interface BabyWatchUpdate {
  id?: string;
  caseId: string;
  parentId: string;
  parentName: string;
  surrogateId: string;
  surrogateName: string;
  date: string;
  gestationalAge: string;
  weight?: string;
  heartRate?: string;
  medicalNotes: string;
  imageUrl?: string;
  imagePath?: string;
  attachments?: string[];
  sharedWithParents: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const TABLE_NAME = 'baby_watch_updates';
const BUCKET_NAME = STORAGE_BUCKETS.BABY_WATCH;

const mapUpdateRow = (u: any): BabyWatchUpdate => {
  const attachments: string[] = Array.isArray(u.attachments)
    ? u.attachments
    : (u.attachments ? [u.attachments] : []);

  // Find first image attachment for imageUrl backwards compatibility, or first attachment
  const primaryImage = attachments.find((a: string) => getMediaType(a) === 'image') || attachments[0] || '';

  const journey = u.journey;
  const parentName = journey?.parent?.full_name || u.data?.parentName || '';
  const surrogateName = journey?.surrogate?.full_name || u.data?.surrogateName || '';
  const parentId = journey?.parent_id || u.data?.parentId || '';
  const surrogateId = journey?.surrogate_id || u.data?.surrogateId || '';

  const dateVal = u.data?.date 
    ? (typeof u.data.date === 'string' && u.data.date.includes('T') ? u.data.date.split('T')[0] : u.data.date)
    : (u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);

  return {
    id: u.id,
    caseId: u.journey_id,
    parentId,
    parentName,
    surrogateId,
    surrogateName,
    date: dateVal,
    gestationalAge: u.data?.gestationalAge || '',
    weight: u.data?.weight ? String(u.data.weight) : '',
    heartRate: u.data?.heartRate ? String(u.data.heartRate) : '',
    medicalNotes: u.description || '',
    imageUrl: primaryImage,
    attachments,
    sharedWithParents: u.shared_with_parents ?? true,
    createdAt: u.created_at,
    updatedAt: u.updated_at
  };
};

export const babyWatchService = {
  // Fetch all updates
  getAllUpdates: async (): Promise<BabyWatchUpdate[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(`
          *,
          journey:journey_id(
            id,
            case_number,
            parent_id,
            surrogate_id,
            parent:parent_id(id, full_name),
            surrogate:surrogate_id(id, full_name)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn('Joined query failed, falling back to simple select:', error);
        const { data: simpleData, error: simpleError } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .order('created_at', { ascending: false });
        if (simpleError) throw simpleError;
        return (simpleData || []).map(mapUpdateRow);
      }

      return (data || []).map(mapUpdateRow);
    } catch (error) {
      console.error('Error fetching baby watch updates:', error);
      throw error;
    }
  },

  // Upload any media file (image, video, audio, document) to Supabase Storage
  uploadMediaFile: async (file: File, caseId: string): Promise<{ url: string; path: string; name: string; type: MediaType }> => {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${caseId || 'general'}_${timestamp}_${sanitizedName}`;
    const filePath = `updates/${fileName}`;
    
    const { url } = await storageService.uploadFile(BUCKET_NAME, filePath, file);
    return { 
      url, 
      path: filePath, 
      name: file.name,
      type: getMediaType(file.name, file.type)
    };
  },

  // Backwards compatibility alias for single image upload
  uploadImage: async (file: File, caseId: string): Promise<{ url: string; path: string }> => {
    return babyWatchService.uploadMediaFile(file, caseId);
  },

  // Create a new update with support for multiple media files
  createUpdate: async (
    update: any, 
    files?: File | File[] | null,
    existingAttachments: string[] = []
  ): Promise<string> => {
    try {
      const fileList = Array.isArray(files) ? files : (files ? [files] : []);
      const uploadedUrls: string[] = [];

      for (const file of fileList) {
        const { url } = await babyWatchService.uploadMediaFile(file, update.caseId);
        uploadedUrls.push(url);
      }

      const allAttachments = [...existingAttachments, ...uploadedUrls];

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          journey_id: update.caseId,
          title: update.title || `Update for ${update.date}`,
          description: update.medicalNotes,
          update_type: 'Milestone',
          data: {
            gestationalAge: update.gestationalAge,
            weight: update.weight,
            heartRate: update.heartRate,
            date: update.date,
            parentName: update.parentName,
            surrogateName: update.surrogateName,
            parentId: update.parentId,
            surrogateId: update.surrogateId
          },
          attachments: allAttachments,
          shared_with_parents: update.sharedWithParents ?? true
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating baby watch update:', error);
      throw error;
    }
  },

  // Update an existing update
  updateUpdate: async (
    id: string, 
    updates: any, 
    newFiles?: File | File[] | null,
    existingAttachments?: string[]
  ): Promise<void> => {
    try {
      const fileList = Array.isArray(newFiles) ? newFiles : (newFiles ? [newFiles] : []);
      const uploadedUrls: string[] = [];

      for (const file of fileList) {
        const { url } = await babyWatchService.uploadMediaFile(file, updates.caseId);
        uploadedUrls.push(url);
      }

      const currentAttachments = existingAttachments !== undefined 
        ? existingAttachments 
        : (updates.attachments || []);
      const allAttachments = [...currentAttachments, ...uploadedUrls];

      const mappedUpdates: any = {
        updated_at: new Date().toISOString(),
        description: updates.medicalNotes,
        title: updates.title || `Update for ${updates.date}`,
        shared_with_parents: updates.sharedWithParents ?? true,
        data: {
          gestationalAge: updates.gestationalAge,
          weight: updates.weight,
          heartRate: updates.heartRate,
          date: updates.date,
          parentName: updates.parentName,
          surrogateName: updates.surrogateName,
          parentId: updates.parentId,
          surrogateId: updates.surrogateId
        },
        attachments: allAttachments
      };

      if (updates.caseId) {
        mappedUpdates.journey_id = updates.caseId;
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(mappedUpdates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating baby watch update:', error);
      throw error;
    }
  },

  // Delete an update
  deleteUpdate: async (id: string, imagePath?: string, attachmentUrls?: string[]): Promise<void> => {
    try {
      if (imagePath) {
        try {
          await storageService.deleteFile(BUCKET_NAME, imagePath);
        } catch (e) {
          console.warn('Could not delete storage file:', imagePath, e);
        }
      }
      if (attachmentUrls && attachmentUrls.length > 0) {
        for (const url of attachmentUrls) {
          try {
            const parts = url.split(`/${BUCKET_NAME}/`);
            if (parts.length > 1) {
              const path = parts[1].split('?')[0];
              await storageService.deleteFile(BUCKET_NAME, path);
            }
          } catch (e) {
            console.warn('Could not delete attachment file:', url, e);
          }
        }
      }
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting baby watch update:', error);
      throw error;
    }
  },

  // Get updates by case ID
  getUpdatesByCaseId: async (caseId: string): Promise<BabyWatchUpdate[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(`
          *,
          journey:journey_id(
            id,
            case_number,
            parent_id,
            surrogate_id,
            parent:parent_id(id, full_name),
            surrogate:surrogate_id(id, full_name)
          )
        `)
        .eq('journey_id', caseId)
        .order('created_at', { ascending: false });
      
      if (error) {
        const { data: simpleData, error: simpleError } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .eq('journey_id', caseId)
          .order('created_at', { ascending: false });
        if (simpleError) throw simpleError;
        return (simpleData || []).map(mapUpdateRow);
      }

      return (data || []).map(mapUpdateRow);
    } catch (error) {
      console.error('Error fetching updates by case:', error);
      return [];
    }
  }
};


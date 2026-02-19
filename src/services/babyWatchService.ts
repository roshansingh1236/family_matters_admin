
import { supabase } from '../lib/supabase';
import { storageService, STORAGE_BUCKETS } from './storageService';

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
  sharedWithParents: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const TABLE_NAME = 'baby_watch_updates';
const BUCKET_NAME = STORAGE_BUCKETS.BABY_WATCH;

export const babyWatchService = {
  // Fetch all updates
  getAllUpdates: async (): Promise<BabyWatchUpdate[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(u => ({
          id: u.id,
          caseId: u.journey_id,
          title: u.title,
          medicalNotes: u.description,
          gestationalAge: u.data?.gestationalAge,
          weight: u.data?.weight,
          heartRate: u.data?.heartRate,
          imageUrl: u.attachments?.[0],
          sharedWithParents: u.shared_with_parents,
          createdAt: u.created_at
      })) as any[];
    } catch (error) {
      console.error('Error fetching baby watch updates:', error);
      throw error;
    }
  },

  // Upload image to Supabase Storage
  uploadImage: async (file: File, caseId: string): Promise<{ url: string; path: string }> => {
    const timestamp = Date.now();
    const fileName = `${caseId}_${timestamp}_${file.name}`;
    const filePath = `updates/${fileName}`;
    
    const { url } = await storageService.uploadFile(BUCKET_NAME, filePath, file);
    return { url, path: filePath };
  },

  // Create a new update
  createUpdate: async (update: any, imageFile?: File): Promise<string> => {
    try {
      let imageUrl = update.imageUrl;

      if (imageFile) {
        const { url } = await babyWatchService.uploadImage(imageFile, update.caseId);
        imageUrl = url;
      }

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
              date: update.date
          },
          attachments: imageUrl ? [imageUrl] : [],
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

  // Update an update
  updateUpdate: async (id: string, updates: any, imageFile?: File): Promise<void> => {
    try {
       const mappedUpdates: any = {
           updated_at: new Date().toISOString()
       };
       if (updates.medicalNotes) mappedUpdates.description = updates.medicalNotes;
       if (updates.title) mappedUpdates.title = updates.title;
       
       // Handle JSONB data updates if needed
       if (updates.gestationalAge || updates.weight || updates.heartRate) {
           // This would require fetching current data or using a deep merge via RPC/Logic
       }

       if (imageFile && updates.caseId) {
           const { url } = await babyWatchService.uploadImage(imageFile, updates.caseId);
           mappedUpdates.attachments = [url];
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
  deleteUpdate: async (id: string, imagePath?: string): Promise<void> => {
    try {
      if (imagePath) {
        await storageService.deleteFile(BUCKET_NAME, imagePath);
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
        .select('*')
        .eq('journey_id', caseId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(u => ({
          id: u.id,
          caseId: u.journey_id,
          medicalNotes: u.description,
          gestationalAge: u.data?.gestationalAge,
          weight: u.data?.weight,
          heartRate: u.data?.heartRate,
          imageUrl: u.attachments?.[0],
          sharedWithParents: u.shared_with_parents,
          createdAt: u.created_at
      })) as any[];
    } catch (error) {
      console.error('Error fetching updates by case:', error);
      return [];
    }
  }
};


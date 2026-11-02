
import { supabase } from '../lib/supabase';
import { storageService, STORAGE_BUCKETS } from './storageService';
import { pushService } from './pushService';
import { emailService } from './emailService';

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

/**
 * Tell the journey's surrogate about a new update, and the intended parent
 * too when it's shared with them (the app only shows parents shared updates).
 * A push, an email and an in-app notification, like other portal events.
 * Failures are logged and never block saving the update.
 */
async function notifyJourney(
  journeyId: string,
  recipients: { surrogate: boolean; parent: boolean },
  message: string,
  updateId: string,
): Promise<void> {
  try {
    const { data: journey, error } = await supabase
      .from('journeys')
      .select('parent_id, surrogate_id')
      .eq('id', journeyId)
      .maybeSingle();
    if (error) throw error;
    if (!journey) return;

    const ids = [
      recipients.surrogate ? journey.surrogate_id : null,
      recipients.parent ? journey.parent_id : null,
    ].filter((id): id is string => !!id);
    if (ids.length === 0) return;

    const title = 'New Baby Watch update';
    const data = { type: 'baby_watch', updateId, journeyId };
    void pushService.send(ids, title, message, data);
    void emailService.send(ids, title, message, data);
    const { error: notifError } = await supabase
      .from('notifications')
      .insert(ids.map((user_id) => ({ user_id, title, message, type: 'baby_watch' })));
    if (notifError) throw notifError;
  } catch (e) {
    console.error('Baby Watch notification failed', e);
  }
}

const updateMessage = (u: { gestationalAge?: string; title?: string }) =>
  u.gestationalAge
    ? `A new update has been posted: ${u.gestationalAge}. Open the app to see it.`
    : 'A new update has been posted. Open the app to see it.';

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
          // The date the admin entered (kept in data); else when it was posted.
          date: u.data?.date || (u.created_at ? String(u.created_at).split('T')[0] : ''),
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

      const shared = update.sharedWithParents ?? true;
      void notifyJourney(update.caseId, { surrogate: true, parent: shared }, updateMessage(update), data.id);

      return data.id;
    } catch (error) {
      console.error('Error creating baby watch update:', error);
      throw error;
    }
  },

  // Update an update
  updateUpdate: async (id: string, updates: any, imageFile?: File): Promise<void> => {
    try {
      // Read the current row: data is one JSON column, so edited fields are
      // merged into it, and we need to know whether sharing was just turned on.
      const { data: current, error: fetchError } = await supabase
        .from(TABLE_NAME)
        .select('journey_id, data, shared_with_parents')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const mappedUpdates: any = {
        updated_at: new Date().toISOString(),
        data: {
          ...(current.data || {}),
          ...(updates.gestationalAge !== undefined ? { gestationalAge: updates.gestationalAge } : {}),
          ...(updates.weight !== undefined ? { weight: updates.weight } : {}),
          ...(updates.heartRate !== undefined ? { heartRate: updates.heartRate } : {}),
          ...(updates.date !== undefined ? { date: updates.date } : {}),
        },
      };
      if (updates.medicalNotes !== undefined) mappedUpdates.description = updates.medicalNotes;
      if (updates.title) mappedUpdates.title = updates.title;
      if (updates.sharedWithParents !== undefined) mappedUpdates.shared_with_parents = updates.sharedWithParents;
      if (updates.caseId) mappedUpdates.journey_id = updates.caseId;

      if (imageFile) {
        const { url } = await babyWatchService.uploadImage(imageFile, updates.caseId || current.journey_id);
        mappedUpdates.attachments = [url];
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(mappedUpdates)
        .eq('id', id);

      if (error) throw error;

      // Shared with the parent for the first time: they haven't heard of it yet.
      if (updates.sharedWithParents === true && !current.shared_with_parents) {
        void notifyJourney(
          mappedUpdates.journey_id || current.journey_id,
          { surrogate: false, parent: true },
          updateMessage({ gestationalAge: mappedUpdates.data.gestationalAge }),
          id,
        );
      }
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
          date: u.data?.date || (u.created_at ? String(u.created_at).split('T')[0] : ''),
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


import { supabase } from '../lib/supabase';

export const STORAGE_BUCKETS = {
  USERS: 'users',
  BABY_WATCH: 'baby_watch',
  MESSAGES: 'messages',
  JOURNEYS: 'journeys',
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

export interface UploadResult {
  url: string;
  path: string;
  error?: any;
}

export const storageService = {
  /**
   * Uploads a file to a specific bucket
   */
  uploadFile: async (
    bucket: StorageBucket,
    path: string,
    file: File | Blob,
    options: { cacheControl?: string; upsert?: boolean } = { cacheControl: '3600', upsert: false }
  ): Promise<UploadResult> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, options);

      if (error) {
        if (error.message.includes('Bucket not found')) {
          console.error(`Bucket "${bucket}" not found.`);
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return {
        url: publicUrl,
        path: path,
      };
    } catch (error) {
      console.error(`Error uploading to ${bucket}:`, error);
      throw error;
    }
  },

  /**
   * Specialized helper for profile images
   */
  uploadProfileImage: async (userId: string, file: File): Promise<UploadResult> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-profile.${fileExt}`;
    const path = `${userId}/${fileName}`;

    try {
      return await storageService.uploadFile(STORAGE_BUCKETS.USERS, path, file, { upsert: true });
    } catch (error: any) {
      return { url: '', path: '', error };
    }
  },

  /**
   * Deletes a file from a specific bucket
   */
  deleteFile: async (bucket: StorageBucket, path: string): Promise<void> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting from ${bucket}:`, error);
      throw error;
    }
  },

  /**
   * Gets the public URL for a file
   */
  getPublicUrl: (bucket: StorageBucket, path: string): string => {
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return publicUrl;
  },

  /**
   * Ensures all required buckets exist
   */
  ensureBucketsExist: async () => {
    const buckets = Object.values(STORAGE_BUCKETS);
    const results = [];

    for (const bucketName of buckets) {
      try {
        const { data: bucket, error: checkError } = await supabase.storage.getBucket(bucketName);
        
        if (checkError || !bucket) {
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 1024 * 1024 * 50, // 50MB limit
          });
          
          if (createError) {
            results.push({ name: bucketName, status: 'error', error: createError });
          } else {
            results.push({ name: bucketName, status: 'created' });
          }
        } else {
          results.push({ name: bucketName, status: 'exists' });
        }
      } catch (error) {
        results.push({ name: bucketName, status: 'failed', error });
      }
    }
    return results;
  }
};

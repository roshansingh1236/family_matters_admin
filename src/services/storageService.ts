import { supabase } from '../lib/supabase';

export const STORAGE_BUCKETS = {
  USERS: 'users',
  BABY_WATCH: 'baby_watch',
  MESSAGES: 'messages',
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

export interface UploadResult {
  url: string;
  path: string;
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
        // If error is bucket not found, we might want to log it specifically
        if (error.message.includes('Bucket not found')) {
          console.error(`Bucket "${bucket}" not found. Please run the bucket initialization script.`);
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
   * Note: This usually requires more permissions than the anon key has.
   * This is best run in a setup script or via a service role.
   */
  ensureBucketsExist: async () => {
    const buckets = Object.values(STORAGE_BUCKETS);
    const results = [];

    for (const bucketName of buckets) {
      try {
        const { data: bucket, error: checkError } = await supabase.storage.getBucket(bucketName);
        
        if (checkError || !bucket) {
          console.log(`Bucket "${bucketName}" not found, attempting to create...`);
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 1024 * 1024 * 50, // 50MB limit
          });
          
          if (createError) {
            console.error(`Failed to create bucket "${bucketName}":`, createError.message);
            results.push({ name: bucketName, status: 'error', error: createError });
          } else {
            console.log(`Successfully created bucket "${bucketName}"`);
            results.push({ name: bucketName, status: 'created' });
          }
        } else {
          results.push({ name: bucketName, status: 'exists' });
        }
      } catch (error) {
        console.error(`Error checking/creating bucket "${bucketName}":`, error);
        results.push({ name: bucketName, status: 'failed', error });
      }
    }
    return results;
  }
};
                
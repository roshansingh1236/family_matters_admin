import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { STORAGE_BUCKETS } from '../src/services/storageService';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function initializeBuckets() {
  console.log('Starting bucket initialization...');
  
  const buckets = Object.values(STORAGE_BUCKETS);
  
  for (const bucketName of buckets) {
    console.log(`Checking bucket: ${bucketName}`);
    
    try {
      const { data: bucket, error: checkError } = await supabase.storage.getBucket(bucketName);
      
      if (checkError || !bucket) {
        console.log(`Bucket "${bucketName}" not found, creating...`);
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 1024 * 1024 * 50, // 50MB
        });
        
        if (createError) {
          console.error(`Error creating bucket "${bucketName}":`, createError.message);
        } else {
          console.log(`Successfully created bucket: ${bucketName}`);
        }
      } else {
        console.log(`Bucket "${bucketName}" already exists.`);
      }
    } catch (error: any) {
      console.error(`Failed to process bucket "${bucketName}":`, error.message);
    }
  }
  
  console.log('Bucket initialization complete.');
}

initializeBuckets();

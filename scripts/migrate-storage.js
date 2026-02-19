const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 1. Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});
const bucket = admin.storage().bucket();

// 2. Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateStorage() {
  console.log('--- Migrating Storage ---');
  
  try {
    const [files] = await bucket.getFiles();
    console.log(`Found ${files.length} files in Firebase Storage.`);

    for (const file of files) {
      console.log(`Processing ${file.name}...`);
      
      // Download file from Firebase
      const [buffer] = await file.download();
      
      // Determine target bucket and path in Supabase
      // Assuming a direct mapping for now, or you can customize logic here
      const targetBucket = 'documents'; // Default bucket name in Supabase
      const targetPath = file.name;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(targetBucket)
        .upload(targetPath, buffer, {
          upsert: true,
          contentType: file.metadata.contentType
        });

      if (error) {
        console.error(`Error uploading ${file.name} to Supabase:`, error.message);
      } else {
        console.log(`Successfully migrated ${file.name}`);
      }
    }
    
    console.log('Storage migration complete!');
  } catch (err) {
    console.error('Storage migration failed:', err);
  }
}

migrateStorage();

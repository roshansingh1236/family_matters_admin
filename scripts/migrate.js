const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 1. Initialize Firebase Admin
// Make sure you have your service account key saved as firebase-service-account.json
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

// 2. Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateUsers() {
  console.log('--- Migrating Users ---');
  const snapshot = await firestore.collection('users').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase
      .from('users')
      .upsert({
        id: doc.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
        status: data.status,
        profile_image_url: data.profileImageUrl,
        preferences: data.preferences || {},
        created_at: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      });
    
    if (error) console.error(`Error migrating user ${doc.id}:`, error.message);
  }
}

async function migrateMatches() {
  console.log('--- Migrating Matches ---');
  const snapshot = await firestore.collection('matches').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase
      .from('matches')
      .upsert({
        id: doc.id,
        intended_parent_id: data.intendedParentId,
        gestational_carrier_id: data.gestationalCarrierId,
        status: data.status,
        match_score: data.matchScore,
        created_at: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      });
    
    if (error) console.error(`Error migrating match ${doc.id}:`, error.message);
  }
}

async function migrateJourneys() {
  console.log('--- Migrating Journeys ---');
  const snapshot = await firestore.collection('journeys').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('journeys').upsert({
      id: doc.id,
      parent_id: data.parentId,
      surrogate_id: data.surrogate_id || data.surrogateId,
      status: data.status,
      created_at: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      updated_at: data.updatedAt ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
    });
    if (error) console.error(`Error migrating journey ${doc.id}:`, error.message);
  }
}

async function migrateTasks() {
  console.log('--- Migrating Tasks ---');
  const snapshot = await firestore.collection('tasks').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('tasks').upsert({
      id: doc.id,
      title: data.title,
      description: data.description,
      is_completed: data.isCompleted || false,
      user_id: data.assignee || data.userId,
      due_date: data.dueDate ? (data.dueDate.toDate ? data.dueDate.toDate().toISOString() : data.dueDate) : null,
      created_at: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString(),
    });
    if (error) console.error(`Error migrating task ${doc.id}:`, error.message);
  }
}

async function migrateAppointments() {
  console.log('--- Migrating Appointments ---');
  const snapshot = await firestore.collection('appointments').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('appointments').upsert({
      id: doc.id,
      title: data.title,
      date: data.date ? (data.date.toDate ? data.date.toDate().toISOString() : data.date) : null,
      time: data.time,
      type: data.type,
      location: data.location,
      notes: data.notes,
      participants: data.participants || [],
    });
    if (error) console.error(`Error migrating appointment ${doc.id}:`, error.message);
  }
}

async function migrateInvoices() {
  console.log('--- Migrating Invoices ---');
  const snapshot = await firestore.collection('invoices').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('invoices').upsert({
      id: doc.id,
      user_id: data.userId,
      amount: data.amount,
      status: data.status,
      date: data.date ? (data.date.toDate ? data.date.toDate().toISOString() : data.date) : null,
      description: data.description,
    });
    if (error) console.error(`Error migrating invoice ${doc.id}:`, error.message);
  }
}

async function migrateBabyWatch() {
  console.log('--- Migrating Baby Watch ---');
  const snapshot = await firestore.collection('baby_watch').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('baby_watch_updates').upsert({
      id: doc.id,
      journey_id: data.caseId,
      title: data.title,
      description: data.content,
      created_at: data.date ? (data.date.toDate ? data.date.toDate().toISOString() : data.date) : null,
    });
    if (error) console.error(`Error migrating baby watch ${doc.id}:`, error.message);
  }
}

async function migrateMedications() {
  console.log('--- Migrating Medications ---');
  const snapshot = await firestore.collection('medications').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('medications').upsert({
      id: doc.id,
      user_id: data.userId,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      start_date: data.startDate ? (data.startDate.toDate ? data.startDate.toDate().toISOString() : data.startDate) : null,
      end_date: data.endDate ? (data.endDate.toDate ? data.endDate.toDate().toISOString() : data.endDate) : null,
      instructions: data.instructions,
    });
    if (error) console.error(`Error migrating medication ${doc.id}:`, error.message);
  }
}

async function migrateMedicalRecords() {
  console.log('--- Migrating Medical Records ---');
  const snapshot = await firestore.collection('medical_records').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('medical_records').upsert({
      id: doc.id,
      user_id: data.userId,
      type: data.type,
      date: data.date ? (data.date.toDate ? data.date.toDate().toISOString() : data.date) : null,
      doctor: data.doctor,
      facility: data.facility,
      attachments: data.attachments || [],
      notes: data.notes,
      shared_with_parents: data.sharedWithParents || false,
    });
    if (error) console.error(`Error migrating medical record ${doc.id}:`, error.message);
  }
}

async function runMigration() {
  try {
    await migrateUsers();
    await migrateMatches();
    await migrateJourneys();
    await migrateTasks();
    await migrateAppointments();
    await migrateInvoices();
    await migrateBabyWatch();
    await migrateMedications();
    await migrateMedicalRecords();
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

runMigration();

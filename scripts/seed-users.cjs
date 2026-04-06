const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://urqkvgbiwafhsxwvjkbr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\x1b[31mError: SUPABASE_SERVICE_ROLE_KEY is missing.\x1b[0m');
  console.info('Please add it to your .env file or run with:');
  console.info('SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/seed-users.cjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Add demo users here (email, password, profile fields). Kept empty by default. */
const USERS_TO_SEED = [];

async function seedData() {
  console.log('🚀 Starting Seeding Process...');

  for (const user of USERS_TO_SEED) {
    console.log(`\n📧 Processing user: ${user.email}`);

    // 1. Create/Get Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: `${user.firstName} ${user.lastName}`,
        role: user.role
      }
    });

    let userId;
    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('ℹ️ User already exists in Auth. Fetching ID...');
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
          console.error('❌ Error listing users:', listError.message);
          continue;
        }
        const existingUser = listData.users.find(u => u.email === user.email);
        if (!existingUser) {
          console.error(`❌ Could not find user ${user.email} in list.`);
          continue;
        }
        userId = existingUser.id;
      } else {
        console.error(`❌ Error creating auth user: ${authError.message}`);
        continue;
      }
    } else {
      userId = authData.user.id;
      console.log(`✅ Auth user created: ${userId}`);
    }

// 2. Update/Insert Public Profile
    const profileUpdate = {
      id: userId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      status: user.status,
      formData: user.formData,
      about: user.about,
      updated_at: new Date().toISOString()
    };

    if (user.role === 'Surrogate') {
      profileUpdate.form2 = user.form2;
    } else {
      profileUpdate.form2Data = user.form2Data;
    }

    const { error: profileError } = await supabase
      .from('users')
      .upsert(profileUpdate);

    if (profileError) {
      console.error(`❌ Error updating public profile: ${profileError.message}`);
      continue;
    }
    console.log(`✅ Public profile updated for ${user.role}`);

    // 3. Seed Related Data
    if (user.role === 'Surrogate') {
      // Medical Record
      await supabase.from('medical_records').upsert({
        surrogate_id: userId,
        user_id: userId,
        patient_name: `${user.firstName} ${user.lastName}`,
        date: new Date().toISOString().split('T')[0],
        type: 'General Checkup',
        title: 'Initial Screening Visit',
        summary: 'Patient is in excellent health and cleared for the program.',
        provider: 'City Health Center',
        doctor: 'Dr. Emily Smith',
        facility: 'Main Clinic',
        status: 'Verified',
        shared_with_parents: true
      });
      console.log('   🏥 Medical Record seeded');

      // Medication
      await supabase.from('medications').upsert({
        surrogate_id: userId,
        user_id: userId,
        name: 'Prenatal Vitamins',
        dosage: '1 tablet',
        frequency: 'Daily',
        start_date: new Date().toISOString().split('T')[0],
        status: 'Active',
        notes: 'Standard prenatal care.'
      });
      console.log('   💊 Medication seeded');
    }

    // Payment
    await supabase.from('payments').upsert({
      surrogate_id: user.role === 'Surrogate' ? userId : null,
      parent_id: user.role === 'Intended Parent' ? userId : null,
      amount: user.role === 'Surrogate' ? 500 : 1500,
      type: user.role === 'Surrogate' ? 'Allowance' : 'Medical',
      category: user.role === 'Surrogate' ? 'Received' : 'Withdrawn',
      status: 'Pending',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: user.role === 'Surrogate' ? 'Monthly wellness allowance' : 'Initial clinic deposit'
    });
    console.log('   💰 Payment seeded');

    // Task
    await supabase.from('tasks').upsert({
      user_id: userId,
      title: user.role === 'Surrogate' ? 'Upload ID Document' : 'Review Legal Contract',
      description: 'Please complete this task by the end of the week.',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'High',
      status: 'Pending'
    });
    console.log('   ✅ Task seeded');
  }

  console.log('\n✨ Seeding Process Finished!');
}

seedData();

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

const USERS_TO_SEED = [
  {
    email: 'roshanpratap1235@gmail.com',
    password: 'Test@123',
    role: 'Intended Parent',
    firstName: 'Roshan',
    lastName: 'Pratap',
    status: 'To be Matched',
    formData: {
      firstName: 'Roshan',
      lastName: 'Pratap',
      email: 'roshanpratap1235@gmail.com',
      phoneNumber: '+91 9876543210',
      city: 'Gurgaon',
      state: 'Haryana',
      country: 'India',
      zip: '122001',
      address: 'Sector 44, Gurgaon',
      whenToStart: 'Immediately',
      preferredContactMethod: 'Email',
      whySurrogate: 'Looking to grow our family through a compassionate journey.'
    },
    form2Data: {
      fertilityClinic: 'Family Matters Wellness Center',
      embryosAvailable: '4',
      embryoQuality: 'Grade A',
      medicalHistory: 'Healthy, no major issues.',
      timeline: 'Next 6 months',
      surrogacyBudget: 'Standard',
      legalCounsel: 'Family Matters Legal Team',
      fertility: {
        clinicName: 'Wellness IVF',
        physician: 'Dr. Sharma',
        clinicContact: 'info@wellnessivf.com',
        embryoReport: 'Pending',
        geneticTesting: 'Completed'
      }
    },
    about: {
      bio: 'We are a loving couple based in Gurgaon, eager to start our family journey. We value transparency and open communication.',
      age: '34',
      aboutUs: 'Enthusiastic travelers and home cooks.',
      relationshipPreference: 'Close and supportive',
      familyLifestyle: 'Active and social',
      occupation: 'Tech Consultant',
      education: 'MBA',
      heritage: 'Indian',
      religion: 'Hindu',
      hobbies: 'Cooking, Hiking'
    }
  },
  {
    email: 'roshansingh1235@gmail.com',
    password: 'Test@123',
    role: 'Surrogate',
    firstName: 'Roshan',
    lastName: 'Singh',
    status: 'Available',
    formData: {
      firstName: 'Roshan',
      lastName: 'Singh',
      email: 'roshansingh1235@gmail.com',
      phoneNumber: '+91 8888888888',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      zip: '110001',
      address: 'Connaught Place, Delhi',
      whenToStart: 'Next Month',
      preferredContactMethod: 'WhatsApp'
    },
    form2: {
      availability: 'Ready to match',
      pregnancyHistory: {
        total: '2',
        vaginal: '2',
        cSection: '0'
      },
      surrogacyChildren: '0',
      bmi: '22.5',
      smoker: false,
      medications: 'None',
      supportSystem: 'Husband and parents',
      medicalFitness: {
        gynecologicalExam: 'Normal',
        obstetricHistory: 'Unremarkable',
        bmi: '22.5',
        bp: '120/80',
        generalHealthClearance: 'Cleared'
      }
    },
    about: {
      bioMotherHeritage: 'Indian',
      bioFatherHeritage: 'Indian',
      education: 'Graduate',
      occupation: 'Teacher',
      age: '29',
      height: '5\'6"',
      relationshipPreference: 'Friendly',
      amhStatus: 'Good',
      opennessToSecondCycle: 'Yes',
      bio: 'I want to help others experience the joy of parenthood. I have two healthy children of my own and a supportive family.'
    }
  }
];

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

  // 4. Create a Proposed Match
  const parentEmail = 'roshanpratap1235@gmail.com';
  const surrogateEmail = 'roshansingh1235@gmail.com';
  
  const { data: users } = await supabase.from('users').select('id, email');
  const parentId = users.find(u => u.email === parentEmail)?.id;
  const surrogateId = users.find(u => u.email === surrogateEmail)?.id;

  if (parentId && surrogateId) {
    await supabase.from('matches').upsert({
      intended_parent_id: parentId,
      gestational_carrier_id: surrogateId,
      status: 'Proposed',
      match_score: 95,
      agency_notes: 'Strong alignment on communication and expectations.'
    });
    console.log('\n🤝 Proposed Match created between Parent and Surrogate');
  }

  console.log('\n✨ Seeding Process Finished!');
}

seedData();

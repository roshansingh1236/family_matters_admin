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

/**
 * Sample demo users used for reviewer walkthroughs.
 *
 * The admin profile pages read data using snake_case columns (form_data,
 * form2_data, profile_completed, etc.) so fixtures MUST use snake_case too
 * — see ParentProfileContent.tsx / SurrogateProfileContent.tsx.
 *
 * Each entry is a complete user ready to render every tab:
 *   Overview, About, Personal, Medical Report, Medical, Intake, Documents.
 */
const USERS_TO_SEED = [
  // ─────────────────────────────────────────────────────────────
  // INTENDED PARENT #1 – complete, accepted to program
  // ─────────────────────────────────────────────────────────────
  {
    email: 'ip.sample1@familymatters.test',
    password: 'Sample1234!',
    firstName: 'Olivia',
    lastName: 'Harrington',
    role: 'Intended Parent',
    status: 'Accepted to Program',
    profileCompleted: true,
    form2Completed: true,
    agencyApproved: true,
    phone: '+1 415-555-0187',
    form_data: {
      firstName: 'Olivia',
      lastName: 'Harrington',
      phone: '+1 415-555-0187',
      city: 'San Francisco',
      state: 'CA',
      country: 'United States',
      whenToStart: 'Ready to begin within 3 months',
      message: 'We have been dreaming about growing our family for years and cannot wait to share this journey with a surrogate.',
      whySurrogate: 'After two failed IVF cycles our physician recommended surrogacy as the safest path forward.',
      relationshipType: 'Open, ongoing relationship with regular updates',
      parent1: {
        name: 'Olivia Harrington',
        dob: '1987-05-14',
        age: '38',
        occupation: 'Product Marketing Director',
        education: 'MBA, Stanford Graduate School of Business',
        religion: 'Non-denominational Christian',
        ethnicity: 'Caucasian',
        hobbiesInterests: 'Trail running, baking sourdough, classical piano',
        personalityDescription: 'Warm, organized, a bit of a planner — I like to think through every detail so our surrogate feels supported.',
        aboutYourself: 'I grew up in Colorado, moved to the Bay Area in my twenties, and have spent the past decade building consumer tech products. Family is everything to me.',
        phone: '+1 415-555-0187',
      },
      parent2: {
        name: 'Daniel Harrington',
        dob: '1985-11-02',
        age: '40',
        occupation: 'Civil Engineer',
        education: 'M.S. Civil Engineering, UC Berkeley',
        religion: 'Non-denominational Christian',
        ethnicity: 'Caucasian',
        hobbiesInterests: 'Cycling, woodworking, cooking',
        personalityDescription: 'Easygoing, hands-on, loves building things — the kind of dad who will have the nursery built six months before the due date.',
        aboutYourself: 'Born and raised in Portland. I spend my weekends on my bike or tinkering in the garage. I cannot wait to become a father.',
        phone: '+1 415-555-0188',
      },
      surrogate_related: {
        pregnancyRelationship: 'We want an open, warm relationship during pregnancy and beyond — texts, video calls, and visits when possible.',
        additionalInfoForSurrogate: 'We are happy to cover doula services, maternity photography, and anything else that helps our surrogate feel cared for.',
        preferenceNonSmoker: 'Required',
        preferenceDrugFree: 'Required',
        vaccinationPreference: 'Up to date on routine vaccinations',
        terminationViews: 'Will follow medical advice of the treating OB',
        twinPreference: 'Open to single or twins',
      },
      fertility: {
        embryoCount: '4 frozen blastocysts (PGT-normal)',
        geneticTesting: 'PGT-A performed',
        eggSource: 'Intended mother',
        spermSource: 'Intended father',
        clinicName: 'Pacific Coast Fertility',
        clinicCity: 'San Francisco, CA',
        reproductiveEndocrinologist: 'Dr. Marcus Chen',
        transferTiming: 'Ready to schedule as soon as surrogate is cleared',
      },
      medical_reports: {
        ivfCycles: '2',
        lastCycleDate: '2025-11-12',
        infectiousDiseaseScreeningDate: '2026-02-03',
        fdaScreeningComplete: true,
        notes: 'All FDA screening current. Embryology report on file.',
      },
    },
    form2_data: {
      infectiousDisease: {
        hiv: 'Negative',
        hepatitisB: 'Negative',
        hepatitisC: 'Negative',
        syphilis: 'Negative',
        cmv: 'IgG+',
        screeningDate: '2026-02-03',
        clinic: 'Pacific Coast Fertility',
      },
      embryoRecords: {
        totalEmbryos: 4,
        pgtTested: true,
        pgtNormal: 3,
        pgtMosaic: 1,
        storageFacility: 'Pacific Coast Fertility Cryobank',
        embryoGrades: '4AA, 4AB, 3AA, 4BA',
      },
    },
    about: {
      bio: 'Olivia and Daniel Harrington are first-time parents based in San Francisco, ready to welcome their first child after a long fertility journey.',
      aboutUs: 'We value transparency, kindness, and gratitude — and we promise the same in return.',
      relationshipPreference: 'Open & ongoing',
      occupation: 'Product Marketing Director & Civil Engineer',
      education: 'MBA & M.S. Engineering',
      hobbies: 'Running, baking, cycling, woodworking',
      religion: 'Non-denominational Christian',
      familyLifestyle: 'Active, outdoorsy, close-knit extended family',
      age: '38 & 40',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // INTENDED PARENT #2 – single parent, intake in progress
  // ─────────────────────────────────────────────────────────────
  {
    email: 'ip.sample2@familymatters.test',
    password: 'Sample1234!',
    firstName: 'Raj',
    lastName: 'Patel',
    role: 'Intended Parent',
    status: 'Intake in Progress',
    profileCompleted: true,
    form2Completed: false,
    agencyApproved: false,
    phone: '+1 212-555-0164',
    form_data: {
      firstName: 'Raj',
      lastName: 'Patel',
      phone: '+1 212-555-0164',
      city: 'New York',
      state: 'NY',
      country: 'United States',
      whenToStart: 'Flexible — within the next 6–12 months',
      message: 'I am pursuing single-parent surrogacy and hoping to find a surrogate who is excited to be part of a non-traditional family.',
      whySurrogate: 'As a single man I have always wanted to be a father, and surrogacy is the most fulfilling path I can imagine.',
      relationshipType: 'Semi-open — quarterly updates, occasional visits',
      parent1: {
        name: 'Raj Patel',
        dob: '1983-08-21',
        age: '42',
        occupation: 'Pediatric Neurologist',
        education: 'M.D., Johns Hopkins School of Medicine',
        religion: 'Hindu',
        ethnicity: 'South Asian (Indian)',
        hobbiesInterests: 'Squash, chess, traveling, collecting vintage maps',
        personalityDescription: 'Calm, curious, deeply devoted to family — the kind of person who takes notes in every parenting book.',
        aboutYourself: 'I was born in Ahmedabad, moved to the US for medical school, and have practiced pediatric neurology in Manhattan for the last twelve years.',
        phone: '+1 212-555-0164',
      },
      parent2: null,
      surrogate_related: {
        pregnancyRelationship: 'Would love regular text updates and occasional in-person visits around key milestones.',
        additionalInfoForSurrogate: 'I am a pediatric physician and I deeply respect the autonomy of the surrogate throughout the pregnancy.',
        preferenceNonSmoker: 'Required',
        preferenceDrugFree: 'Required',
        vaccinationPreference: 'Standard schedule preferred',
        twinPreference: 'Single transfer preferred',
      },
      fertility: {
        embryoCount: '2 frozen blastocysts',
        geneticTesting: 'PGT-A performed',
        eggSource: 'Known egg donor',
        spermSource: 'Intended father',
        clinicName: 'Weill Cornell Reproductive Medicine',
        clinicCity: 'New York, NY',
        reproductiveEndocrinologist: 'Dr. Priya Sharma',
      },
      medical_reports: {
        ivfCycles: '1',
        lastCycleDate: '2025-09-04',
        infectiousDiseaseScreeningDate: '2026-01-15',
        fdaScreeningComplete: true,
        notes: 'Single-parent program. Donor egg + intended father sperm.',
      },
    },
    form2_data: {
      infectiousDisease: {
        hiv: 'Negative',
        hepatitisB: 'Negative',
        hepatitisC: 'Negative',
        syphilis: 'Negative',
        cmv: 'IgG−',
        screeningDate: '2026-01-15',
        clinic: 'Weill Cornell Reproductive Medicine',
      },
      embryoRecords: {
        totalEmbryos: 2,
        pgtTested: true,
        pgtNormal: 2,
        storageFacility: 'Weill Cornell Cryobank',
        embryoGrades: '5AA, 4AB',
      },
    },
    about: {
      bio: 'Raj is a pediatric neurologist in New York beginning his journey toward single fatherhood.',
      aboutUs: 'I am committed to open, honest communication and to making sure our surrogate feels cared for at every step.',
      relationshipPreference: 'Semi-open',
      occupation: 'Pediatric Neurologist',
      education: 'M.D.',
      hobbies: 'Squash, chess, travel',
      religion: 'Hindu',
      familyLifestyle: 'Quiet, thoughtful, extended family deeply involved',
      age: '42',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SURROGATE #1 – experienced, medically cleared
  // ─────────────────────────────────────────────────────────────
  {
    email: 'gc.sample1@familymatters.test',
    password: 'Sample1234!',
    firstName: 'Mia',
    lastName: 'Johnson',
    role: 'Surrogate',
    status: 'Accepted to Program',
    profileCompleted: true,
    form2Completed: true,
    agencyApproved: true,
    medicalScreeningStatus: 'Medically Cleared for Program',
    phone: '+1 512-555-0142',
    form_data: {
      firstName: 'Mia',
      lastName: 'Johnson',
      phone: '+1 512-555-0142',
      city: 'Austin',
      state: 'TX',
      country: 'United States',
      dateOfBirth: '1990-03-27',
      height: '5\'6"',
      ethnicity: 'Caucasian',
      educationLevel: 'Bachelor\'s Degree – Nursing',
      occupation: 'Pediatric Nurse',
      relationshipStatus: 'Married',
      messageToParents: 'I became a surrogate because I loved being pregnant and cannot imagine a greater gift than helping another family. I am so excited to meet you.',
      surrogacyReasons: 'My sister struggled with infertility for years. Watching her journey made me want to give that joy to another family.',
      surrogate_profile: {
        // Core profile
        age: '35',
        height: '5\'6"',
        weight: '142',
        bmi: '22.9',
        ethnicity: 'Caucasian',
        educationLevel: 'Bachelor\'s Degree – Nursing',
        occupation: 'Pediatric Nurse',
        relationshipStatus: 'Married',
        partnerOccupation: 'Firefighter',
        numberOfChildren: '2',
        surrogacyReasons: 'Wanted to give another family the joy my sister finally received after years of infertility.',
        messageToParents: 'I am honest, kind, and fully committed. I would love to build a relationship with you throughout the journey.',
        availability: 'Available immediately',
        surrogacyChildren: '1',

        // Pregnancy history (3 slots — renders in OB History table)
        pregnancy1Name: 'Emma Johnson',
        pregnancy1DOB: '2015-07-12',
        pregnancy1Gender: 'Female',
        pregnancy1Weight: '7 lbs 4 oz',
        pregnancy1Delivery: 'Vaginal',
        pregnancy1GestationalAge: '39w 2d',
        pregnancy1Complications: 'None',
        pregnancy1OBGYN: 'Dr. Sarah Williams',
        pregnancy1Hospital: 'St. David\'s Medical Center, Austin TX',
        pregnancy2Name: 'Liam Johnson',
        pregnancy2DOB: '2018-02-04',
        pregnancy2Gender: 'Male',
        pregnancy2Weight: '8 lbs 1 oz',
        pregnancy2Delivery: 'Vaginal',
        pregnancy2GestationalAge: '40w 0d',
        pregnancy2Complications: 'None',
        pregnancy2OBGYN: 'Dr. Sarah Williams',
        pregnancy2Hospital: 'St. David\'s Medical Center, Austin TX',
        pregnancy2Surrogacy: 'No',
        pregnancy3Name: 'Surrogate baby (Meyer family)',
        pregnancy3DOB: '2023-05-18',
        pregnancy3Gender: 'Female',
        pregnancy3Weight: '6 lbs 14 oz',
        pregnancy3Delivery: 'Vaginal',
        pregnancy3GestationalAge: '38w 5d',
        pregnancy3Complications: 'None',
        pregnancy3OBGYN: 'Dr. Angela Martinez',
        pregnancy3Hospital: 'Seton Medical Center, Austin TX',
        pregnancy3Surrogacy: 'Yes',

        pregnancyHistory: { total: '3' },
        additionalPregnancyInfo: 'All three pregnancies were uncomplicated, full-term vaginal deliveries with no postpartum concerns.',

        // Medical fitness fields
        medicalFitness: {
          bmi: '22.9',
          smoker: 'Never',
          alcohol: 'Occasional (1–2 drinks per month)',
          substances: 'None',
          medications: 'Prenatal vitamins only',
          chronicConditions: 'None',
          allergies: 'Penicillin',
          mentalHealthHistory: 'None',
        },
        infectiousDisease: {
          hiv: 'Negative',
          hepatitisB: 'Negative',
          hepatitisC: 'Negative',
          syphilis: 'Negative',
          gonorrhea: 'Negative',
          chlamydia: 'Negative',
          screeningDate: '2026-03-12',
        },
        psychClearance: {
          evaluator: 'Dr. Rebecca Holt, LCSW',
          evaluationDate: '2026-03-18',
          outcome: 'Cleared',
          notes: 'Excellent support system. Strong motivation. No contraindications identified.',
        },
      },
    },
    form2_data: {
      availability: 'Available immediately',
      surrogacyChildren: '1',
      compensationBase: 55000,
      insuranceCoverage: 'Lifetime policy through employer',
      partnerSupport: 'Fully supportive',
      supportNetwork: 'Husband, mother, and two close friends live within 10 miles.',
      travelAvailability: 'Able to travel for matched clinic if needed',
    },
    about: {
      bio: 'Mia is a pediatric nurse and experienced second-time surrogate based in Austin, Texas. She has two children of her own and delivered a surrogate baby in 2023.',
      age: '35',
      height: '5\'6"',
      education: 'Bachelor\'s Degree – Nursing',
      occupation: 'Pediatric Nurse',
      relationshipPreference: 'Married',
      bioMotherHeritage: 'Caucasian (Irish/German)',
      bioFatherHeritage: 'Caucasian (Scottish)',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SURROGATE #2 – first-time, in medical screening
  // ─────────────────────────────────────────────────────────────
  {
    email: 'gc.sample2@familymatters.test',
    password: 'Sample1234!',
    firstName: 'Sofia',
    lastName: 'Ramirez',
    role: 'Surrogate',
    status: 'Background Check in Progress',
    profileCompleted: true,
    form2Completed: true,
    agencyApproved: false,
    medicalScreeningStatus: 'In Progress',
    phone: '+1 303-555-0199',
    form_data: {
      firstName: 'Sofia',
      lastName: 'Ramirez',
      phone: '+1 303-555-0199',
      city: 'Denver',
      state: 'CO',
      country: 'United States',
      dateOfBirth: '1993-11-09',
      height: '5\'4"',
      ethnicity: 'Hispanic / Latina',
      educationLevel: 'Associate\'s Degree – Early Childhood Education',
      occupation: 'Preschool Teacher',
      relationshipStatus: 'Partnered',
      messageToParents: 'I am so excited to start this journey. My own family is complete and I want to help bring joy to another family the way mine has brought me.',
      surrogacyReasons: 'I have always felt that pregnancy and childbirth are something I am truly good at, and I want to share that gift.',
      surrogate_profile: {
        age: '32',
        height: '5\'4"',
        weight: '135',
        bmi: '23.2',
        ethnicity: 'Hispanic / Latina',
        educationLevel: 'Associate\'s Degree – Early Childhood Education',
        occupation: 'Preschool Teacher',
        relationshipStatus: 'Partnered',
        partnerOccupation: 'Electrician',
        numberOfChildren: '2',
        surrogacyReasons: 'My own pregnancies were easy and joyful, and I want to give that gift to another family.',
        messageToParents: 'I am a planner, a warm communicator, and I treat pregnancy as something sacred. I would love to match with parents who feel the same.',
        availability: 'Available in 60 days',
        surrogacyChildren: '0',

        pregnancy1Name: 'Lucas Ramirez',
        pregnancy1DOB: '2017-04-22',
        pregnancy1Gender: 'Male',
        pregnancy1Weight: '7 lbs 9 oz',
        pregnancy1Delivery: 'Vaginal',
        pregnancy1GestationalAge: '39w 4d',
        pregnancy1Complications: 'None',
        pregnancy1OBGYN: 'Dr. Marcus Lee',
        pregnancy1Hospital: 'Rose Medical Center, Denver CO',
        pregnancy2Name: 'Isabella Ramirez',
        pregnancy2DOB: '2020-09-15',
        pregnancy2Gender: 'Female',
        pregnancy2Weight: '6 lbs 15 oz',
        pregnancy2Delivery: 'Vaginal',
        pregnancy2GestationalAge: '38w 6d',
        pregnancy2Complications: 'Mild gestational hypertension (resolved postpartum)',
        pregnancy2OBGYN: 'Dr. Marcus Lee',
        pregnancy2Hospital: 'Rose Medical Center, Denver CO',
        pregnancy2Surrogacy: 'No',

        pregnancyHistory: { total: '2' },
        additionalPregnancyInfo: 'Both pregnancies full-term, vaginal deliveries. Minor gestational hypertension with second pregnancy — resolved after delivery and has not recurred.',

        medicalFitness: {
          bmi: '23.2',
          smoker: 'Never',
          alcohol: 'None',
          substances: 'None',
          medications: 'Prenatal vitamins, multivitamin',
          chronicConditions: 'None',
          allergies: 'Seasonal allergies',
          mentalHealthHistory: 'Mild postpartum anxiety after first pregnancy — resolved with counseling; not currently in treatment.',
        },
        infectiousDisease: {
          hiv: 'Negative',
          hepatitisB: 'Negative',
          hepatitisC: 'Negative',
          syphilis: 'Negative',
          gonorrhea: 'Negative',
          chlamydia: 'Negative',
          screeningDate: '2026-04-02',
        },
        psychClearance: {
          evaluator: 'Dr. Anna Kim, PsyD',
          evaluationDate: '2026-04-09',
          outcome: 'Pending follow-up',
          notes: 'Scheduled follow-up on 2026-04-28 to review postpartum anxiety history.',
        },
      },
    },
    form2_data: {
      availability: 'Available in 60 days',
      surrogacyChildren: '0',
      compensationBase: 45000,
      insuranceCoverage: 'Partner\'s employer plan — covers surrogacy',
      partnerSupport: 'Fully supportive',
      supportNetwork: 'Partner, mother, and sister all live in the Denver metro area.',
      travelAvailability: 'Preferred within Colorado; open to short trips',
    },
    about: {
      bio: 'Sofia is a first-time surrogate and preschool teacher in Denver with two children of her own.',
      age: '32',
      height: '5\'4"',
      education: 'Associate\'s Degree',
      occupation: 'Preschool Teacher',
      relationshipPreference: 'Partnered',
      bioMotherHeritage: 'Mexican',
      bioFatherHeritage: 'Mexican / Spanish',
    },
  },
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

    // 2. Update/Insert Public Profile — use snake_case columns so
    //    ParentProfileContent / SurrogateProfileContent can read the data.
    const nowIso = new Date().toISOString();
    const profileUpdate = {
      id: userId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      status: user.status,
      phone: user.phone ?? null,
      profile_completed: user.profileCompleted ?? false,
      profile_completed_at: user.profileCompleted ? nowIso : null,
      form_2_completed: user.form2Completed ?? false,
      form_2_completed_at: user.form2Completed ? nowIso : null,
      agency_approved: user.agencyApproved ?? false,
      form_data: user.form_data ?? {},
      form2_data: user.form2_data ?? null,
      about: user.about ?? null,
      source: 'seed',
      updated_at: nowIso,
    };

    if (user.role === 'Surrogate' && user.medicalScreeningStatus) {
      profileUpdate.medical_screening_status = user.medicalScreeningStatus;
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

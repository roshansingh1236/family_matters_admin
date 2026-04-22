-- Seed 4 sample users (2 Intended Parents, 2 Surrogates) for reviewer walkthroughs.
--
-- Run directly in the Supabase SQL Editor. Idempotent: re-running updates the
-- existing rows rather than duplicating them.
--
-- Password for all four users: Sample1234!
--
-- Schema-cautious version:
--   * Only writes columns the admin code reliably depends on — first_name,
--     last_name, email, role, status, phone, profile_completed, form_data,
--     about — plus a few newer ones guarded by env (agency_approved,
--     medical_screening_status, form_2_completed_at, profile_completed_at).
--   * `form2_data` is NOT written; admin-only subsections (infectious disease,
--     embryo records, gc_additional) are nested inside form_data so the
--     profile views can still find them through their fallback paths.

DO $$
DECLARE
  ip1_id uuid := '11111111-1111-1111-1111-000000000001';
  ip2_id uuid := '11111111-1111-1111-1111-000000000002';
  gc1_id uuid := '22222222-2222-2222-2222-000000000001';
  gc2_id uuid := '22222222-2222-2222-2222-000000000002';
  password_hash text := crypt('Sample1234!', gen_salt('bf'));
BEGIN
  ----------------------------------------------------------------------
  -- 1. Auth users
  ----------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES
    (ip1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ip.sample1@familymatters.test', password_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Olivia Harrington","role":"Intended Parent"}'::jsonb,
     now(), now(), '', '', '', ''),
    (ip2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ip.sample2@familymatters.test', password_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Raj Patel","role":"Intended Parent"}'::jsonb,
     now(), now(), '', '', '', ''),
    (gc1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'gc.sample1@familymatters.test', password_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Mia Johnson","role":"Surrogate"}'::jsonb,
     now(), now(), '', '', '', ''),
    (gc2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'gc.sample2@familymatters.test', password_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Sofia Ramirez","role":"Surrogate"}'::jsonb,
     now(), now(), '', '', '', '')
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  ----------------------------------------------------------------------
  -- 2. Auth identities (email provider)
  ----------------------------------------------------------------------
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES
    (ip1_id, ip1_id, ip1_id::text, 'email',
     jsonb_build_object('sub', ip1_id::text, 'email', 'ip.sample1@familymatters.test', 'email_verified', true),
     now(), now(), now()),
    (ip2_id, ip2_id, ip2_id::text, 'email',
     jsonb_build_object('sub', ip2_id::text, 'email', 'ip.sample2@familymatters.test', 'email_verified', true),
     now(), now(), now()),
    (gc1_id, gc1_id, gc1_id::text, 'email',
     jsonb_build_object('sub', gc1_id::text, 'email', 'gc.sample1@familymatters.test', 'email_verified', true),
     now(), now(), now()),
    (gc2_id, gc2_id, gc2_id::text, 'email',
     jsonb_build_object('sub', gc2_id::text, 'email', 'gc.sample2@familymatters.test', 'email_verified', true),
     now(), now(), now())
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  ----------------------------------------------------------------------
  -- 3. Public user profiles (minimal column set)
  ----------------------------------------------------------------------

  -- Intended Parent #1: Olivia & Daniel Harrington (complete, accepted)
  INSERT INTO public.users (
    id, email, first_name, last_name, role, status,
    profile_completed,
    form_data,
    created_at, updated_at
  ) VALUES (
    ip1_id, 'ip.sample1@familymatters.test', 'Olivia', 'Harrington',
    'Intended Parent', 'Accepted to Program',
    true,
    $json$
    {
      "firstName": "Olivia", "lastName": "Harrington", "phone": "+1 415-555-0187",
      "city": "San Francisco", "state": "CA", "country": "United States",
      "whenToStart": "Ready to begin within 3 months",
      "message": "We have been dreaming about growing our family for years and cannot wait to share this journey with a surrogate.",
      "whySurrogate": "After two failed IVF cycles our physician recommended surrogacy as the safest path forward.",
      "relationshipType": "Open, ongoing relationship with regular updates",
      "parent1": {
        "name": "Olivia Harrington", "dob": "1987-05-14", "age": "38",
        "occupation": "Product Marketing Director",
        "education": "MBA, Stanford Graduate School of Business",
        "religion": "Non-denominational Christian", "ethnicity": "Caucasian",
        "hobbiesInterests": "Trail running, baking sourdough, classical piano",
        "personalityDescription": "Warm, organized, a planner — likes to think through every detail so our surrogate feels supported.",
        "aboutYourself": "I grew up in Colorado, moved to the Bay Area in my twenties, and have spent the past decade building consumer tech products.",
        "phone": "+1 415-555-0187"
      },
      "parent2": {
        "name": "Daniel Harrington", "dob": "1985-11-02", "age": "40",
        "occupation": "Civil Engineer",
        "education": "M.S. Civil Engineering, UC Berkeley",
        "religion": "Non-denominational Christian", "ethnicity": "Caucasian",
        "hobbiesInterests": "Cycling, woodworking, cooking",
        "personalityDescription": "Easygoing, hands-on, loves building things — the kind of dad who will have the nursery built six months early.",
        "aboutYourself": "Born and raised in Portland. I spend weekends on my bike or tinkering in the garage. I cannot wait to become a father.",
        "phone": "+1 415-555-0188"
      },
      "surrogate_related": {
        "pregnancyRelationship": "We want an open, warm relationship during pregnancy and beyond — texts, video calls, and visits when possible.",
        "additionalInfoForSurrogate": "We are happy to cover doula services, maternity photography, and anything else that helps our surrogate feel cared for.",
        "preferenceNonSmoker": "Required", "preferenceDrugFree": "Required",
        "vaccinationPreference": "Up to date on routine vaccinations",
        "terminationViews": "Will follow medical advice of the treating OB",
        "twinPreference": "Open to single or twins"
      },
      "fertility": {
        "embryoCount": "4 frozen blastocysts (PGT-normal)",
        "geneticTesting": "PGT-A performed",
        "eggSource": "Intended mother", "spermSource": "Intended father",
        "clinicName": "Pacific Coast Fertility", "clinicCity": "San Francisco, CA",
        "reproductiveEndocrinologist": "Dr. Marcus Chen",
        "transferTiming": "Ready to schedule as soon as surrogate is cleared"
      },
      "medical_reports": {
        "ivfCycles": "2", "lastCycleDate": "2025-11-12",
        "infectiousDiseaseScreeningDate": "2026-02-03",
        "fdaScreeningComplete": true,
        "notes": "All FDA screening current. Embryology report on file."
      },
      "about": {
        "bio": "Olivia and Daniel Harrington are first-time parents based in San Francisco, ready to welcome their first child after a long fertility journey.",
        "aboutUs": "We value transparency, kindness, and gratitude — and we promise the same in return.",
        "relationshipPreference": "Open & ongoing",
        "occupation": "Product Marketing Director & Civil Engineer",
        "education": "MBA & M.S. Engineering",
        "hobbies": "Running, baking, cycling, woodworking",
        "religion": "Non-denominational Christian",
        "familyLifestyle": "Active, outdoorsy, close-knit extended family",
        "age": "38 & 40"
      }
    }
    $json$::jsonb,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    role = EXCLUDED.role, status = EXCLUDED.status,
    profile_completed = EXCLUDED.profile_completed,
    form_data = EXCLUDED.form_data,
    updated_at = now();

  -- Intended Parent #2: Raj Patel (single parent, intake in progress)
  INSERT INTO public.users (
    id, email, first_name, last_name, role, status,
    profile_completed,
    form_data,
    created_at, updated_at
  ) VALUES (
    ip2_id, 'ip.sample2@familymatters.test', 'Raj', 'Patel',
    'Intended Parent', 'Intake in Progress',
    true,
    $json$
    {
      "firstName": "Raj", "lastName": "Patel", "phone": "+1 212-555-0164",
      "city": "New York", "state": "NY", "country": "United States",
      "whenToStart": "Flexible — within the next 6–12 months",
      "message": "I am pursuing single-parent surrogacy and hoping to find a surrogate who is excited to be part of a non-traditional family.",
      "whySurrogate": "As a single man I have always wanted to be a father, and surrogacy is the most fulfilling path I can imagine.",
      "relationshipType": "Semi-open — quarterly updates, occasional visits",
      "parent1": {
        "name": "Raj Patel", "dob": "1983-08-21", "age": "42",
        "occupation": "Pediatric Neurologist",
        "education": "M.D., Johns Hopkins School of Medicine",
        "religion": "Hindu", "ethnicity": "South Asian (Indian)",
        "hobbiesInterests": "Squash, chess, traveling, collecting vintage maps",
        "personalityDescription": "Calm, curious, deeply devoted to family — takes notes in every parenting book.",
        "aboutYourself": "Born in Ahmedabad, moved to the US for medical school, and have practiced pediatric neurology in Manhattan for twelve years.",
        "phone": "+1 212-555-0164"
      },
      "parent2": null,
      "surrogate_related": {
        "pregnancyRelationship": "Would love regular text updates and occasional in-person visits around key milestones.",
        "additionalInfoForSurrogate": "I am a pediatric physician and I deeply respect the autonomy of the surrogate throughout the pregnancy.",
        "preferenceNonSmoker": "Required", "preferenceDrugFree": "Required",
        "vaccinationPreference": "Standard schedule preferred",
        "twinPreference": "Single transfer preferred"
      },
      "fertility": {
        "embryoCount": "2 frozen blastocysts",
        "geneticTesting": "PGT-A performed",
        "eggSource": "Known egg donor", "spermSource": "Intended father",
        "clinicName": "Weill Cornell Reproductive Medicine", "clinicCity": "New York, NY",
        "reproductiveEndocrinologist": "Dr. Priya Sharma"
      },
      "medical_reports": {
        "ivfCycles": "1", "lastCycleDate": "2025-09-04",
        "infectiousDiseaseScreeningDate": "2026-01-15",
        "fdaScreeningComplete": true,
        "notes": "Single-parent program. Donor egg + intended father sperm."
      },
      "about": {
        "bio": "Raj is a pediatric neurologist in New York beginning his journey toward single fatherhood.",
        "aboutUs": "I am committed to open, honest communication and to making sure our surrogate feels cared for at every step.",
        "relationshipPreference": "Semi-open",
        "occupation": "Pediatric Neurologist", "education": "M.D.",
        "hobbies": "Squash, chess, travel", "religion": "Hindu",
        "familyLifestyle": "Quiet, thoughtful, extended family deeply involved",
        "age": "42"
      }
    }
    $json$::jsonb,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    role = EXCLUDED.role, status = EXCLUDED.status,
    profile_completed = EXCLUDED.profile_completed,
    form_data = EXCLUDED.form_data,
    updated_at = now();

  -- Surrogate #1: Mia Johnson (experienced, medically cleared)
  INSERT INTO public.users (
    id, email, first_name, last_name, role, status,
    profile_completed,
    form_data,
    created_at, updated_at
  ) VALUES (
    gc1_id, 'gc.sample1@familymatters.test', 'Mia', 'Johnson',
    'Surrogate', 'Accepted to Program',
    true,
    $json$
    {
      "firstName": "Mia", "lastName": "Johnson", "phone": "+1 512-555-0142",
      "city": "Austin", "state": "TX", "country": "United States",
      "dateOfBirth": "1990-03-27", "height": "5'6\"",
      "ethnicity": "Caucasian",
      "educationLevel": "Bachelor's Degree – Nursing",
      "occupation": "Pediatric Nurse", "relationshipStatus": "Married",
      "messageToParents": "I became a surrogate because I loved being pregnant and cannot imagine a greater gift than helping another family. I am so excited to meet you.",
      "surrogacyReasons": "My sister struggled with infertility for years. Watching her journey made me want to give that joy to another family.",
      "surrogate_profile": {
        "age": "35", "height": "5'6\"", "weight": "142", "bmi": "22.9",
        "ethnicity": "Caucasian",
        "educationLevel": "Bachelor's Degree – Nursing",
        "occupation": "Pediatric Nurse", "relationshipStatus": "Married",
        "partnerOccupation": "Firefighter", "numberOfChildren": "2",
        "surrogacyReasons": "Wanted to give another family the joy my sister finally received after years of infertility.",
        "messageToParents": "I am honest, kind, and fully committed. I would love to build a relationship with you throughout the journey.",
        "availability": "Available immediately", "surrogacyChildren": "1",
        "pregnancy1Name": "Emma Johnson", "pregnancy1DOB": "2015-07-12",
        "pregnancy1Gender": "Female", "pregnancy1Weight": "7 lbs 4 oz",
        "pregnancy1Delivery": "Vaginal", "pregnancy1GestationalAge": "39w 2d",
        "pregnancy1Complications": "None",
        "pregnancy1OBGYN": "Dr. Sarah Williams",
        "pregnancy1Hospital": "St. David's Medical Center, Austin TX",
        "pregnancy2Name": "Liam Johnson", "pregnancy2DOB": "2018-02-04",
        "pregnancy2Gender": "Male", "pregnancy2Weight": "8 lbs 1 oz",
        "pregnancy2Delivery": "Vaginal", "pregnancy2GestationalAge": "40w 0d",
        "pregnancy2Complications": "None",
        "pregnancy2OBGYN": "Dr. Sarah Williams",
        "pregnancy2Hospital": "St. David's Medical Center, Austin TX",
        "pregnancy2Surrogacy": "No",
        "pregnancy3Name": "Surrogate baby (Meyer family)",
        "pregnancy3DOB": "2023-05-18", "pregnancy3Gender": "Female",
        "pregnancy3Weight": "6 lbs 14 oz", "pregnancy3Delivery": "Vaginal",
        "pregnancy3GestationalAge": "38w 5d", "pregnancy3Complications": "None",
        "pregnancy3OBGYN": "Dr. Angela Martinez",
        "pregnancy3Hospital": "Seton Medical Center, Austin TX",
        "pregnancy3Surrogacy": "Yes",
        "pregnancyHistory": { "total": "3" },
        "additionalPregnancyInfo": "All three pregnancies were uncomplicated, full-term vaginal deliveries with no postpartum concerns.",
        "medicalFitness": {
          "bmi": "22.9", "smoker": "Never",
          "alcohol": "Occasional (1–2 drinks per month)",
          "substances": "None", "medications": "Prenatal vitamins only",
          "chronicConditions": "None", "allergies": "Penicillin",
          "mentalHealthHistory": "None"
        },
        "infectiousDisease": {
          "hiv": "Negative", "hepatitisB": "Negative", "hepatitisC": "Negative",
          "syphilis": "Negative", "gonorrhea": "Negative", "chlamydia": "Negative",
          "screeningDate": "2026-03-12"
        },
        "psychClearance": {
          "evaluator": "Dr. Rebecca Holt, LCSW",
          "evaluationDate": "2026-03-18", "outcome": "Cleared",
          "notes": "Excellent support system. Strong motivation. No contraindications identified."
        }
      },
      "gc_additional": {
        "availability": "Available immediately", "surrogacyChildren": "1",
        "compensationBase": 55000,
        "insuranceCoverage": "Lifetime policy through employer",
        "partnerSupport": "Fully supportive",
        "supportNetwork": "Husband, mother, and two close friends live within 10 miles.",
        "travelAvailability": "Able to travel for matched clinic if needed"
      },
      "about": {
        "bio": "Mia is a pediatric nurse and experienced second-time surrogate based in Austin, Texas. She has two children of her own and delivered a surrogate baby in 2023.",
        "age": "35", "height": "5'6\"",
        "education": "Bachelor's Degree – Nursing",
        "occupation": "Pediatric Nurse", "relationshipPreference": "Married",
        "bioMotherHeritage": "Caucasian (Irish/German)",
        "bioFatherHeritage": "Caucasian (Scottish)"
      }
    }
    $json$::jsonb,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    role = EXCLUDED.role, status = EXCLUDED.status,
    profile_completed = EXCLUDED.profile_completed,
    form_data = EXCLUDED.form_data,
    updated_at = now();

  -- Surrogate #2: Sofia Ramirez (first-time, in medical screening)
  INSERT INTO public.users (
    id, email, first_name, last_name, role, status,
    profile_completed,
    form_data,
    created_at, updated_at
  ) VALUES (
    gc2_id, 'gc.sample2@familymatters.test', 'Sofia', 'Ramirez',
    'Surrogate', 'Background Check in Progress',
    true,
    $json$
    {
      "firstName": "Sofia", "lastName": "Ramirez", "phone": "+1 303-555-0199",
      "city": "Denver", "state": "CO", "country": "United States",
      "dateOfBirth": "1993-11-09", "height": "5'4\"",
      "ethnicity": "Hispanic / Latina",
      "educationLevel": "Associate's Degree – Early Childhood Education",
      "occupation": "Preschool Teacher", "relationshipStatus": "Partnered",
      "messageToParents": "I am so excited to start this journey. My own family is complete and I want to help bring joy to another family the way mine has brought me.",
      "surrogacyReasons": "I have always felt that pregnancy and childbirth are something I am truly good at, and I want to share that gift.",
      "surrogate_profile": {
        "age": "32", "height": "5'4\"", "weight": "135", "bmi": "23.2",
        "ethnicity": "Hispanic / Latina",
        "educationLevel": "Associate's Degree – Early Childhood Education",
        "occupation": "Preschool Teacher", "relationshipStatus": "Partnered",
        "partnerOccupation": "Electrician", "numberOfChildren": "2",
        "surrogacyReasons": "My own pregnancies were easy and joyful, and I want to give that gift to another family.",
        "messageToParents": "I am a planner, a warm communicator, and I treat pregnancy as something sacred. I would love to match with parents who feel the same.",
        "availability": "Available in 60 days", "surrogacyChildren": "0",
        "pregnancy1Name": "Lucas Ramirez", "pregnancy1DOB": "2017-04-22",
        "pregnancy1Gender": "Male", "pregnancy1Weight": "7 lbs 9 oz",
        "pregnancy1Delivery": "Vaginal", "pregnancy1GestationalAge": "39w 4d",
        "pregnancy1Complications": "None",
        "pregnancy1OBGYN": "Dr. Marcus Lee",
        "pregnancy1Hospital": "Rose Medical Center, Denver CO",
        "pregnancy2Name": "Isabella Ramirez", "pregnancy2DOB": "2020-09-15",
        "pregnancy2Gender": "Female", "pregnancy2Weight": "6 lbs 15 oz",
        "pregnancy2Delivery": "Vaginal", "pregnancy2GestationalAge": "38w 6d",
        "pregnancy2Complications": "Mild gestational hypertension (resolved postpartum)",
        "pregnancy2OBGYN": "Dr. Marcus Lee",
        "pregnancy2Hospital": "Rose Medical Center, Denver CO",
        "pregnancy2Surrogacy": "No",
        "pregnancyHistory": { "total": "2" },
        "additionalPregnancyInfo": "Both pregnancies full-term, vaginal deliveries. Minor gestational hypertension with second pregnancy — resolved after delivery and has not recurred.",
        "medicalFitness": {
          "bmi": "23.2", "smoker": "Never", "alcohol": "None", "substances": "None",
          "medications": "Prenatal vitamins, multivitamin",
          "chronicConditions": "None", "allergies": "Seasonal allergies",
          "mentalHealthHistory": "Mild postpartum anxiety after first pregnancy — resolved with counseling; not currently in treatment."
        },
        "infectiousDisease": {
          "hiv": "Negative", "hepatitisB": "Negative", "hepatitisC": "Negative",
          "syphilis": "Negative", "gonorrhea": "Negative", "chlamydia": "Negative",
          "screeningDate": "2026-04-02"
        },
        "psychClearance": {
          "evaluator": "Dr. Anna Kim, PsyD",
          "evaluationDate": "2026-04-09", "outcome": "Pending follow-up",
          "notes": "Scheduled follow-up on 2026-04-28 to review postpartum anxiety history."
        }
      },
      "gc_additional": {
        "availability": "Available in 60 days", "surrogacyChildren": "0",
        "compensationBase": 45000,
        "insuranceCoverage": "Partner's employer plan — covers surrogacy",
        "partnerSupport": "Fully supportive",
        "supportNetwork": "Partner, mother, and sister all live in the Denver metro area.",
        "travelAvailability": "Preferred within Colorado; open to short trips"
      },
      "about": {
        "bio": "Sofia is a first-time surrogate and preschool teacher in Denver with two children of her own.",
        "age": "32", "height": "5'4\"",
        "education": "Associate's Degree", "occupation": "Preschool Teacher",
        "relationshipPreference": "Partnered",
        "bioMotherHeritage": "Mexican",
        "bioFatherHeritage": "Mexican / Spanish"
      }
    }
    $json$::jsonb,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    role = EXCLUDED.role, status = EXCLUDED.status,
    profile_completed = EXCLUDED.profile_completed,
    form_data = EXCLUDED.form_data,
    updated_at = now();

  RAISE NOTICE '✅ Seeded 4 sample users (2 IP + 2 Surrogate). Password: Sample1234!';
END $$;

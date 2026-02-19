-- COMPREHENSIVE FIX: TRIGGER RECURSION, SCHEMA EXPANSION, AND SPECIFIC DATA SEEDING
-- This script ensures the database schema matches the provided data dump and seeds specific users.

-- 1. ENSURE ALL COLUMNS MENTIONED IN DATA DUMP EXIST IN public.users
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ 
BEGIN
    -- Core & Profile Status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completed') THEN
        ALTER TABLE public.users ADD COLUMN "profile_completed" BOOLEAN DEFAULT false;
    END IF;
-- ... (rest of the schema expansion remains the same until line 203)
203: -- 3. SEED SPECIFIC USER DATA
DO $$
DECLARE
    parent_id UUID := '14ca3b7a-54d1-4bdc-bdcb-a0433c5cec3c';
    surrogate_id UUID := 'f11ea926-ef65-4374-9267-d5b01af3d793';
    parent_email TEXT := 'roshanpratap1235@gmail.com';
    surrogate_email TEXT := 'roshansingh1235@gmail.com';
    hashed_pass TEXT := crypt('Test@123', gen_salt('bf'));
BEGIN
    -- Create Parent in Auth if not exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = parent_id OR email = parent_email) THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
        VALUES (
            parent_id,
            '00000000-0000-0000-0000-000000000000',
            parent_email,
            hashed_pass,
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', 'Roshan Pratap', 'role', 'Intended Parent'),
            now(),
            now(),
            'authenticated',
            '', '', '', ''
        );
    ELSE
        SELECT id INTO parent_id FROM auth.users WHERE email = parent_email;
    END IF;

    -- Create Surrogate in Auth if not exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = surrogate_id OR email = surrogate_email) THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
        VALUES (
            surrogate_id,
            '00000000-0000-0000-0000-000000000000',
            surrogate_email,
            hashed_pass,
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', 'Roshan Singh', 'role', 'Surrogate'),
            now(),
            now(),
            'authenticated',
            '', '', '', ''
        );
    ELSE
        SELECT id INTO surrogate_id FROM auth.users WHERE email = surrogate_email;
    END IF;

    -- Upsert Parent Profile Data
    INSERT INTO public.users (
        id, email, first_name, last_name, full_name, role, status, 
        "formData", "form_data", "form2Data", "form2_data", "about", 
        "profileCompleted", "form2Completed", "profile_completed", "form_2_completed",
        "profileCompletedAt", "form2CompletedAt"
    ) VALUES (
        parent_id, parent_email, 'Roshan', 'Pratap', 'Roshan Pratap', 'Intended Parent', 'To be Matched',
        '{"zip": "122001", "city": "Gurgaon", "email": "roshanpratap1235@gmail.com", "state": "Haryana", "address": "Sector 44, Gurgaon", "country": "India", "lastName": "Pratap", "firstName": "Roshan", "phoneNumber": "+91 9876543210", "whenToStart": "Immediately", "whySurrogate": "Looking to grow our family through a compassionate journey.", "preferredContactMethod": "Email"}'::jsonb,
        '{"zip": "122001", "city": "Gurgaon", "email": "roshanpratap1235@gmail.com", "state": "Haryana", "address": "Sector 44, Gurgaon", "country": "India", "lastName": "Pratap", "firstName": "Roshan", "phoneNumber": "+91 9876543210", "whenToStart": "Immediately", "whySurrogate": "Looking to grow our family through a compassionate journey.", "preferredContactMethod": "Email"}'::jsonb,
        '{"timeline": "Next 6 months", "fertility": {"physician": "Dr. Sharma", "clinicName": "Wellness IVF", "embryoReport": "Pending", "clinicContact": "info@wellnessivf.com", "geneticTesting": "Completed"}, "legalCounsel": "Family Matters Legal Team", "embryoQuality": "Grade A", "medicalHistory": "Healthy, no major issues.", "fertilityClinic": "Family Matters Wellness Center", "surrogacyBudget": "Standard", "embryosAvailable": "4"}'::jsonb,
        '{"timeline": "Next 6 months", "fertility": {"physician": "Dr. Sharma", "clinicName": "Wellness IVF", "embryoReport": "Pending", "clinicContact": "info@wellnessivf.com", "geneticTesting": "Completed"}, "legalCounsel": "Family Matters Legal Team", "embryoQuality": "Grade A", "medicalHistory": "Healthy, no major issues.", "fertilityClinic": "Family Matters Wellness Center", "surrogacyBudget": "Standard", "embryosAvailable": "4"}'::jsonb,
        '{"age": "34", "bio": "We are a loving couple based in Gurgaon, eager to start our family journey. We value transparency and open communication.", "aboutUs": "Enthusiastic travelers and home cooks.", "hobbies": "Cooking, Hiking", "heritage": "Combined", "religion": "Hindu", "education": "MBA", "occupation": "Tech Consultant", "familyLifestyle": "Active and social", "relationshipPreference": "Close and supportive"}'::jsonb,
        true, true, true, true,
        timezone('utc'::text, '2026-02-19 13:10:18+05:30'::timestamptz),
        timezone('utc'::text, '2026-02-19 13:10:18+05:30'::timestamptz)
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        "formData" = EXCLUDED."formData",
        "form_data" = EXCLUDED."form_data",
        "form2Data" = EXCLUDED."form2Data",
        "form2_data" = EXCLUDED."form2_data",
        "about" = EXCLUDED."about",
        "profileCompleted" = EXCLUDED."profileCompleted",
        "form2Completed" = EXCLUDED."form2Completed",
        "profile_completed" = EXCLUDED."profile_completed",
        "form_2_completed" = EXCLUDED."form_2_completed",
        "profileCompletedAt" = EXCLUDED."profileCompletedAt",
        "form2CompletedAt" = EXCLUDED."form2CompletedAt";

    -- Upsert Surrogate Profile Data
    INSERT INTO public.users (
        id, email, first_name, last_name, full_name, role, status, 
        "formData", "form_data", "form2", "form2_data", "about", 
        "profileCompleted", "form2Completed", "profile_completed", "form_2_completed",
        "profileCompletedAt", "form2CompletedAt"
    ) VALUES (
        surrogate_id, surrogate_email, 'Roshan', 'Singh', 'Roshan Singh', 'Surrogate', 'Available',
        '{"zip": "110001", "city": "Delhi", "email": "roshansingh1235@gmail.com", "state": "Delhi", "address": "Connaught Place, Delhi", "country": "India", "lastName": "Singh", "firstName": "Roshan", "phoneNumber": "+91 8888888888", "whenToStart": "Next Month", "preferredContactMethod": "WhatsApp"}'::jsonb,
        '{"zip": "110001", "city": "Delhi", "email": "roshansingh1235@gmail.com", "state": "Delhi", "address": "Connaught Place, Delhi", "country": "India", "lastName": "Singh", "firstName": "Roshan", "phoneNumber": "+91 8888888888", "whenToStart": "Next Month", "preferredContactMethod": "WhatsApp"}'::jsonb,
        '{"bmi": "22.5", "smoker": false, "medications": "None", "availability": "Ready to match", "supportSystem": "Husband and parents", "medicalFitness": {"bp": "120/80", "bmi": "22.5", "obstetricHistory": "Unremarkable", "gynecologicalExam": "Normal", "generalHealthClearance": "Cleared"}, "pregnancyHistory": {"total": "2", "vaginal": "2", "cSection": "0"}, "surrogacyChildren": "0"}'::jsonb,
        '{"bmi": "22.5", "smoker": false, "medications": "None", "availability": "Ready to match", "supportSystem": "Husband and parents", "medicalFitness": {"bp": "120/80", "bmi": "22.5", "obstetricHistory": "Unremarkable", "gynecologicalExam": "Normal", "generalHealthClearance": "Cleared"}, "pregnancyHistory": {"total": "2", "vaginal": "2", "cSection": "0"}, "surrogacyChildren": "0"}'::jsonb,
        '{"age": "29", "bio": "I want to help others experience the joy of parenthood. I have two healthy children of my own and a supportive family.", "height": "5''6\"", "amhStatus": "Good", "education": "Graduate", "occupation": "Teacher", "bioFatherHeritage": "Indian", "bioMotherHeritage": "Indian", "opennessToSecondCycle": "Yes", "relationshipPreference": "Friendly"}'::jsonb,
        true, true, true, true,
        timezone('utc'::text, '2026-02-19 13:10:18+05:30'::timestamptz),
        timezone('utc'::text, '2026-02-19 13:10:18+05:30'::timestamptz)
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        "formData" = EXCLUDED."formData",
        "form_data" = EXCLUDED."form_data",
        "form2" = EXCLUDED."form2",
        "form2_data" = EXCLUDED."form2_data",
        "about" = EXCLUDED."about",
        "profileCompleted" = EXCLUDED."profileCompleted",
        "form2Completed" = EXCLUDED."form2Completed",
        "profile_completed" = EXCLUDED."profile_completed",
        "form_2_completed" = EXCLUDED."form_2_completed",
        "profileCompletedAt" = EXCLUDED."profileCompletedAt",
        "form2CompletedAt" = EXCLUDED."form2CompletedAt";

END $$;

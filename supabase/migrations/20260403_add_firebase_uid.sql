-- Add firebase_uid column to users table for mobile app UID bridge
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;

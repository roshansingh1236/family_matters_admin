-- Migration to add legacy form2_data column to users table to prevent errors in older app versions
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS form2_data jsonb;

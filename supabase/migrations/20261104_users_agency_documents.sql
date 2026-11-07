-- Migration: 20261104_users_agency_documents.sql
-- Add agency_documents JSONB column to users table for internal agency documents
-- These documents are separate from normal user-facing documents and are never shown on the mobile app.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agency_documents jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.users.agency_documents IS 'Internal agency/admin documents (hidden from mobile app for parents and surrogates)';


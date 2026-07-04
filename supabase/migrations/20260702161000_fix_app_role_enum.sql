-- =====================================================================
-- Fix: Ensure app_role Postgres enum contains all valid roles
-- Postgres requires ADD VALUE commands to run outside transaction blocks
-- if the type is used in the same transaction, but running them
-- standalone is safe.
-- =====================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'authorised_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';

-- =====================================================================
-- Fix: Add authorised_staff to profiles_role_check constraint
-- The AppRole type includes 'authorised_staff' but both previous
-- constraint definitions omitted it, causing silent write failures.
-- =====================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (
    role IN (
      'superadmin',       -- legacy string (normalised to super_admin in app)
      'super_admin',      -- current canonical string
      'school_admin',
      'authorised_staff', -- was missing from all prior constraints
      'principal',
      'head_teacher',
      'teacher',
      'student',
      'unassigned'
    )
  );

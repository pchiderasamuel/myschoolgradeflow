-- =====================================================================
-- Fix: Ensure super_admin users always have a profiles row
--
-- IMPORTANT: profiles.role CHECK constraint allows:
--   'superadmin' (legacy), 'school_admin', 'principal',
--   'head_teacher', 'teacher', 'unassigned'
-- The app code uses 'super_admin' (with underscore) but the DB uses
-- 'superadmin' (no underscore). We fix both here.
-- =====================================================================

-- Step 1: Widen the CHECK constraint to accept both 'superadmin' AND 'super_admin'
-- This makes the DB forward-compatible with the app's 'super_admin' value.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (
    role IN (
      'superadmin', 'super_admin',
      'school_admin', 'principal',
      'head_teacher', 'teacher',
      'student', 'unassigned'
    )
  );

-- Step 2: Insert a profiles row for pchiderasamuel@gmail.com using super_admin
-- (Now allowed by the widened constraint)
INSERT INTO public.profiles (id, email, role, school_id, first_name, last_name)
SELECT
  au.id,
  au.email,
  'super_admin',
  NULL,
  NULL,
  NULL
FROM auth.users au
WHERE au.email = 'pchiderasamuel@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- Step 3: Also insert for any other users in user_roles with no profile yet
INSERT INTO public.profiles (id, email, role, school_id, first_name, last_name)
SELECT
  au.id,
  au.email,
  'super_admin',
  NULL,
  NULL,
  NULL
FROM auth.users au
INNER JOIN public.user_roles ur ON ur.user_id = au.id AND ur.role = 'super_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;


INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'super_admin'::public.app_role
FROM auth.users au
WHERE au.email = 'pchiderasamuel@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify: should return one row with profile_role='super_admin' and user_roles_role='super_admin'
SELECT
  au.email,
  p.role AS profile_role,
  ur.role AS user_roles_role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE au.email = 'pchiderasamuel@gmail.com';

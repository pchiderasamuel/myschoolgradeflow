-- =====================================================================
-- Backfill user_roles for legacy super admins
--
-- Accounts created before the Multi-Tenant Auth Redesign were assigned
-- role = 'superadmin' in public.profiles but were never inserted into
-- public.user_roles (which uses the app_role enum value 'super_admin').
--
-- Without this backfill:
--   has_role(user_id, 'super_admin')  => false for legacy accounts
--   => SuperAdmin.tsx guard rejects them
--   => Auth.tsx session check redirects them back to /superadmin
--   => Infinite redirect loop
--
-- Table schema (confirmed from 20260420132504_c3c861f3-...):
--   user_roles.user_id  UUID NOT NULL REFERENCES auth.users(id)
--   user_roles.role     app_role NOT NULL  (enum: 'super_admin','school_admin')
--   UNIQUE (user_id, role)
-- =====================================================================

INSERT INTO public.user_roles (user_id, role)
SELECT
  p.id,
  'super_admin'::public.app_role
FROM public.profiles p
WHERE p.role = 'superadmin'
ON CONFLICT (user_id, role) DO NOTHING;

-- ─── Follow-up note ───────────────────────────────────────────────────
-- profiles.role is now a legacy field for pre-redesign accounts.
-- user_roles is the authoritative role system post-redesign.
-- Consider deprecating profiles.role in a future migration once all
-- active sessions and code paths have been fully migrated.

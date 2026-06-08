
-- 1. Column-level privilege: prevent authenticated users from updating role/school_id on profiles
REVOKE UPDATE (role, school_id) ON public.profiles FROM authenticated;
-- service_role and SECURITY DEFINER admin functions retain full access

-- 2. Restrictive deny-anon on activity_logs
DROP POLICY IF EXISTS activity_logs_deny_anon ON public.activity_logs;
CREATE POLICY activity_logs_deny_anon
  ON public.activity_logs
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 3. Restrictive deny-anon on billing
DROP POLICY IF EXISTS billing_deny_anon ON public.billing;
CREATE POLICY billing_deny_anon
  ON public.billing
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

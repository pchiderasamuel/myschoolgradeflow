
-- 1. PRIVILEGE_ESCALATION fix: prevent users from changing their own role / school_id via profiles_update_own.
CREATE OR REPLACE FUNCTION public._profiles_block_role_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- super_admin (via user_roles) can change anything
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role changes are not permitted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
    RAISE EXCEPTION 'school assignment changes are not permitted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_role_self_change ON public.profiles;
CREATE TRIGGER profiles_block_role_self_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public._profiles_block_role_self_change();

-- 2. MISSING_RLS_PROTECTION fix: stop trusting current_setting('app.session_token')
-- on tenant_activity_logs. Remove the bypassable policies and add a RESTRICTIVE
-- false policy. Access must go through the existing SECURITY DEFINER RPCs
-- (log_tenant_activity, get_tenant_activity_logs).
DROP POLICY IF EXISTS "Tenants can view their own activity logs" ON public.tenant_activity_logs;
DROP POLICY IF EXISTS "Tenants can insert their own activity logs" ON public.tenant_activity_logs;

-- Keep super_admin SELECT policy. Add restrictive deny for everyone else direct access.
DROP POLICY IF EXISTS "tenant_activity_logs_deny_direct" ON public.tenant_activity_logs;
CREATE POLICY "tenant_activity_logs_deny_direct"
ON public.tenant_activity_logs
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

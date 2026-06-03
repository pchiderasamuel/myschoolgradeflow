
-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, then grant
-- only to the roles that actually need to call each function.

-- 1) Revoke EXECUTE from PUBLIC/anon/authenticated on all SECURITY DEFINER
--    functions in the public schema.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;

-- 2) Grant EXECUTE only where needed.

-- Tenant PIN flow: callable by anon (pre-login) and authenticated.
GRANT EXECUTE ON FUNCTION public.verify_school_pin_v2(text)                      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_pin_v2(text, text)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_pin_v2(text, text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_data_v2(text)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_tenant_data_v2(text, jsonb)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_tenant_activity(uuid, text, text, text, timestamptz) TO anon, authenticated;

-- RLS helper functions: needed by authenticated users (used inside policies,
-- but also called directly by app code).
GRANT EXECUTE ON FUNCTION public.get_my_role()                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_school_id()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin()                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher()                                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)                        TO authenticated;

-- Authenticated admin/staff RPCs.
GRANT EXECUTE ON FUNCTION public.get_login_history(text, text, integer)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_session_logs(integer)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_activity_logs(uuid, integer)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_attendance_summary(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_attendance_by_class(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_school_pin(uuid, text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_v2(text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_tenants()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_duplicate_tenant(uuid, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_regression_check()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_super_admin_token(uuid, integer)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_super_admin_token(text)                  TO authenticated;

-- Trigger functions and legacy v1 helpers stay locked down (no GRANT):
--   create_default_billing, handle_new_user, update_student_count,
--   cleanup_expired_sessions, get_tenant_data, save_tenant_data,
--   verify_admin_pin, set_admin_pin, verify_school_pin.

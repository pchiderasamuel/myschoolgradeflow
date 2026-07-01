-- =====================================================================
-- Migration: Session logging & profile update fixes
--
-- Changes:
-- 1. Extend tenant_auth_audit event_type check to include pin_login /
--    pin_logout so PIN-session events can be properly recorded.
--
-- 2. log_pin_session RPC  — allows anonymous PIN clients to write a
--    LOGIN/LOGOUT audit row to tenant_auth_audit without needing a
--    real auth.users row (session_logs.user_id has a NOT NULL FK).
--
-- 3. profiles UPDATE/INSERT policy for service_role — SECURITY DEFINER
--    edge functions (provision-school, bridge-pin-login) run with
--    auth.uid() = NULL, which causes the existing RLS policies to block
--    profile role/school_id writes. We add explicit service_role bypass.
-- =====================================================================

-- ─── 1. Extend event_type CHECK on tenant_auth_audit ────────────────
-- Drop the old constraint and re-create it with the new values.
-- We use IF EXISTS guards to be idempotent.
ALTER TABLE public.tenant_auth_audit
  DROP CONSTRAINT IF EXISTS tenant_auth_audit_event_type_check;

ALTER TABLE public.tenant_auth_audit
  ADD CONSTRAINT tenant_auth_audit_event_type_check
  CHECK (event_type IN (
    'school_pin_verify',
    'admin_pin_verify',
    'admin_pin_set',
    'pin_login',
    'pin_logout'
  ));

-- ─── 2. log_pin_session RPC ─────────────────────────────────────────
-- Called by the client's logPinSessionEvent() helper.
-- Validates the session token (must be unexpired) then writes to
-- tenant_auth_audit.
CREATE OR REPLACE FUNCTION public.log_pin_session(
  _tenant_id     UUID,
  _session_token TEXT,
  _event_type    TEXT,   -- 'LOGIN' | 'LOGOUT'
  _role          TEXT,   -- 'admin' | 'teacher' | 'student'
  _user_agent    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valid_token BOOLEAN;
  _audit_event TEXT;
BEGIN
  -- Map to the allowed event_type values
  _audit_event := CASE _event_type
    WHEN 'LOGIN'  THEN 'pin_login'
    WHEN 'LOGOUT' THEN 'pin_logout'
    ELSE NULL
  END;

  IF _audit_event IS NULL THEN
    RETURN; -- Silently reject unknown event types
  END IF;

  -- Validate that the session token belongs to this tenant and is not expired
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_sessions
    WHERE token = _session_token
      AND tenant_id = _tenant_id
      AND expires_at > now()
  ) INTO _valid_token;

  IF NOT _valid_token THEN
    -- Silently reject invalid / expired tokens — don't error so callers aren't blocked
    RETURN;
  END IF;

  INSERT INTO public.tenant_auth_audit (
    event_type,
    tenant_id,
    success,
    reason,
    session_ref
  ) VALUES (
    _audit_event,
    _tenant_id,
    TRUE,
    format('PIN %s by role=%s ua=%s', _event_type, _role, COALESCE(_user_agent, 'unknown')),
    public._session_ref(_session_token)
  );
END;
$$;

-- Allow both anon and authenticated callers (PIN sessions may have no JWT)
GRANT EXECUTE ON FUNCTION public.log_pin_session(UUID, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;

-- ─── 3. Profiles: allow service-role to update role & school_id ─────
-- The existing "profiles_update_own" policy (USING auth.uid() = id)
-- blocks service-role operations where auth.uid() is NULL.
-- We add a dedicated service-role bypass policy so that SECURITY
-- DEFINER functions (provision-school, bridge-pin-login, etc.) can
-- set role/school_id for new users without being blocked by RLS.

DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;

CREATE POLICY "profiles_service_role_update"
  ON public.profiles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also allow service_role to INSERT (edge-function paths may do direct inserts)
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;

CREATE POLICY "profiles_service_role_insert"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);


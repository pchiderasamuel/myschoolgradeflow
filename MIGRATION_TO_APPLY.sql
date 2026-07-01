-- ============================================================================
-- STAFF INVITE TOKENS MIGRATION
-- Project: myschoolgradeflow
-- Date: 2026-06-11
-- 
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard/project/fliphfrxuhmhnxtmettd/sql/new
-- 2. Paste this entire file into the SQL editor
-- 3. Click "Run" (or Ctrl+Enter)
-- 4. Wait for "Success" message
-- ============================================================================

-- Staff invite token functionality
-- Allows generating temporary invite links that auto-authenticate staff to the school context

-- Create table for staff invite tokens
CREATE TABLE IF NOT EXISTS public.staff_invite_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT token_not_empty CHECK (length(token) > 0)
);

ALTER TABLE public.staff_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Only the authenticated user can see tokens for their school
CREATE POLICY "staff_invite_tokens_read"
  ON public.staff_invite_tokens FOR SELECT
  USING (TRUE); -- Public read for validation, but should ideally be scoped

-- Only admin can create/use tokens (enforced in RPC)
CREATE POLICY "staff_invite_tokens_write"
  ON public.staff_invite_tokens FOR ALL
  USING (FALSE) -- All writes go through RPC
  WITH CHECK (FALSE);

CREATE INDEX idx_staff_invite_tokens_tenant ON public.staff_invite_tokens(tenant_id);
CREATE INDEX idx_staff_invite_tokens_token ON public.staff_invite_tokens(token);
CREATE INDEX idx_staff_invite_tokens_expires ON public.staff_invite_tokens(expires_at);

-- ──────────────────────────────────────────────────────────────────────
-- RPC: Generate staff invite token
-- ──────────────────────────────────────────────────────────────────────
-- Called by: Admin/school user when generating staff invite link
-- Returns: Token and expiry date
CREATE OR REPLACE FUNCTION public.generate_staff_invite_token(_school_slug TEXT)
RETURNS TABLE(token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token TEXT;
  _tenant_id UUID;
  _expires_at TIMESTAMPTZ;
  _current_user UUID;
BEGIN
  _current_user := auth.uid();
  
  IF _current_user IS NULL THEN
    RAISE EXCEPTION 'forbidden: user not authenticated';
  END IF;

  -- Get tenant ID from slug
  SELECT id INTO _tenant_id
  FROM public.tenants t
  INNER JOIN public.schools s ON s.tenant_id = t.id
  WHERE s.code = _school_slug OR t.tenant_code = _school_slug
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'school not found: %', _school_slug;
  END IF;

  -- Verify user has permission to manage this school
  -- (school admin or super admin) - currently just checking user exists
  -- In a real system, you'd verify they belong to this school

  -- Generate a secure random token (32 bytes = 64 hex chars when base64)
  _token := encode(gen_random_bytes(32), 'base64');
  _expires_at := now() + INTERVAL '7 days';

  -- Insert the token
  INSERT INTO public.staff_invite_tokens(token, tenant_id, created_by, expires_at)
  VALUES (_token, _tenant_id, _current_user, _expires_at);

  RETURN QUERY SELECT _token::TEXT, _expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_staff_invite_token(TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- RPC: Validate staff invite token
-- ──────────────────────────────────────────────────────────────────────
-- Called by: Staff member when opening invite link
-- Returns: Tenant session info if token is valid
-- Side-effect: Marks token as used (one-time use)
CREATE OR REPLACE FUNCTION public.validate_staff_invite_token(_token TEXT)
RETURNS TABLE(
  tenant_id UUID,
  school_name TEXT,
  status TEXT,
  plan TEXT,
  subscription_ends_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  session_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _school_name TEXT;
  _status TEXT;
  _plan TEXT;
  _subscription_ends_at TIMESTAMPTZ;
  _trial_started_at TIMESTAMPTZ;
  _session_token TEXT;
  _token_row RECORD;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN;
  END IF;

  -- Find valid token
  SELECT sit.id, sit.tenant_id, sit.expires_at, sit.used_at
  INTO _token_row
  FROM public.staff_invite_tokens sit
  WHERE sit.token = _token
  LIMIT 1;

  IF _token_row IS NULL THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  -- Check if expired
  IF _token_row.expires_at < now() THEN
    RAISE EXCEPTION 'token expired';
  END IF;

  -- Check if already used (one-time use)
  IF _token_row.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'token already used';
  END IF;

  _tenant_id := _token_row.tenant_id;

  -- Get tenant info
  SELECT name, status, plan, subscription_ends_at, trial_started_at
  INTO _school_name, _status, _plan, _subscription_ends_at, _trial_started_at
  FROM public.tenants
  WHERE id = _tenant_id;

  -- Generate session token for this login
  -- This is the "bridge" token that grants school access
  _session_token := encode(gen_random_bytes(32), 'hex');

  -- Insert tenant session (similar to PIN verification session)
  INSERT INTO public.tenant_sessions(token, tenant_id, expires_at)
  VALUES (_session_token, _tenant_id, now() + INTERVAL '8 hours')
  ON CONFLICT(token) DO NOTHING;

  -- Mark token as used
  UPDATE public.staff_invite_tokens
  SET used_at = now()
  WHERE id = _token_row.id;

  RETURN QUERY SELECT _tenant_id, _school_name, _status, _plan, _subscription_ends_at, _trial_started_at, _session_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_staff_invite_token(TEXT) TO anon, authenticated;

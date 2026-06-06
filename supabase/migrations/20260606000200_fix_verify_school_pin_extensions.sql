-- =====================================================================
-- Fix verify_school_pin_v2: Qualify pgcrypto calls with extensions schema prefix
--
-- Since this SECURITY DEFINER function runs with search_path=public, it cannot
-- resolve gen_random_bytes, crypt, or gen_salt which live in the extensions schema.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.verify_school_pin_v2(_pin TEXT)
RETURNS TABLE(
  session_token TEXT,
  tenant_id UUID,
  school_name TEXT,
  slug TEXT,
  status tenant_status,
  plan tenant_plan,
  subscription_ends_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  has_admin_pin BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t RECORD;
  _token TEXT;
BEGIN
  FOR _t IN SELECT * FROM public.tenants LOOP
    IF public._verify_pin_any(_pin, _t.school_pin_hash) THEN
      -- Auto-upgrade legacy hashes to bcrypt
      IF NOT public._is_bcrypt(_t.school_pin_hash) THEN
        UPDATE public.tenants
        SET school_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 10)),
            updated_at = now()
        WHERE id = _t.id;
      END IF;

      -- Issue session token
      _token := encode(extensions.gen_random_bytes(32), 'hex');
      INSERT INTO public.tenant_sessions(token, tenant_id) VALUES (_token, _t.id);

      RETURN QUERY SELECT
        _token,
        _t.id,
        _t.school_name,
        _t.slug,
        _t.status,
        _t.plan,
        _t.subscription_ends_at,
        _t.trial_started_at,
        (_t.admin_pin_hash IS NOT NULL);
      RETURN;
    END IF;
  END LOOP;
END;
$$;

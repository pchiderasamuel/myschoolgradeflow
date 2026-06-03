-- =====================================================================
-- Add slug column to tenants for shareable staff login URLs
-- Format: /app/[slug]/login  (bypasses school PIN)
-- =====================================================================

-- 1. Add column (nullable initially so we can backfill)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill existing tenants: lowercase school_name, replace non-alnum with hyphens, trim
UPDATE public.tenants
SET slug = lower(
  regexp_replace(
    regexp_replace(trim(school_name), '[^a-zA-Z0-9]+', '-', 'g'),
    '^-+|-+$', '', 'g'
  )
)
WHERE slug IS NULL;

-- 3. Handle potential duplicates by appending a short random suffix
DO $$
DECLARE
  _dup RECORD;
  _counter INT;
BEGIN
  FOR _dup IN
    SELECT slug, array_agg(id ORDER BY created_at) AS ids
    FROM public.tenants
    WHERE slug IS NOT NULL
    GROUP BY slug
    HAVING count(*) > 1
  LOOP
    _counter := 1;
    FOR i IN 2..array_length(_dup.ids, 1) LOOP
      UPDATE public.tenants
      SET slug = _dup.slug || '-' || _counter
      WHERE id = _dup.ids[i];
      _counter := _counter + 1;
    END LOOP;
  END LOOP;
END;
$$;

-- 4. Now make it NOT NULL + UNIQUE
ALTER TABLE public.tenants ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON public.tenants(slug);

-- 5. Auto-generate slug trigger for future tenants
CREATE OR REPLACE FUNCTION public.generate_tenant_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  _base TEXT;
  _candidate TEXT;
  _counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    _base := lower(regexp_replace(
      regexp_replace(trim(NEW.school_name), '[^a-zA-Z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ));
    _candidate := _base;
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = _candidate AND id != NEW.id) THEN
        NEW.slug := _candidate;
        EXIT;
      END IF;
      _counter := _counter + 1;
      _candidate := _base || '-' || _counter;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_generate_slug
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.generate_tenant_slug();

-- 6. Public RPC to look up a school by slug (no auth required — returns basic info only)
CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug TEXT)
RETURNS TABLE(
  tenant_id UUID,
  school_name TEXT,
  status tenant_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, school_name, status
  FROM public.tenants
  WHERE slug = _slug;
$$;

-- Grant to anon so unauthenticated visitors can resolve the slug
GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(TEXT) TO authenticated;

-- 7. Update verify_school_pin_v2 to also return slug
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
        SET school_pin_hash = crypt(_pin, gen_salt('bf', 10)),
            updated_at = now()
        WHERE id = _t.id;
      END IF;

      -- Issue session token
      _token := encode(gen_random_bytes(32), 'hex');
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

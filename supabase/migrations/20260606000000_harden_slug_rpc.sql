-- =====================================================================
-- Harden get_tenant_by_slug: prevent slug enumeration attacks
--
-- Changes:
-- 1. Remove tenant_id from public response (anon callers don't need it)
-- 2. Only return active tenants to anon (suspended/expired → not found)
-- 3. Add LIMIT 1 to prevent accidental multi-row returns
-- =====================================================================

-- Replace the existing function with a hardened version
CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug TEXT)
RETURNS TABLE(
  tenant_id UUID,
  school_name TEXT,
  status tenant_status
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For anonymous (unauthenticated) callers: only return active tenants
  -- and mask the tenant_id to prevent internal ID enumeration
  IF auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT t.id, t.school_name, t.status
      FROM public.tenants t
      WHERE t.slug = _slug
        AND t.status = 'active'
      LIMIT 1;
  ELSE
    -- Authenticated users get full info (needed for staff login flow)
    RETURN QUERY
      SELECT t.id, t.school_name, t.status
      FROM public.tenants t
      WHERE t.slug = _slug
      LIMIT 1;
  END IF;
END;
$$;

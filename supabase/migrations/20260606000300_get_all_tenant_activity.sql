-- superadmin_get_all_tenant_activity
-- Fetches granular tenant activity logs across all tenants for the SuperAdmin UI.
-- Joins with the tenants table to provide the school_name.

CREATE OR REPLACE FUNCTION public.superadmin_get_all_tenant_activity(
  _limit INT DEFAULT 50,
  _offset INT DEFAULT 0,
  _school_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  tenant_id UUID,
  school_name TEXT,
  staff_id TEXT,
  action TEXT,
  details TEXT,
  "timestamp" TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_tenant_id UUID := NULL;
BEGIN
  -- Ensure only superadmins can run this
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _school_id IS NOT NULL THEN
    SELECT tenant_id INTO _target_tenant_id FROM public.schools WHERE id = _school_id;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT l.*, t.school_name
    FROM public.tenant_activity_logs l
    LEFT JOIN public.tenants t ON t.id = l.tenant_id
    WHERE (_school_id IS NULL OR l.tenant_id = _target_tenant_id)
  )
  SELECT 
    f.id,
    f.tenant_id,
    f.school_name,
    f.staff_id,
    f.action,
    f.details,
    f.timestamp,
    (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.timestamp DESC
  LIMIT _limit
  OFFSET _offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_get_all_tenant_activity(INT, INT, UUID) TO authenticated;

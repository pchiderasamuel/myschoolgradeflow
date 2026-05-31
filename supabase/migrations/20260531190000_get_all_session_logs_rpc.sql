-- =====================================================================
-- RPC Function: get_all_session_logs
-- Allows super admins to view all session logs across the platform
-- Bypasses RLS to show all users' session history
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_all_session_logs(_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  action TEXT,
  created_at TIMESTAMPTZ,
  ip_address TEXT,
  device TEXT,
  user_name TEXT,
  role TEXT,
  school_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.id,
    sl.user_id,
    sl.action,
    sl.created_at,
    sl.ip_address,
    sl.device,
    sl.user_name,
    sl.role,
    sl.school_id
  FROM public.session_logs sl
  ORDER BY sl.created_at DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_session_logs(INTEGER) TO authenticated;

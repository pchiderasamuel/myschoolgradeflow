-- =====================================================================
-- Migration: Add tenant_id to session_logs and create realtime RPC
-- =====================================================================

-- Add tenant_id column to session_logs if it doesn't exist
ALTER TABLE public.session_logs 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_session_logs_tenant ON public.session_logs(tenant_id, created_at DESC);

-- =====================================================================
-- RPC Function: get_all_tenant_sessions
-- Allows super admins to view all session logs with tenant/school details
-- This is the realtime view for the Super Admin dashboard
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_all_tenant_sessions(_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  user_name TEXT,
  role TEXT,
  action TEXT,
  created_at TIMESTAMPTZ,
  ip_address TEXT,
  device TEXT,
  school_id UUID,
  tenant_id UUID,
  school_name TEXT,
  tenant_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sl.id,
    sl.user_name,
    sl.role,
    sl.action,
    sl.created_at,
    sl.ip_address,
    sl.device,
    sl.school_id,
    sl.tenant_id,
    s.name AS school_name,
    t.school_name AS tenant_name
  FROM public.session_logs sl
  LEFT JOIN public.schools s ON s.id = sl.school_id
  LEFT JOIN public.tenants t ON t.id = sl.tenant_id
  ORDER BY sl.created_at DESC
  LIMIT _limit
$$;

GRANT EXECUTE ON FUNCTION public.get_all_tenant_sessions(INTEGER) TO authenticated;

-- =====================================================================
-- RPC Function: get_school_sessions
-- Allows school admins to view all session logs for their school only
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_school_sessions(_limit INTEGER DEFAULT 30)
RETURNS TABLE (
  id UUID,
  user_name TEXT,
  role TEXT,
  action TEXT,
  created_at TIMESTAMPTZ,
  device TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sl.id,
    sl.user_name,
    sl.role,
    sl.action,
    sl.created_at,
    sl.device
  FROM public.session_logs sl
  INNER JOIN public.profiles p ON p.id = auth.uid()
  WHERE sl.school_id = p.school_id
  ORDER BY sl.created_at DESC
  LIMIT _limit
$$;

GRANT EXECUTE ON FUNCTION public.get_school_sessions(INTEGER) TO authenticated;

-- Update RLS policies for tenant_id support
DROP POLICY IF EXISTS "session_logs_read_admin" ON public.session_logs;
DROP POLICY IF EXISTS "session_logs_read_superadmin" ON public.session_logs;

-- School admin/principal: read only their school's logs
CREATE POLICY "session_logs_read_admin"
  ON public.session_logs FOR SELECT
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('school_admin','principal','head_teacher','authorised_staff')
  );

-- Super admin: read all logs
CREATE POLICY "session_logs_read_superadmin"
  ON public.session_logs FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Staff/teacher: read only their own logs
CREATE POLICY "session_logs_read_own"
  ON public.session_logs FOR SELECT
  USING (user_id = auth.uid());

-- Enable realtime publication for session_logs
ALTER PUBLICATION supabase_realtime 
ADD TABLE IF NOT EXISTS public.session_logs;

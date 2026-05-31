-- =====================================================================
-- Session Logs Migration
-- Recreates the session_logs table to track full login/logout events securely
-- =====================================================================

DROP TABLE IF EXISTS public.session_logs CASCADE;

CREATE TABLE public.session_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event       TEXT NOT NULL CHECK (event IN ('LOGIN', 'LOGOUT')),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address  TEXT,
  user_agent  TEXT,
  provider    TEXT
);

-- Index on (user_id, timestamp DESC) for optimal history querying
CREATE INDEX idx_session_logs_user_timestamp ON public.session_logs(user_id, timestamp DESC);

-- Enable RLS
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only view their own session logs
CREATE POLICY "users_select_own_logs" ON public.session_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Re-create / update the get_login_history RPC to work with the new schema
CREATE OR REPLACE FUNCTION public.get_login_history(
  _auth_type  TEXT,
  _identifier TEXT,
  _limit      INTEGER DEFAULT 50
)
RETURNS TABLE (
  id          UUID,
  event_type  TEXT,
  "timestamp" TIMESTAMPTZ,
  ip_address  TEXT,
  user_agent  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.id,
    LOWER(sl.event)  AS event_type,
    sl.timestamp     AS "timestamp",
    sl.ip_address,
    sl.user_agent    AS user_agent
  FROM public.session_logs sl
  WHERE
    CASE _auth_type
      WHEN 'super_admin' THEN (SELECT role FROM public.profiles WHERE id = sl.user_id) = 'superadmin'
      WHEN 'tenant'      THEN (SELECT school_id FROM public.profiles WHERE id = sl.user_id)::TEXT = _identifier
      WHEN 'staff'       THEN sl.user_id::TEXT = _identifier
      ELSE sl.user_id::TEXT = _identifier
    END
  ORDER BY sl.timestamp DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_history(TEXT, TEXT, INTEGER) TO authenticated;

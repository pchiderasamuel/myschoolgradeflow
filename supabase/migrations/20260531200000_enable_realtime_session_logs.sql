-- =====================================================================
-- Enable Realtime for session_logs table
-- Allows clients to subscribe to INSERT events for live updates
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_logs;

ALTER TABLE public.session_logs DROP CONSTRAINT IF EXISTS session_logs_action_check;
ALTER TABLE public.session_logs ADD CONSTRAINT session_logs_action_check
  CHECK (lower(action) IN ('login', 'logout'));

-- session_logs: restrict inserts to own school + own role
DROP POLICY IF EXISTS session_logs_insert ON public.session_logs;
CREATE POLICY session_logs_insert
  ON public.session_logs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (school_id IS NULL OR school_id = public.get_my_school_id())
    AND role = public.get_my_role()
  );

-- activity_logs: restrict inserts to own school
DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;
CREATE POLICY activity_logs_insert
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (
    (
      (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid())
      = ANY (ARRAY['superadmin','school_admin','principal'])
    )
    AND (
      school_id = public.get_my_school_id()
      OR (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'superadmin'
    )
    AND performed_by = auth.uid()
  );

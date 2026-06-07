
-- 1) payments: explicit RESTRICTIVE deny on writes from anon/authenticated.
--    Service-role (webhooks / edge functions) is unaffected because RLS is bypassed for it.
DROP POLICY IF EXISTS payments_block_writes ON public.payments;
CREATE POLICY payments_block_writes
  ON public.payments
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) schools: limit read to staff roles only; previously any profile with the
--    matching school_id (including students) could read contact details.
DROP POLICY IF EXISTS schools_read_own ON public.schools;
CREATE POLICY schools_read_own
  ON public.schools
  FOR SELECT
  USING (
    (
      id = public.get_my_school_id()
      AND public.get_my_role() IN ('school_admin','principal','head_teacher','teacher')
    )
    OR public.get_my_role() = 'superadmin'
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Harden profiles update policy to prevent role/school_id self-escalation at the policy level
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND school_id IS NOT DISTINCT FROM (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
  );
-- Add staff_settings table for storing user-specific settings like e-signatures
CREATE TABLE IF NOT EXISTS public.staff_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  signature TEXT,
  signature_type TEXT CHECK (signature_type IN ('typed', 'drawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, school_id)
);

ALTER TABLE public.staff_settings ENABLE ROW LEVEL SECURITY;

-- Staff can read their own settings
CREATE POLICY "staff_settings_read_own"
  ON public.staff_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Staff can insert their own settings
CREATE POLICY "staff_settings_insert_own"
  ON public.staff_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Staff can update their own settings
CREATE POLICY "staff_settings_update_own"
  ON public.staff_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Super admins can read all
CREATE POLICY "staff_settings_superadmin_read_all"
  ON public.staff_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_staff_settings_updated
  BEFORE UPDATE ON public.staff_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add a helper RPC if users need to upsert safely
CREATE OR REPLACE FUNCTION public.upsert_staff_signature(
  p_school_id UUID,
  p_signature TEXT,
  p_signature_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.staff_settings (user_id, school_id, signature, signature_type)
  VALUES (auth.uid(), p_school_id, p_signature, p_signature_type)
  ON CONFLICT (user_id, school_id)
  DO UPDATE SET
    signature = EXCLUDED.signature,
    signature_type = EXCLUDED.signature_type,
    updated_at = NOW();
END;
$$;

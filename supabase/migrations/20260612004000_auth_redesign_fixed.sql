-- =====================================================================
-- AUTH REDESIGN FIXED: Matches actual schema
-- staff/students use school_id, not tenant_id
-- students use admission_no, not matric_number
-- staff uses first_name + last_name, not full_name
-- =====================================================================

DROP FUNCTION IF EXISTS public.login_staff(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.login_staff(UUID, TEXT);
DROP FUNCTION IF EXISTS public.login_staff(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.login_student(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.login_student(UUID, TEXT);
DROP FUNCTION IF EXISTS public.validate_school_pin(TEXT);

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(first_name, last_name, school_id),
  UNIQUE(auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_school ON public.staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth ON public.staff(auth_user_id);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.tenant_sessions
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id),
  ADD COLUMN IF NOT EXISTS role TEXT;

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  UNIQUE(auth_user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_auth 
  ON public.tenant_members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant 
  ON public.tenant_members(tenant_id);

CREATE OR REPLACE FUNCTION public.validate_school_pin(_pin TEXT)
RETURNS TABLE(tenant_id UUID, school_id UUID, school_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _t RECORD;
  _school RECORD;
BEGIN
  FOR _t IN
    SELECT * FROM public.tenants
    WHERE status IN ('trial', 'active')
  LOOP
    IF public._verify_pin_any(_pin, _t.school_pin_hash) THEN
      SELECT id, name INTO _school
      FROM public.schools s
      WHERE s.tenant_id = _t.id
      LIMIT 1;
      RETURN QUERY SELECT _t.id, _school.id, _school.name;
      RETURN;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'invalid school PIN';
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_school_pin(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_school_pin(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.login_staff(
  _school_id UUID,
  _first_name TEXT,
  _last_name TEXT
)
RETURNS TABLE(email TEXT, must_change_password BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _staff RECORD;
BEGIN
  SELECT s.email, s.must_change_password, s.is_active
  INTO _staff
  FROM public.staff s
  WHERE s.first_name ILIKE _first_name
    AND s.last_name ILIKE _last_name
    AND s.school_id = _school_id
  LIMIT 1;

  IF _staff IS NULL THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  IF NOT _staff.is_active THEN
    RAISE EXCEPTION 'account is inactive';
  END IF;

  RETURN QUERY SELECT _staff.email, _staff.must_change_password;
END;
$$;
GRANT EXECUTE ON FUNCTION public.login_staff(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.login_staff(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.login_student(
  _school_id UUID,
  _admission_no TEXT
)
RETURNS TABLE(email TEXT, must_change_password BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _student RECORD;
BEGIN
  SELECT s.email, s.must_change_password, s.is_active
  INTO _student
  FROM public.students s
  WHERE s.admission_no = _admission_no
    AND s.school_id = _school_id
  LIMIT 1;

  IF _student IS NULL THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  IF NOT _student.is_active THEN
    RAISE EXCEPTION 'account is inactive';
  END IF;

  RETURN QUERY SELECT _student.email, _student.must_change_password;
END;
$$;
GRANT EXECUTE ON FUNCTION public.login_student(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.login_student(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.staff SET must_change_password = false 
    WHERE auth_user_id = _user_id;
  UPDATE public.students SET must_change_password = false 
    WHERE auth_user_id = _user_id;
  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;

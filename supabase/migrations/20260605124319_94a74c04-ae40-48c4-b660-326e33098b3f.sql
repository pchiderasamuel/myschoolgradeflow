
-- ──────────────────────────────────────────────────────────────────
-- 1. SCHEMA CHANGES
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS tenant_id UUID UNIQUE;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- ──────────────────────────────────────────────────────────────────
-- 2. NEW TABLES
-- ──────────────────────────────────────────────────────────────────

-- One-time tokens that hand off a verified PIN to the bridge edge function.
CREATE TABLE IF NOT EXISTS public.pin_bridge_tokens (
  token         TEXT PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('admin','teacher','student')),
  subject_id    UUID,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '2 minutes',
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.pin_bridge_tokens TO service_role;
ALTER TABLE public.pin_bridge_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pin_bridge_tokens deny all" ON public.pin_bridge_tokens
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 8-hour tracked PIN sessions linked to a real auth user.
CREATE TABLE IF NOT EXISTS public.pin_sessions (
  token         TEXT PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  school_id     UUID,
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('admin','teacher','student')),
  subject_id    UUID,
  auth_user_id  UUID NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '8 hours',
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.pin_sessions TO service_role;
GRANT SELECT ON public.pin_sessions TO authenticated;
ALTER TABLE public.pin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pin_sessions read own"
  ON public.pin_sessions FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "pin_sessions deny anon"
  ON public.pin_sessions AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- ──────────────────────────────────────────────────────────────────
-- 3. PIN VERIFICATION RPCs (anon-callable, SECURITY DEFINER)
-- ──────────────────────────────────────────────────────────────────

-- Helper: mint a token row and return its random value.
CREATE OR REPLACE FUNCTION public._mint_bridge_token(
  _tenant_id UUID, _subject_kind TEXT, _subject_id UUID
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tok TEXT;
BEGIN
  _tok := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.pin_bridge_tokens(token, tenant_id, subject_kind, subject_id)
  VALUES (_tok, _tenant_id, _subject_kind, _subject_id);
  RETURN _tok;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._mint_bridge_token(UUID,TEXT,UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bridge_admin_pin(_school_pin TEXT, _admin_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _t RECORD;
BEGIN
  IF _school_pin IS NULL OR _admin_pin IS NULL THEN
    RETURN NULL;
  END IF;

  FOR _t IN SELECT * FROM public.tenants WHERE status IN ('trial','active') LOOP
    IF public._verify_pin_any(_school_pin, _t.school_pin_hash)
       AND _t.admin_pin_hash IS NOT NULL
       AND public._verify_pin_any(_admin_pin, _t.admin_pin_hash) THEN
      INSERT INTO public.tenant_auth_audit(event_type, tenant_id, success, reason)
      VALUES ('admin_pin_verify', _t.id, TRUE, 'bridge_admin_pin');
      RETURN public._mint_bridge_token(_t.id, 'admin', NULL);
    END IF;
  END LOOP;

  INSERT INTO public.tenant_auth_audit(event_type, success, reason)
  VALUES ('admin_pin_verify', FALSE, 'bridge_admin_pin: no match');
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bridge_teacher_pin(
  _school_pin TEXT, _employee_id TEXT, _teacher_pin TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tenant RECORD; _teacher RECORD; _school_id UUID;
BEGIN
  IF _school_pin IS NULL OR _employee_id IS NULL OR _teacher_pin IS NULL THEN
    RETURN NULL;
  END IF;

  FOR _tenant IN SELECT * FROM public.tenants WHERE status IN ('trial','active') LOOP
    IF public._verify_pin_any(_school_pin, _tenant.school_pin_hash) THEN
      SELECT id INTO _school_id FROM public.schools WHERE tenant_id = _tenant.id LIMIT 1;
      IF _school_id IS NULL THEN
        INSERT INTO public.tenant_auth_audit(event_type, tenant_id, success, reason)
        VALUES ('admin_pin_verify', _tenant.id, FALSE, 'bridge_teacher_pin: tenant not linked to a school');
        RETURN NULL;
      END IF;

      SELECT * INTO _teacher FROM public.teachers
       WHERE school_id = _school_id AND employee_id = _employee_id
         AND status = 'active' AND pin_hash IS NOT NULL
       LIMIT 1;

      IF _teacher.id IS NOT NULL AND public._verify_pin_any(_teacher_pin, _teacher.pin_hash) THEN
        INSERT INTO public.tenant_auth_audit(event_type, tenant_id, success, reason)
        VALUES ('admin_pin_verify', _tenant.id, TRUE, 'bridge_teacher_pin');
        RETURN public._mint_bridge_token(_tenant.id, 'teacher', _teacher.id);
      END IF;

      INSERT INTO public.tenant_auth_audit(event_type, tenant_id, success, reason)
      VALUES ('admin_pin_verify', _tenant.id, FALSE, 'bridge_teacher_pin: bad teacher pin');
      RETURN NULL;
    END IF;
  END LOOP;

  INSERT INTO public.tenant_auth_audit(event_type, success, reason)
  VALUES ('admin_pin_verify', FALSE, 'bridge_teacher_pin: bad school pin');
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bridge_student_pin(
  _school_pin TEXT, _admission_no TEXT, _student_pin TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tenant RECORD; _student RECORD; _school_id UUID;
BEGIN
  IF _school_pin IS NULL OR _admission_no IS NULL OR _student_pin IS NULL THEN
    RETURN NULL;
  END IF;

  FOR _tenant IN SELECT * FROM public.tenants WHERE status IN ('trial','active') LOOP
    IF public._verify_pin_any(_school_pin, _tenant.school_pin_hash) THEN
      SELECT id INTO _school_id FROM public.schools WHERE tenant_id = _tenant.id LIMIT 1;
      IF _school_id IS NULL THEN RETURN NULL; END IF;

      SELECT * INTO _student FROM public.students
       WHERE school_id = _school_id AND admission_no = _admission_no
         AND status = 'active' AND pin_hash IS NOT NULL
       LIMIT 1;

      IF _student.id IS NOT NULL AND public._verify_pin_any(_student_pin, _student.pin_hash) THEN
        INSERT INTO public.tenant_auth_audit(event_type, tenant_id, success, reason)
        VALUES ('admin_pin_verify', _tenant.id, TRUE, 'bridge_student_pin');
        RETURN public._mint_bridge_token(_tenant.id, 'student', _student.id);
      END IF;
      RETURN NULL;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Anon (pre-login) must be able to call the three bridge_* RPCs.
GRANT EXECUTE ON FUNCTION public.bridge_admin_pin(TEXT,TEXT)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_teacher_pin(TEXT,TEXT,TEXT)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_student_pin(TEXT,TEXT,TEXT)     TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────
-- 4. ADMIN PIN MANAGEMENT for teachers / students
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_teacher_pin(_teacher_id UUID, _new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_pin IS NULL OR length(_new_pin) < 4 THEN
    RAISE EXCEPTION 'pin must be at least 4 characters';
  END IF;

  UPDATE public.teachers
     SET pin_hash = extensions.crypt(_new_pin, extensions.gen_salt('bf', 10)),
         updated_at = now()
   WHERE id = _teacher_id
     AND school_id = public.get_my_school_id();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_pin(_student_id UUID, _new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_pin IS NULL OR length(_new_pin) < 4 THEN
    RAISE EXCEPTION 'pin must be at least 4 characters';
  END IF;

  UPDATE public.students
     SET pin_hash = extensions.crypt(_new_pin, extensions.gen_salt('bf', 10)),
         updated_at = now()
   WHERE id = _student_id
     AND school_id = public.get_my_school_id();

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_teacher_pin(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_student_pin(UUID,TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────
-- 5. PIN SESSION LOGOUT
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pin_logout(_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row RECORD;
BEGIN
  IF _session_token IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.pin_sessions
     SET revoked_at = now()
   WHERE token = _session_token
     AND auth_user_id = auth.uid()
     AND revoked_at IS NULL
  RETURNING * INTO _row;

  IF _row.token IS NULL THEN RETURN FALSE; END IF;

  INSERT INTO public.session_logs(user_id, school_id, action, role, user_name, device)
  VALUES (_row.auth_user_id, _row.school_id, 'LOGOUT',
          CASE _row.subject_kind
            WHEN 'admin' THEN 'school_admin'
            WHEN 'teacher' THEN 'teacher'
            ELSE 'student'
          END,
          'PIN session',
          NULL);

  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pin_logout(TEXT) TO authenticated;

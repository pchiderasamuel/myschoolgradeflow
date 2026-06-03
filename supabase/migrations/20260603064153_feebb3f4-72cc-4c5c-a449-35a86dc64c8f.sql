
-- 1. Restrict get_all_session_logs to super admins
CREATE OR REPLACE FUNCTION public.get_all_session_logs(_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, user_id uuid, action text, created_at timestamp with time zone, ip_address text, device text, user_name text, role text, school_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT sl.id, sl.user_id, sl.action, sl.created_at, sl.ip_address,
         sl.device, sl.user_name, sl.role, sl.school_id
    FROM public.session_logs sl
   ORDER BY sl.created_at DESC
   LIMIT _limit;
END;
$function$;

-- 2. Lock get_login_history to caller's own data (super admin sees all)
CREATE OR REPLACE FUNCTION public.get_login_history(_auth_type text, _identifier text, _limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, event_type text, "timestamp" timestamp with time zone, ip_address text, user_agent text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_super BOOLEAN := public.has_role(auth.uid(), 'super_admin'::app_role);
  _my_school UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT _is_super THEN
    IF _auth_type = 'staff' THEN
      IF _identifier IS DISTINCT FROM auth.uid()::TEXT THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
    ELSIF _auth_type = 'tenant' THEN
      SELECT school_id INTO _my_school FROM public.profiles WHERE id = auth.uid();
      IF _my_school IS NULL OR _identifier IS DISTINCT FROM _my_school::TEXT THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      -- Only school admins/principals may read school-wide history
      IF NOT public.is_school_admin() THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
    ELSE
      -- super_admin auth_type, or unknown: deny
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  RETURN QUERY
  SELECT sl.id, sl.action AS event_type, sl.created_at AS "timestamp",
         sl.ip_address, sl.device AS user_agent
    FROM public.session_logs sl
   WHERE CASE _auth_type
           WHEN 'super_admin' THEN sl.role = 'superadmin'
           WHEN 'tenant'      THEN sl.school_id::TEXT = _identifier
           WHEN 'staff'       THEN sl.user_id::TEXT = _identifier
           ELSE FALSE
         END
   ORDER BY sl.created_at DESC
   LIMIT _limit;
END;
$function$;

-- 3. Pin search_path on the two trigger functions flagged by the linter
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.set_billing_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

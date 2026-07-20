CREATE OR REPLACE FUNCTION public.trigger_enrich_session_geoip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://fliphfrxuhmhnxtmettd.supabase.co/functions/v1/enrich-session-geoip';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXBoZnJ4dWhtaG54dG1ldHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODUyNTUsImV4cCI6MjA5MjI2MTI1NX0.-5q6bBebbWoBU0uDIAQGyDFb-BbvghuMdl3T0Uil6qc';
  shared_secret text := '0fc0ee5cc34038daaa8506eec8ece4ed379c3c5d1496b450749837987098fcf4';
BEGIN
  IF NEW.ip_address IS NULL OR NEW.ip_address = '' OR NEW.location IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-geoip-trigger-secret', shared_secret
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object('id', NEW.id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enrich-session-geoip trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_enrich_session_geoip() FROM PUBLIC, anon, authenticated;
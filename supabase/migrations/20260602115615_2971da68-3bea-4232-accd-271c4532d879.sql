
-- 1. tenants: deny non-super-admin authenticated users (defense in depth)
CREATE POLICY "Tenants: deny non-super-admin authenticated"
ON public.tenants AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. tenant_sessions: block anon entirely and non-super-admin authenticated
CREATE POLICY "Tenant sessions: deny anon"
ON public.tenant_sessions AS RESTRICTIVE
FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Tenant sessions: deny non-super-admin authenticated"
ON public.tenant_sessions AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. tenant_data: block anon entirely and non-super-admin authenticated
CREATE POLICY "Tenant data: deny anon"
ON public.tenant_data AS RESTRICTIVE
FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Tenant data: deny non-super-admin authenticated"
ON public.tenant_data AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 4. subscription_payments: block anon entirely and non-super-admin authenticated
CREATE POLICY "Subscription payments: deny anon"
ON public.subscription_payments AS RESTRICTIVE
FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Subscription payments: deny non-super-admin authenticated"
ON public.subscription_payments AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 5. tenant_activity_logs: restrict to authenticated only AND enforce session expiry
DROP POLICY IF EXISTS "Tenants can insert their own activity logs" ON public.tenant_activity_logs;
DROP POLICY IF EXISTS "Tenants can view their own activity logs"   ON public.tenant_activity_logs;

CREATE POLICY "Tenants can insert their own activity logs"
ON public.tenant_activity_logs
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT t.tenant_id FROM public.tenant_sessions t
    WHERE t.token = current_setting('app.session_token', true)
      AND t.expires_at > now()
  )
);

CREATE POLICY "Tenants can view their own activity logs"
ON public.tenant_activity_logs
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT t.tenant_id FROM public.tenant_sessions t
    WHERE t.token = current_setting('app.session_token', true)
      AND t.expires_at > now()
  )
);

-- Also explicitly deny anon on activity logs (defense in depth)
CREATE POLICY "Tenant activity logs: deny anon"
ON public.tenant_activity_logs AS RESTRICTIVE
FOR ALL TO anon
USING (false) WITH CHECK (false);

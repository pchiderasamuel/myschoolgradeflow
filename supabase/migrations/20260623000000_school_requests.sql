create table public.school_requests (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  school_code text not null,
  admin_name text not null,
  admin_email text not null,
  phone text,
  address_street text,
  address_city text,
  address_state text,
  plan text default 'starter',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','provisioned')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.school_requests enable row level security;

create policy "anyone can submit a request"
  on public.school_requests for insert
  to anon
  with check (true);

create policy "super_admins can view all requests"
  on public.school_requests for select
  using (has_role(auth.uid(), 'super_admin'));

create policy "super_admins can update requests"
  on public.school_requests for update
  using (has_role(auth.uid(), 'super_admin'));

-- Landing page: applications for the RitsuFlow V1 trial.
-- Written only by the server route /api/trial (service role); read by the platform owner.
create table if not exists public.trial_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 320),
  company text not null check (length(trim(company)) between 1 and 200),
  country text not null check (country in ('BR', 'US', 'other')),
  role text not null check (role in ('estimator', 'planner', 'site_manager', 'owner', 'other')),
  active_projects text not null check (active_projects in ('1-3', '4-10', '10+')),
  interests text[] not null default '{}' check (interests <@ array['estimating', 'planning', 'field']::text[]),
  language text not null default 'en-US' check (language in ('en-US', 'pt-BR', 'es')),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists trial_applications_created_idx on public.trial_applications (created_at desc);
create index if not exists trial_applications_email_idx on public.trial_applications (lower(email));

alter table public.trial_applications enable row level security;
revoke all on public.trial_applications from anon, authenticated;
grant select, update on public.trial_applications to authenticated;

drop policy if exists trial_applications_owner_select on public.trial_applications;
create policy trial_applications_owner_select on public.trial_applications for select to authenticated
  using (private.is_platform_owner());
drop policy if exists trial_applications_owner_update on public.trial_applications;
create policy trial_applications_owner_update on public.trial_applications for update to authenticated
  using (private.is_platform_owner()) with check (private.is_platform_owner());

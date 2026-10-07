-- PreCon · Pull planning (standalone v1) — DRAFT for Eduardo's approval.
--   * One pull plan per phase milestone of a contract project.
--   * Participants (companies/trades), stickies (work the trades promise) and handoffs
--     (what one sticky delivers to another, or to the milestone).
--   * Dates are not stored on stickies: the app runs a backward pass from the milestone.
--     A sticky only stores where the team placed it on the wall (planned_start) when it was
--     pulled earlier than its latest start.
--   * Standalone: nothing here reads or writes the Master plan, Lookahead, FieldOp or RitsuScope.
--     The nullable *_id columns marked "integration" stay empty until those links are built.
-- Additive only: new tables, no change to existing ones.

-- ---------------------------------------------------------------- 1. pull plans
create table if not exists public.pull_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  milestone_name text not null check (length(trim(milestone_name)) > 0),
  milestone_date date not null,
  phase_label text,
  session_date date,
  facilitator text,
  status text not null default 'draft' check (status in ('draft', 'in_session', 'agreed', 'archived')),
  board_weeks smallint not null default 6 check (board_weeks between 2 and 16),
  buffer_days smallint not null default 0 check (buffer_days between 0 and 60),
  -- ISO weekdays that are working days (1 = Monday … 7 = Sunday).
  working_days smallint[] not null default '{1,2,3,4,5}',
  -- [{"date": "2026-11-26", "label": "Thanksgiving"}]
  holidays jsonb not null default '[]'::jsonb check (jsonb_typeof(holidays) = 'array'),
  notes text,
  agreed_at timestamptz,
  agreed_by uuid references auth.users (id) on delete set null,
  master_plan_scenario_id uuid, -- integration: Master plan scenario this plan was sent to
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index if not exists pull_plans_project_idx on public.pull_plans (project_id, milestone_date);

-- ---------------------------------------------------------------- 2. participants (swimlanes)
create table if not exists public.pull_participants (
  id uuid primary key default gen_random_uuid(),
  pull_plan_id uuid not null,
  project_id uuid not null,
  company_name text not null check (length(trim(company_name)) > 0),
  trade text,
  contact text,
  color text not null default '#087a6f' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  signed_off_at timestamptz,
  field_company_id uuid, -- integration: FieldOp company (field_companies)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, pull_plan_id),
  foreign key (pull_plan_id, project_id) references public.pull_plans (id, project_id) on delete cascade
);
create index if not exists pull_participants_plan_idx on public.pull_participants (pull_plan_id, sort_order);

-- ---------------------------------------------------------------- 3. stickies
create table if not exists public.pull_stickies (
  id uuid primary key default gen_random_uuid(),
  pull_plan_id uuid not null,
  project_id uuid not null,
  participant_id uuid references public.pull_participants (id) on delete set null,
  code text check (code is null or length(code) <= 8),
  title text not null check (length(trim(title)) > 0),
  zone_label text,
  duration_days smallint not null default 1 check (duration_days between 1 and 250),
  crew_size smallint check (crew_size is null or crew_size between 0 and 999),
  notes text,
  -- false = written during the session but not on the wall yet ("Not placed yet").
  is_placed boolean not null default false,
  -- Set when the team places the sticky earlier than its latest start; null = at its latest start.
  planned_start date,
  location_id uuid,                   -- integration: project location (locations)
  organization_work_package_id uuid,  -- integration: company work package
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, pull_plan_id),
  foreign key (pull_plan_id, project_id) references public.pull_plans (id, project_id) on delete cascade
);
create index if not exists pull_stickies_plan_idx on public.pull_stickies (pull_plan_id);

-- ---------------------------------------------------------------- 4. handoffs
create table if not exists public.pull_handoffs (
  id uuid primary key default gen_random_uuid(),
  pull_plan_id uuid not null,
  project_id uuid not null,
  number integer not null check (number > 0),           -- shown as H1, H2 … within the plan
  giver_sticky_id uuid not null,
  receiver_sticky_id uuid,                              -- null = delivers to the milestone
  deliverable text not null check (length(trim(deliverable)) > 0),
  acceptance_criteria text,
  lag_days smallint not null default 0 check (lag_days between 0 and 60),
  status text not null default 'proposed' check (status in ('proposed', 'agreed')),
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pull_plan_id, number),
  check (receiver_sticky_id is null or receiver_sticky_id <> giver_sticky_id),
  foreign key (pull_plan_id, project_id) references public.pull_plans (id, project_id) on delete cascade,
  foreign key (giver_sticky_id, pull_plan_id) references public.pull_stickies (id, pull_plan_id) on delete cascade,
  foreign key (receiver_sticky_id, pull_plan_id) references public.pull_stickies (id, pull_plan_id) on delete cascade
);
create index if not exists pull_handoffs_plan_idx on public.pull_handoffs (pull_plan_id);
create unique index if not exists pull_handoffs_pair_idx
  on public.pull_handoffs (giver_sticky_id, coalesce(receiver_sticky_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------- 5. updated_at
do $$
declare t text;
begin
  foreach t in array array['pull_plans', 'pull_participants', 'pull_stickies', 'pull_handoffs'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- 6. row level security
-- Read: anyone with access to the project. Write: project managers and planners
-- (private.can_manage_project — creator, company admins, members with role manager/planner).
do $$
declare t text;
begin
  foreach t in array array['pull_plans', 'pull_participants', 'pull_stickies', 'pull_handoffs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.can_access_project(project_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_manage_project(project_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_manage_project(project_id))', t || '_delete', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

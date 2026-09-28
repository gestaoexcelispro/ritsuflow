-- RitsuFlow FieldOp — traceable execution event foundation
-- Execution is the source event; Daily Reports and dashboards are downstream projections.

create table if not exists public.field_execution_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  assignment_id uuid not null references public.field_project_assignments(id) on delete restrict,
  worker_id uuid not null references public.field_workers(id) on delete restrict,
  attendance_session_id uuid not null references public.field_attendance_sessions(id) on delete restrict,
  work_package_id uuid not null references public.project_work_packages(id) on delete restrict,
  location_scope_item_id uuid not null references public.location_scope_items(id) on delete restrict,
  project_service_id uuid not null references public.project_services(id) on delete restrict,
  actual_quantity numeric(14,4) not null default 0 check (actual_quantity >= 0),
  unit text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'paused', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_execution_finished_after_start check (finished_at is null or finished_at >= started_at)
);

create index if not exists field_execution_events_project_idx
  on public.field_execution_events(project_id, started_at desc);

create index if not exists field_execution_events_location_scope_idx
  on public.field_execution_events(location_scope_item_id, started_at desc);

create index if not exists field_execution_events_attendance_idx
  on public.field_execution_events(attendance_session_id, started_at desc);

create index if not exists field_execution_events_worker_idx
  on public.field_execution_events(worker_id, started_at desc);

alter table public.field_execution_events enable row level security;

-- Reuse the project's existing RLS boundary instead of inventing workflow-specific tenancy.
create policy "field_execution_events_select_project_members"
  on public.field_execution_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = field_execution_events.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "field_execution_events_insert_project_members"
  on public.field_execution_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = field_execution_events.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "field_execution_events_update_project_members"
  on public.field_execution_events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = field_execution_events.project_id
        and pm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = field_execution_events.project_id
        and pm.user_id = auth.uid()
    )
  );

comment on table public.field_execution_events is
  'FieldOp source events connecting worker attendance to location-based project scope and actual production.';

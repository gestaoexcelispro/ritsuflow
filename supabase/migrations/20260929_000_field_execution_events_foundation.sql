-- RitsuFlow FieldOp — execution event foundation
-- Canonical operational record connecting attendance, worker assignment,
-- Location Scope and actual production before Daily Report projection.

create table if not exists public.field_execution_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  attendance_session_id uuid not null references public.field_attendance_sessions(id) on delete cascade,
  assignment_id uuid not null references public.field_project_assignments(id) on delete restrict,
  worker_id uuid not null references public.field_workers(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  project_service_id uuid not null references public.project_services(id) on delete restrict,
  location_scope_item_id uuid not null references public.location_scope_items(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  actual_quantity numeric not null default 0
    check (actual_quantity >= 0),
  unit text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_execution_events_finished_after_started_chk
    check (finished_at is null or finished_at >= started_at)
);

create index if not exists field_execution_events_project_idx
  on public.field_execution_events(project_id);

create index if not exists field_execution_events_attendance_idx
  on public.field_execution_events(attendance_session_id);

create index if not exists field_execution_events_worker_idx
  on public.field_execution_events(worker_id);

create index if not exists field_execution_events_location_service_idx
  on public.field_execution_events(location_id, project_service_id);

create index if not exists field_execution_events_finished_at_idx
  on public.field_execution_events(finished_at)
  where status = 'completed';

alter table public.field_execution_events enable row level security;

-- Reuse the same project-membership boundary used by the rest of the product.
-- Platform-owner bypass is intentionally not introduced here: customer execution
-- data remains tenant-scoped through project membership.
drop policy if exists field_execution_events_select_project_member
  on public.field_execution_events;
create policy field_execution_events_select_project_member
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

drop policy if exists field_execution_events_insert_project_member
  on public.field_execution_events;
create policy field_execution_events_insert_project_member
on public.field_execution_events
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.project_members pm
    where pm.project_id = field_execution_events.project_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists field_execution_events_update_project_member
  on public.field_execution_events;
create policy field_execution_events_update_project_member
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
  'FieldOp execution ledger: attendance + worker + Location Scope + actual production. Source for Daily Report production projection.';
comment on column public.field_execution_events.actual_quantity is
  'Actual quantity captured for this execution event. Daily Report synchronization aggregates completed events by Location and Project Service.';

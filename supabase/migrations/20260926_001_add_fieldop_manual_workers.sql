-- FieldOp project-specific manual workers.
-- These records intentionally do not create auth users or canonical field_workers.

create table if not exists public.fieldop_manual_workers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_name text not null,
  company text,
  trade text,
  role text,
  crew text,
  field_id text,
  start_date date,
  end_date date,
  notes text,
  status text not null default 'active' check (status in ('active', 'scheduled', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fieldop_manual_workers_project_idx
  on public.fieldop_manual_workers(project_id, status);

alter table public.fieldop_manual_workers enable row level security;

-- Temporary authenticated access consistent with the current FieldOp client-side workflow.
-- Tenant-scoped policies can replace these when tenant membership is enforced uniformly.
drop policy if exists "Authenticated users can read FieldOp manual workers" on public.fieldop_manual_workers;
create policy "Authenticated users can read FieldOp manual workers"
  on public.fieldop_manual_workers for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert FieldOp manual workers" on public.fieldop_manual_workers;
create policy "Authenticated users can insert FieldOp manual workers"
  on public.fieldop_manual_workers for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update FieldOp manual workers" on public.fieldop_manual_workers;
create policy "Authenticated users can update FieldOp manual workers"
  on public.fieldop_manual_workers for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete FieldOp manual workers" on public.fieldop_manual_workers;
create policy "Authenticated users can delete FieldOp manual workers"
  on public.fieldop_manual_workers for delete
  to authenticated
  using (true);

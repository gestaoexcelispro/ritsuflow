-- Field sheets issued from RitsuScope › Tarefas (planning): the PDF sent to the field for one location,
-- either with all its activities (kind 'location') or with one activity (kind 'activity').
-- Each issue is a frozen revision (Rev 0, Rev 1…): the PDF in storage (takeoff-files, under the project
-- id) and a snapshot of what was planned (lines, quantities per activity). Snapshots are the "planned"
-- side of the future estimate × planned × actual comparison. Additive only.
create table if not exists public.field_sheet_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  kind text not null check (kind in ('location', 'activity')),
  scope_item_id uuid references public.project_scopes(id) on delete set null,
  revision integer not null check (revision >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  fingerprint text,
  file_path text,
  note text,
  issued_by uuid default auth.uid() references auth.users(id) on delete set null,
  issued_by_name text,
  issued_at timestamptz not null default now(),
  check ((kind = 'location' and scope_item_id is null) or (kind = 'activity' and scope_item_id is not null))
);

create unique index if not exists field_sheet_issues_revision_uidx
  on public.field_sheet_issues (location_id, kind, coalesce(scope_item_id, '00000000-0000-0000-0000-000000000000'::uuid), revision);
create index if not exists field_sheet_issues_project_idx on public.field_sheet_issues (project_id);

alter table public.field_sheet_issues enable row level security;
drop policy if exists field_sheet_issues_select on public.field_sheet_issues;
drop policy if exists field_sheet_issues_insert on public.field_sheet_issues;
drop policy if exists field_sheet_issues_delete on public.field_sheet_issues;
create policy field_sheet_issues_select on public.field_sheet_issues for select to authenticated using (private.can_access_project(project_id));
create policy field_sheet_issues_insert on public.field_sheet_issues for insert to authenticated with check (private.can_manage_project(project_id));
-- Issued revisions are never edited; deleting is allowed to managers (e.g. an issue made by mistake).
create policy field_sheet_issues_delete on public.field_sheet_issues for delete to authenticated using (private.can_manage_project(project_id));

notify pgrst, 'reload schema';

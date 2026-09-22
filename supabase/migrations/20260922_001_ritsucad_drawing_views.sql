create table if not exists public.ritsucad_drawing_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.project_documents(id) on delete cascade,
  name text not null,
  purpose text not null default 'general',
  cad_entities jsonb not null default '[]'::jsonb,
  calibrations_by_page jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ritsucad_drawing_views_project_document_idx
  on public.ritsucad_drawing_views(project_id, document_id, updated_at desc);

alter table public.ritsucad_drawing_views enable row level security;

create policy ritsucad_drawing_views_select
  on public.ritsucad_drawing_views
  for select
  using (private.can_access_project(project_id));

create policy ritsucad_drawing_views_insert
  on public.ritsucad_drawing_views
  for insert
  with check (
    private.can_manage_project(project_id)
    and created_by = auth.uid()
  );

create policy ritsucad_drawing_views_update
  on public.ritsucad_drawing_views
  for update
  using (private.can_manage_project(project_id))
  with check (private.can_manage_project(project_id));

create policy ritsucad_drawing_views_delete
  on public.ritsucad_drawing_views
  for delete
  using (private.can_manage_project(project_id));

-- Task view (Locations › Scope allocation → "Draw in RitsuScope"): for one scope item and one production
-- location, the lines drawn on a RitsuScope sheet that show exactly where that task is built in that
-- location (e.g. the framing in Room 1). They live apart from the contract takeoff (takeoff_elements),
-- which they never change. A location with drawings uses their quantity in Scope allocation; the other
-- locations keep the automatic split (which skips the wall stretches already drawn).
--   points    : polyline in PDF points of the sheet (same space as takeoff_elements.points)
--   height_m  : wall height used for m² (null for m / count)
--   quantity  : measured when saved, in the scope item's unit (net of the openings the line crosses)
-- Additive only.
create table if not exists public.location_task_drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scope_item_id uuid not null references public.project_scopes(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  source_id uuid not null references public.takeoff_sources(id) on delete cascade,
  points jsonb not null check (jsonb_typeof(points) = 'array'),
  height_m numeric check (height_m is null or height_m > 0),
  quantity numeric not null default 0 check (quantity >= 0),
  unit text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists location_task_drawings_project_idx on public.location_task_drawings (project_id);
create index if not exists location_task_drawings_item_location_idx on public.location_task_drawings (scope_item_id, location_id);

drop trigger if exists location_task_drawings_set_updated_at on public.location_task_drawings;
create trigger location_task_drawings_set_updated_at before update on public.location_task_drawings
  for each row execute function private.set_updated_at();

alter table public.location_task_drawings enable row level security;
drop policy if exists location_task_drawings_select on public.location_task_drawings;
drop policy if exists location_task_drawings_insert on public.location_task_drawings;
drop policy if exists location_task_drawings_update on public.location_task_drawings;
drop policy if exists location_task_drawings_delete on public.location_task_drawings;
create policy location_task_drawings_select on public.location_task_drawings for select to authenticated using (private.can_access_project(project_id));
create policy location_task_drawings_insert on public.location_task_drawings for insert to authenticated with check (private.can_manage_project(project_id));
create policy location_task_drawings_update on public.location_task_drawings for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy location_task_drawings_delete on public.location_task_drawings for delete to authenticated using (private.can_manage_project(project_id));

notify pgrst, 'reload schema';

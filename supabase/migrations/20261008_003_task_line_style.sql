-- Task lines (RitsuScope › Tarefas) are stored by the face they lie against and the side they go
-- (like walls drawn by their face), so the band can be drawn at any thickness and still touch the face.
--   location_task_drawings.side : +1 / -1, the side of points[0]→points[1] the band goes (null = centred)
-- Each activity's planning style (shared by every location and the field sheets):
--   project_scopes.plan_style   : { "thickness_m": 0.10, "transparency": 0 … 0.9, "color": "#E11D48" }
-- Additive only.
alter table public.location_task_drawings add column if not exists side smallint check (side is null or side in (-1, 1));
alter table public.project_scopes add column if not exists plan_style jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

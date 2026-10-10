-- Projects › Scope ← RitsuScope: lines imported from the takeoff remember where they came from, so a
-- re-import updates their quantities instead of adding duplicates, and the Scope page can show the
-- quantity as "from RitsuScope" (read-only).
--   takeoff_layer_id : the RitsuScope item (wall type / area / count layer) the line was built from
--   takeoff_step     : which line of that item ('scope', 'framing', 'board_a', 'joints_a',
--                      'insulation', 'board_b', 'joints_b', 'measure')
-- If the RitsuScope item is deleted the line stays in the register, unlinked (on delete set null).
-- Additive only.
alter table public.project_scopes
  add column if not exists takeoff_layer_id uuid references public.takeoff_layers(id) on delete set null,
  add column if not exists takeoff_step text;

create unique index if not exists project_scopes_takeoff_line_uidx
  on public.project_scopes (takeoff_layer_id, takeoff_step)
  where takeoff_layer_id is not null;

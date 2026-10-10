-- Task labels as callouts (RitsuScope › Tarefas): the label sits apart from its line with a leader line.
-- Placed automatically so labels do not overlap; when the user drags one, its centre is kept here:
--   location_task_drawings.label_at : [x, y] in sheet points, or null = automatic.
-- Additive only.
alter table public.location_task_drawings add column if not exists label_at jsonb
  check (label_at is null or (jsonb_typeof(label_at) = 'array' and jsonb_array_length(label_at) = 2));

notify pgrst, 'reload schema';

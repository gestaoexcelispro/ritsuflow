-- Task lines (RitsuScope › Tarefas) carry a tag, so each one can be found later on the drawings, the
-- field sheets and in reports: T<scope code>-<nn> (e.g. T1.1-01), numbered per scope item in the order
-- drawn and never reused. Existing lines are numbered here. Additive only.
alter table public.location_task_drawings add column if not exists tag text;

with numbered as (
  select d.id, 'T' || coalesce(nullif(p.scope_code, ''), 'X') || '-' || lpad(row_number() over (partition by d.scope_item_id order by d.created_at, d.id)::text, 2, '0') as tag
  from public.location_task_drawings d
  join public.project_scopes p on p.id = d.scope_item_id
  where d.tag is null
)
update public.location_task_drawings d set tag = n.tag from numbered n where n.id = d.id;

create unique index if not exists location_task_drawings_tag_uidx on public.location_task_drawings (project_id, tag) where tag is not null;

notify pgrst, 'reload schema';

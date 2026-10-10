-- RitsuScope: tags renamed by the user for each straight stretch (segment) of a drawn element.
-- One entry per segment (points[i] -> points[i+1]); null or missing = automatic tag (e.g. DW01-03),
-- which the app computes, so nothing else needs to be stored. Safe to run more than once.
alter table public.takeoff_elements
  add column if not exists segment_tags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'takeoff_elements_segment_tags_array') then
    alter table public.takeoff_elements
      add constraint takeoff_elements_segment_tags_array check (jsonb_typeof(segment_tags) = 'array');
  end if;
end $$;

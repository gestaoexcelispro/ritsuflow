-- RitsuScope: ceiling types (CL01…) and floor types (FL01…) live in the wall-type library with
-- categories 'ceiling' and 'floor'. Their build-up is stored in framing.ceiling / framing.floor; layers
-- drawn from them are areas (IfcCovering.CEILING / IfcCovering.FLOORING) linked by takeoff_layers.wall_type_id.
-- Only the category check changes. Safe to run more than once.
do $$
declare
  c record;
begin
  -- Drop the existing category check, whatever name Postgres gave it.
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.takeoff_wall_types'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table public.takeoff_wall_types drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.takeoff_wall_types
  add constraint takeoff_wall_types_category_check
  check (category in ('non_rated', 'rated', 'shaft', 'furring', 'chase', 'exterior', 'other', 'ceiling', 'floor'));

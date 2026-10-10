-- PreCon by location: a Weekly plan item can name the real location and the company work package it is
-- for, so its planned / actual quantity is "Room 7 · BRD · 28 m²" instead of free text. This feeds:
--   * the Weekly plan: rows suggested per location × work package with the quantities from RitsuScope
--     Tasks (face / carrier allocation);
--   * the Lookahead: the Koskela "Predecessor" auto-check (a package in a location is released when its
--     predecessors are done there, or in the room that carries its walls).
-- Both columns are optional: existing items (free-text location) keep working. After the plan is
-- committed they are frozen like the other commitment fields. Additive and safe to run more than once.

alter table public.weekly_plan_items
  add column if not exists location_id uuid references public.locations(id) on delete set null,
  add column if not exists organization_work_package_id uuid references public.organization_work_packages(id) on delete set null;

create index if not exists weekly_plan_items_location_package_idx
  on public.weekly_plan_items (project_id, location_id, organization_work_package_id)
  where location_id is not null;

-- The location must belong to the item's project; both are frozen once the plan is committed.
create or replace function public.validate_weekly_plan_item_location_package()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
begin
  if new.location_id is not null
     and not exists (select 1 from public.locations l where l.id = new.location_id and l.project_id = new.project_id) then
    raise exception 'The location belongs to a different project.';
  end if;

  if tg_op = 'UPDATE'
     and (new.location_id is distinct from old.location_id
          or new.organization_work_package_id is distinct from old.organization_work_package_id) then
    select status into parent_status from public.weekly_plans where id = old.weekly_plan_id;
    if parent_status in ('committed', 'closed') then
      raise exception 'Original Weekly Plan commitment fields cannot be changed after the plan is committed.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_weekly_plan_item_location_package on public.weekly_plan_items;
create trigger trg_validate_weekly_plan_item_location_package
  before insert or update of location_id, organization_work_package_id, project_id on public.weekly_plan_items
  for each row execute function public.validate_weekly_plan_item_location_package();

notify pgrst, 'reload schema';

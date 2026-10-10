-- R3 · Master plan save updates packages in place
-- The Master plan screen saved by deleting every package of the scenario and
-- inserting them again. Lookahead items point at those packages with
-- ON DELETE RESTRICT, so once a Lookahead existed the save failed; constraints,
-- weekly items and production activities lost their link (ON DELETE SET NULL).
--
-- Now one database call saves the whole scenario in a single transaction:
--   * each package keeps its database id (matched by the screen's package key,
--     ui_key; legacy rows without a key are matched once by row + package code);
--   * changed fields are updated, new packages inserted;
--   * packages no longer in the plan are deleted; Lookahead items that pointed
--     at them are removed first and counted, so the screen can say so;
--   * the dependency network is rebuilt.
-- It runs as the calling user (security invoker): existing row rules apply.

begin;

alter table public.master_plan_packages
  add column if not exists ui_key text;

create unique index if not exists master_plan_packages_scenario_ui_key_idx
  on public.master_plan_packages (scenario_id, ui_key)
  where ui_key is not null;

create or replace function public.save_master_plan_packages(
  target_scenario_id uuid,
  target_packages jsonb,
  target_dependencies jsonb default '[]'::jsonb
)
returns table (
  ui_key text,
  package_id uuid,
  inserted_count integer,
  updated_count integer,
  deleted_count integer,
  removed_lookahead_items integer
)
language plpgsql
security invoker
set search_path to ''
as $$
#variable_conflict use_column
declare
  v_project_id uuid;
  v_pkg jsonb;
  v_key text;
  v_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_deleted integer := 0;
  v_removed_items integer := 0;
  v_fallback_start date;
begin
  select s.project_id into v_project_id
  from public.master_plan_scenarios s
  where s.id = target_scenario_id;

  if v_project_id is null then
    raise exception 'Master Plan scenario % was not found.', target_scenario_id;
  end if;

  if jsonb_typeof(coalesce(target_packages, '[]'::jsonb)) <> 'array' then
    raise exception 'target_packages must be a JSON array.';
  end if;

  create temporary table if not exists pg_temp.mp_key_map (
    ui_key text primary key,
    package_id uuid not null
  ) on commit drop;
  truncate pg_temp.mp_key_map;

  -- 1. Dependencies are rebuilt at the end.
  delete from public.master_plan_package_dependencies d
  where d.scenario_id = target_scenario_id;

  -- 2. Upsert every package with a plain date start (predecessors come in step 3,
  --    once every package exists).
  for v_pkg in select value from jsonb_array_elements(coalesce(target_packages, '[]'::jsonb))
  loop
    v_key := nullif(trim(v_pkg ->> 'ui_key'), '');
    if v_key is null then
      raise exception 'Every Master Plan package needs a ui_key.';
    end if;

    v_fallback_start := coalesce(
      nullif(v_pkg ->> 'planned_start_date', '')::date,
      nullif(v_pkg ->> 'scheduled_start_date', '')::date,
      current_date
    );

    select p.id into v_id
    from public.master_plan_packages p
    where p.scenario_id = target_scenario_id and p.ui_key = v_key;

    if v_id is null then
      -- Legacy row saved before ui_key existed: match once by row + code.
      select p.id into v_id
      from public.master_plan_packages p
      where p.scenario_id = target_scenario_id
        and p.ui_key is null
        and p.row_key is not distinct from nullif(v_pkg ->> 'row_key', '')
        and p.package_code is not distinct from upper(left(trim(nullif(v_pkg ->> 'package_code', '')), 3))
      order by p.created_at
      limit 1;
    end if;

    if v_id is null then
      insert into public.master_plan_packages (
        scenario_id, project_id, ui_key, location_id, project_service_id, row_key,
        package_code, location_name, location_path, service_name, service_code, unit,
        start_rule, planned_start_date, predecessor_package_id,
        duration_working_days, lag_working_days, manual_delay_working_days,
        scheduled_start_date, scheduled_finish_date, sequence_group_id, sequence_number
      ) values (
        target_scenario_id, v_project_id, v_key,
        nullif(v_pkg ->> 'location_id', '')::uuid,
        nullif(v_pkg ->> 'project_service_id', '')::uuid,
        nullif(v_pkg ->> 'row_key', ''),
        nullif(v_pkg ->> 'package_code', ''),
        nullif(v_pkg ->> 'location_name', ''),
        nullif(v_pkg ->> 'location_path', ''),
        nullif(v_pkg ->> 'service_name', ''),
        nullif(v_pkg ->> 'service_code', ''),
        nullif(v_pkg ->> 'unit', ''),
        'date', v_fallback_start, null,
        greatest(1, coalesce((v_pkg ->> 'duration_working_days')::integer, 1)),
        greatest(0, coalesce((v_pkg ->> 'lag_working_days')::integer, 0)),
        greatest(0, coalesce((v_pkg ->> 'manual_delay_working_days')::integer, 0)),
        nullif(v_pkg ->> 'scheduled_start_date', '')::date,
        nullif(v_pkg ->> 'scheduled_finish_date', '')::date,
        nullif(v_pkg ->> 'sequence_group_id', ''),
        greatest(0, coalesce((v_pkg ->> 'sequence_number')::integer, 0))
      )
      returning id into v_id;
      v_inserted := v_inserted + 1;
    else
      update public.master_plan_packages p set
        ui_key = v_key,
        location_id = nullif(v_pkg ->> 'location_id', '')::uuid,
        project_service_id = nullif(v_pkg ->> 'project_service_id', '')::uuid,
        row_key = nullif(v_pkg ->> 'row_key', ''),
        package_code = nullif(v_pkg ->> 'package_code', ''),
        location_name = nullif(v_pkg ->> 'location_name', ''),
        location_path = nullif(v_pkg ->> 'location_path', ''),
        service_name = nullif(v_pkg ->> 'service_name', ''),
        service_code = nullif(v_pkg ->> 'service_code', ''),
        unit = nullif(v_pkg ->> 'unit', ''),
        start_rule = 'date',
        planned_start_date = v_fallback_start,
        predecessor_package_id = null,
        duration_working_days = greatest(1, coalesce((v_pkg ->> 'duration_working_days')::integer, 1)),
        lag_working_days = greatest(0, coalesce((v_pkg ->> 'lag_working_days')::integer, 0)),
        manual_delay_working_days = greatest(0, coalesce((v_pkg ->> 'manual_delay_working_days')::integer, 0)),
        scheduled_start_date = nullif(v_pkg ->> 'scheduled_start_date', '')::date,
        scheduled_finish_date = nullif(v_pkg ->> 'scheduled_finish_date', '')::date,
        sequence_group_id = nullif(v_pkg ->> 'sequence_group_id', ''),
        sequence_number = greatest(0, coalesce((v_pkg ->> 'sequence_number')::integer, 0)),
        updated_by = auth.uid()
      where p.id = v_id;
      v_updated := v_updated + 1;
    end if;

    insert into pg_temp.mp_key_map (ui_key, package_id) values (v_key, v_id)
    on conflict on constraint mp_key_map_pkey do update set package_id = excluded.package_id;
  end loop;

  -- 3. Controlling predecessor and the final start rule.
  update public.master_plan_packages p set
    start_rule = 'predecessor',
    predecessor_package_id = pred.package_id,
    planned_start_date = null
  from jsonb_array_elements(coalesce(target_packages, '[]'::jsonb)) src(value)
  join pg_temp.mp_key_map self on self.ui_key = trim(src.value ->> 'ui_key')
  join pg_temp.mp_key_map pred on pred.ui_key = trim(src.value ->> 'predecessor_ui_key')
  where p.id = self.package_id
    and pred.package_id <> self.package_id;

  -- 4. Packages no longer in the plan. Lookahead items that pointed at them go
  --    first (they would block the delete).
  delete from public.lookahead_work_items wi
  using public.master_plan_packages p
  where wi.master_plan_package_id = p.id
    and p.scenario_id = target_scenario_id
    and not exists (select 1 from pg_temp.mp_key_map m where m.package_id = p.id);
  get diagnostics v_removed_items = row_count;

  delete from public.master_plan_packages p
  where p.scenario_id = target_scenario_id
    and not exists (select 1 from pg_temp.mp_key_map m where m.package_id = p.id);
  get diagnostics v_deleted = row_count;

  -- 5. Full multi-predecessor network.
  insert into public.master_plan_package_dependencies (
    scenario_id, project_id, package_id, predecessor_package_id, dependency_type, lag_working_days
  )
  select distinct on (self.package_id, pred.package_id)
    target_scenario_id, v_project_id, self.package_id, pred.package_id,
    case when d.value ->> 'dependency_type' in ('trade', 'flow', 'external')
         then d.value ->> 'dependency_type' else 'external' end,
    greatest(0, coalesce((d.value ->> 'lag_working_days')::integer, 0))
  from jsonb_array_elements(coalesce(target_dependencies, '[]'::jsonb)) d(value)
  join pg_temp.mp_key_map self on self.ui_key = trim(d.value ->> 'ui_key')
  join pg_temp.mp_key_map pred on pred.ui_key = trim(d.value ->> 'predecessor_ui_key')
  where self.package_id <> pred.package_id;

  return query
    select m.ui_key, m.package_id, v_inserted, v_updated, v_deleted, v_removed_items
    from pg_temp.mp_key_map m;

  if not found then
    return query select null::text, null::uuid, v_inserted, v_updated, v_deleted, v_removed_items;
  end if;
end;
$$;

revoke all on function public.save_master_plan_packages(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_master_plan_packages(uuid, jsonb, jsonb) to authenticated;

commit;

-- R2 · Create Lookahead from baseline
-- Until now no screen created a Lookahead plan: materialize_lookahead_plan_packages
-- existed but was never called, and nothing created the package_group sheet rows
-- the Lookahead sheet shows. Two functions close the gap:
--
--   refresh_lookahead_from_baseline(plan)  pulls the baseline packages that fall in
--       the plan's window (never duplicates, never resets existing items) and adds a
--       package_group sheet row for every package code that has none yet.
--   create_lookahead_plan_from_baseline(project, start, weeks, name)  creates an
--       active plan on the project's frozen baseline (the previous active plan is
--       closed) and refreshes it, all in one transaction.
--
-- Both run as the calling user (security invoker), so the existing row rules on
-- lookahead_plans / lookahead_work_items / lookahead_sheet_rows still decide.

begin;

create or replace function public.refresh_lookahead_from_baseline(
  target_lookahead_plan_id uuid
)
returns table (added_items integer, added_rows integer)
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_items integer := 0;
  v_rows integer := 0;
  v_next_order numeric;
begin
  if not exists (select 1 from public.lookahead_plans where id = target_lookahead_plan_id) then
    raise exception 'Lookahead plan % was not found.', target_lookahead_plan_id;
  end if;

  v_items := public.materialize_lookahead_plan_packages(target_lookahead_plan_id);

  select coalesce(max(r.row_order), 0) into v_next_order
  from public.lookahead_sheet_rows r
  where r.lookahead_plan_id = target_lookahead_plan_id;

  with codes as (
    select upper(trim(coalesce(wi.package_code, mp.package_code::text))) as code,
           min(mp.scheduled_start_date) as first_start
    from public.lookahead_work_items wi
    join public.master_plan_packages mp on mp.id = wi.master_plan_package_id
    where wi.lookahead_plan_id = target_lookahead_plan_id
    group by 1
  ),
  missing as (
    select c.code, c.first_start
    from codes c
    where c.code is not null and c.code <> ''
      and not exists (
        select 1 from public.lookahead_sheet_rows r
        where r.lookahead_plan_id = target_lookahead_plan_id
          and r.row_type = 'package_group'
          and upper(trim(r.package_code)) = c.code
      )
  )
  insert into public.lookahead_sheet_rows (lookahead_plan_id, row_type, package_code, row_order)
  select target_lookahead_plan_id,
         'package_group',
         m.code,
         v_next_order + row_number() over (order by m.first_start, m.code)
  from missing m;

  get diagnostics v_rows = row_count;

  return query select v_items, v_rows;
end;
$$;

create or replace function public.create_lookahead_plan_from_baseline(
  target_project_id uuid,
  target_window_start date,
  target_horizon_weeks integer default 6,
  target_name text default null
)
returns table (lookahead_plan_id uuid, added_items integer, added_rows integer)
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_scenario_id uuid;
  v_plan_id uuid;
  v_name text;
  v_items integer;
  v_rows integer;
begin
  if target_window_start is null then
    raise exception 'A window start date is required.';
  end if;
  if target_horizon_weeks is null or target_horizon_weeks < 1 or target_horizon_weeks > 26 then
    raise exception 'The horizon must be between 1 and 26 weeks.';
  end if;

  select s.id into v_scenario_id
  from public.master_plan_scenarios s
  where s.project_id = target_project_id and s.is_baseline = true
  order by s.updated_at desc
  limit 1;

  if v_scenario_id is null then
    raise exception 'NO_BASELINE: freeze a Master plan baseline for this project first.';
  end if;

  v_name := nullif(trim(coalesce(target_name, '')), '');
  if v_name is null then
    v_name := 'Lookahead ' || to_char(target_window_start, 'YYYY-MM-DD');
  end if;

  update public.lookahead_plans
     set status = 'closed', updated_at = now()
   where project_id = target_project_id and status = 'active';

  insert into public.lookahead_plans (
    project_id, master_plan_scenario_id, name,
    window_start_date, horizon_weeks, window_finish_date, status
  ) values (
    target_project_id, v_scenario_id, v_name,
    target_window_start, target_horizon_weeks,
    target_window_start + (target_horizon_weeks * 7 - 1), 'active'
  )
  returning id into v_plan_id;

  select r.added_items, r.added_rows into v_items, v_rows
  from public.refresh_lookahead_from_baseline(v_plan_id) r;

  return query select v_plan_id, v_items, v_rows;
end;
$$;

revoke all on function public.refresh_lookahead_from_baseline(uuid) from public, anon;
revoke all on function public.create_lookahead_plan_from_baseline(uuid, date, integer, text) from public, anon;
grant execute on function public.refresh_lookahead_from_baseline(uuid) to authenticated;
grant execute on function public.create_lookahead_plan_from_baseline(uuid, date, integer, text) to authenticated;

commit;

-- RitsuFlow FieldOp — Daily Report production integrity hardening
-- One FieldOp projection row per report/location/service and server-side scope protection.

create unique index if not exists daily_report_production_fieldop_identity_uidx
  on public.daily_report_production(daily_report_id, location_id, project_service_id)
  where source = 'fieldop_execution';

create or replace function public.validate_daily_report_fieldop_production()
returns trigger
language plpgsql
as $$
declare
  v_report_project_id uuid;
  v_report_date date;
  v_scope_quantity numeric;
  v_previous_quantity numeric;
  v_expected_cumulative numeric;
begin
  if new.source is distinct from 'fieldop_execution' then
    return new;
  end if;

  if new.actual_quantity is null or new.actual_quantity < 0 then
    raise exception 'FieldOp Daily Report actual quantity must be zero or greater.';
  end if;

  select project_id, report_date
    into v_report_project_id, v_report_date
  from public.daily_reports
  where id = new.daily_report_id;

  if not found then
    raise exception 'Daily Report % was not found.', new.daily_report_id;
  end if;

  select quantity
    into v_scope_quantity
  from public.location_service_quantities
  where location_id = new.location_id
    and service_id = new.project_service_id;

  select coalesce(sum(drp.actual_quantity), 0)
    into v_previous_quantity
  from public.daily_report_production drp
  join public.daily_reports dr on dr.id = drp.daily_report_id
  where dr.project_id = v_report_project_id
    and dr.report_date < v_report_date
    and drp.location_id = new.location_id
    and drp.project_service_id = new.project_service_id;

  v_expected_cumulative := v_previous_quantity + new.actual_quantity;

  if v_scope_quantity is not null and v_expected_cumulative > v_scope_quantity then
    raise exception 'FieldOp production exceeds the configured location/service scope quantity.';
  end if;

  new.cumulative_quantity := v_expected_cumulative;

  if v_scope_quantity is not null and v_expected_cumulative >= v_scope_quantity then
    new.production_status := 'completed';
  elsif new.actual_quantity > 0 then
    new.production_status := 'in_progress';
  else
    new.production_status := 'not_started';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_report_production_validate_fieldop
  on public.daily_report_production;

create trigger daily_report_production_validate_fieldop
before insert or update on public.daily_report_production
for each row
execute function public.validate_daily_report_fieldop_production();

comment on function public.validate_daily_report_fieldop_production() is
  'Protects FieldOp-generated Daily Report production against duplicates, negative quantities and cumulative scope overruns.';

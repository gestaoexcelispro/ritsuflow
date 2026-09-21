-- RitsuFlow Project History extension: Daily Report header lifecycle.
--
-- IMPORTANT:
-- Project History already exists as a platform audit layer. This migration extends
-- that architecture; it does not create a competing event store.
-- Every persisted INSERT / UPDATE / DELETE on daily_reports creates an immutable
-- project_history entry. UPDATE metadata records before/after values.

create or replace function public.audit_daily_report_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  changes jsonb := '{}'::jsonb;
  k text;
  ov jsonb;
  nv jsonb;
  ignored text[] := array['updated_at'];
  report_label text;
begin
  uname := public.project_history_actor_name(uid);

  if tg_op = 'INSERT' then
    report_label := 'DR-' || lpad(new.report_number::text, 4, '0');

    insert into public.project_history(
      project_id, action_type, action_label, description,
      entity_type, entity_id, performed_by, performed_by_name, metadata
    ) values (
      new.project_id,
      'daily_report_created',
      'Daily Report created',
      report_label || ' · ' || new.report_date::text,
      'daily_report',
      new.id::text,
      coalesce(uid, new.created_by),
      uname,
      jsonb_build_object(
        'report_number', new.report_number,
        'report_date', new.report_date,
        'status', new.status
      )
    );

    return new;
  elsif tg_op = 'UPDATE' then
    report_label := 'DR-' || lpad(new.report_number::text, 4, '0');

    for k, ov in select key, value from jsonb_each(to_jsonb(old)) loop
      if not (k = any(ignored)) then
        nv := to_jsonb(new)->k;
        if ov is distinct from nv then
          changes := changes || jsonb_build_object(
            k,
            jsonb_build_object('from', ov, 'to', nv)
          );
        end if;
      end if;
    end loop;

    if changes <> '{}'::jsonb then
      insert into public.project_history(
        project_id, action_type, action_label, description,
        entity_type, entity_id, performed_by, performed_by_name, metadata
      ) values (
        new.project_id,
        case
          when old.status is distinct from new.status then 'daily_report_status_changed'
          else 'daily_report_updated'
        end,
        case
          when old.status is distinct from new.status then 'Daily Report status changed'
          else 'Daily Report updated'
        end,
        report_label || ' · ' || new.report_date::text,
        'daily_report',
        new.id::text,
        uid,
        uname,
        jsonb_build_object(
          'report_number', new.report_number,
          'report_date', new.report_date,
          'changes', changes
        )
      );
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    report_label := 'DR-' || lpad(old.report_number::text, 4, '0');

    insert into public.project_history(
      project_id, action_type, action_label, description,
      entity_type, entity_id, performed_by, performed_by_name, metadata
    ) values (
      old.project_id,
      'daily_report_deleted',
      'Daily Report deleted',
      report_label || ' · ' || old.report_date::text,
      'daily_report',
      old.id::text,
      uid,
      uname,
      jsonb_build_object(
        'report_number', old.report_number,
        'report_date', old.report_date,
        'status', old.status
      )
    );

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_daily_reports on public.daily_reports;

create trigger trg_audit_daily_reports
after insert or update or delete on public.daily_reports
for each row execute function public.audit_daily_report_change();

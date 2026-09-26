create table if not exists public.fieldop_daily_report_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  capture_weather boolean not null default true,
  capture_workforce boolean not null default true,
  capture_progress boolean not null default true,
  capture_equipment boolean not null default true,
  capture_materials boolean not null default true,
  capture_occurrences boolean not null default true,
  capture_photos boolean not null default true,
  capture_general_notes boolean not null default true,
  require_signature boolean not null default false,
  require_approval boolean not null default false,
  report_cutoff_time time not null default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fieldop_daily_report_settings enable row level security;

drop policy if exists "Authenticated users can read FieldOp daily report settings" on public.fieldop_daily_report_settings;
create policy "Authenticated users can read FieldOp daily report settings" on public.fieldop_daily_report_settings for select to authenticated using (true);
drop policy if exists "Authenticated users can insert FieldOp daily report settings" on public.fieldop_daily_report_settings;
create policy "Authenticated users can insert FieldOp daily report settings" on public.fieldop_daily_report_settings for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update FieldOp daily report settings" on public.fieldop_daily_report_settings;
create policy "Authenticated users can update FieldOp daily report settings" on public.fieldop_daily_report_settings for update to authenticated using (true) with check (true);

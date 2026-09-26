-- Align FieldOp Daily Report Settings persistence with the canonical UI model.
-- Safe to run against an existing fieldop_daily_report_settings table.

create table if not exists public.fieldop_daily_report_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fieldop_daily_report_settings
  add column if not exists capture_weather boolean not null default true,
  add column if not exists capture_workforce boolean not null default true,
  add column if not exists capture_progress boolean not null default true,
  add column if not exists capture_equipment boolean not null default true,
  add column if not exists capture_materials boolean not null default true,
  add column if not exists capture_occurrences boolean not null default true,
  add column if not exists capture_photos boolean not null default true,
  add column if not exists capture_general_notes boolean not null default true,
  add column if not exists require_signature boolean not null default false,
  add column if not exists require_approval boolean not null default false,
  add column if not exists report_cutoff_time time not null default '17:00',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

comment on table public.fieldop_daily_report_settings is
  'Project-specific FieldOp Daily Report content, workflow, and reporting rules.';

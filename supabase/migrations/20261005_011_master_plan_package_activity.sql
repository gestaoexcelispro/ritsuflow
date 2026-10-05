-- PreCon P4a: Master Plan schedules the project's activities from Projects › Scope.

-- Each Master Plan package can point to the project activity it schedules.
-- project_service_id (old model) stays as it is, unused, so nothing that reads it breaks.
alter table public.master_plan_packages
  add column if not exists activity_id uuid
  references public.fieldop_project_activities(id) on delete set null;

create index if not exists master_plan_packages_activity_id_idx
  on public.master_plan_packages (activity_id);

comment on column public.master_plan_packages.activity_id is
  'Project activity (fieldop_project_activities, from Projects scope) scheduled by this package.';

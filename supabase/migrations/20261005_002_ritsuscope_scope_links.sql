-- RitsuScope → Scope Allocation: each RitsuScope item (takeoff layer) can feed one scope activity
-- of the project (fieldop_project_activities). The Location Breakdown's Scope Allocation uses it to
-- split the item's quantities over the locations drawn in RitsuScope. Additive only.
alter table public.takeoff_layers
  add column if not exists scope_activity_id uuid references public.fieldop_project_activities(id) on delete set null;

create index if not exists takeoff_layers_scope_activity_idx on public.takeoff_layers (scope_activity_id);

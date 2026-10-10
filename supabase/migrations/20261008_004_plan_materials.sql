-- Materials of planned tasks (RitsuScope › Tarefas). Profiles, boards, screws and insulation come from the
-- framing layout of the wall each task line lies on; what the layout does not count (joint compound,
-- tape, anchors, sealant…) comes from consumption rates per activity:
--   project_scopes.plan_materials : [{ "name", "unit", "per": "m2" | "m" | "un", "coef", "waste", "packSize", "packName" }]
-- Additive only.
alter table public.project_scopes add column if not exists plan_materials jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';

-- R1 · Constraints write rule uses constraints.edit
-- The write policies on public.constraints asked for a permission called 'write',
-- which does not exist in private.rbac_permissions, so every insert, update and
-- delete was refused (manual create, edit, "Send to Constraints").
-- They now use constraints.edit / constraints.view, like the child tables.
-- constraint_affected_work was open to anyone who could see the parent row;
-- it now follows the same rule.

begin;

drop policy if exists constraints_project_select on public.constraints;
drop policy if exists constraints_project_insert on public.constraints;
drop policy if exists constraints_project_update on public.constraints;
drop policy if exists constraints_project_delete on public.constraints;

create policy constraints_project_select on public.constraints
  for select to authenticated
  using (private.rbac_can_project_action(project_id, 'constraints.view'));

create policy constraints_project_insert on public.constraints
  for insert to authenticated
  with check (private.rbac_can_project_action(project_id, 'constraints.edit'));

create policy constraints_project_update on public.constraints
  for update to authenticated
  using (private.rbac_can_project_action(project_id, 'constraints.edit'))
  with check (private.rbac_can_project_action(project_id, 'constraints.edit'));

create policy constraints_project_delete on public.constraints
  for delete to authenticated
  using (private.rbac_can_project_action(project_id, 'constraints.edit'));

drop policy if exists constraint_affected_work_select on public.constraint_affected_work;
drop policy if exists constraint_affected_work_insert on public.constraint_affected_work;
drop policy if exists constraint_affected_work_update on public.constraint_affected_work;
drop policy if exists constraint_affected_work_delete on public.constraint_affected_work;

create policy constraint_affected_work_select on public.constraint_affected_work
  for select to authenticated
  using (exists (select 1 from public.constraints c
                 where c.id = constraint_affected_work.constraint_id
                   and private.rbac_can_project_action(c.project_id, 'constraints.view')));

create policy constraint_affected_work_insert on public.constraint_affected_work
  for insert to authenticated
  with check (exists (select 1 from public.constraints c
                      where c.id = constraint_affected_work.constraint_id
                        and private.rbac_can_project_action(c.project_id, 'constraints.edit')));

create policy constraint_affected_work_update on public.constraint_affected_work
  for update to authenticated
  using (exists (select 1 from public.constraints c
                 where c.id = constraint_affected_work.constraint_id
                   and private.rbac_can_project_action(c.project_id, 'constraints.edit')))
  with check (exists (select 1 from public.constraints c
                      where c.id = constraint_affected_work.constraint_id
                        and private.rbac_can_project_action(c.project_id, 'constraints.edit')));

create policy constraint_affected_work_delete on public.constraint_affected_work
  for delete to authenticated
  using (exists (select 1 from public.constraints c
                 where c.id = constraint_affected_work.constraint_id
                   and private.rbac_can_project_action(c.project_id, 'constraints.edit')));

commit;

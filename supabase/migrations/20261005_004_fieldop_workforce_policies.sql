-- FieldOp workforce: replace the temporary "any signed-in user" policies.
--
-- 1) fieldop_manual_workers used `using (true)` for read, insert, update and delete, so any
--    signed-in user of any company could see and change every project's manual workers.
--    It now follows the same per-project permissions as the other FieldOp setup tables.
-- 2) field_attendance_corrections allowed any signed-in user to read every company's rows
--    and to insert rows. Reading now needs organization membership and project access;
--    writing needs permission to manage the organization and access to the project.
--    (Corrections are currently recorded as attendance events; this table has no writer.)

-- 1) Manual workers -----------------------------------------------------------------------

drop policy if exists "Authenticated users can read FieldOp manual workers" on public.fieldop_manual_workers;
drop policy if exists "Authenticated users can insert FieldOp manual workers" on public.fieldop_manual_workers;
drop policy if exists "Authenticated users can update FieldOp manual workers" on public.fieldop_manual_workers;
drop policy if exists "Authenticated users can delete FieldOp manual workers" on public.fieldop_manual_workers;

drop policy if exists fieldop_manual_workers_select on public.fieldop_manual_workers;
create policy fieldop_manual_workers_select
  on public.fieldop_manual_workers for select to authenticated
  using (private.rbac_can_project_action(project_id, 'projects.view'));

drop policy if exists fieldop_manual_workers_insert on public.fieldop_manual_workers;
create policy fieldop_manual_workers_insert
  on public.fieldop_manual_workers for insert to authenticated
  with check (private.rbac_can_project_action(project_id, 'projects.edit'));

drop policy if exists fieldop_manual_workers_update on public.fieldop_manual_workers;
create policy fieldop_manual_workers_update
  on public.fieldop_manual_workers for update to authenticated
  using (private.rbac_can_project_action(project_id, 'projects.edit'))
  with check (private.rbac_can_project_action(project_id, 'projects.edit'));

drop policy if exists fieldop_manual_workers_delete on public.fieldop_manual_workers;
create policy fieldop_manual_workers_delete
  on public.fieldop_manual_workers for delete to authenticated
  using (private.rbac_can_project_action(project_id, 'projects.edit'));

-- 2) Attendance corrections ---------------------------------------------------------------

drop policy if exists field_attendance_corrections_select_authenticated on public.field_attendance_corrections;
drop policy if exists field_attendance_corrections_insert_authenticated on public.field_attendance_corrections;

drop policy if exists field_attendance_corrections_select on public.field_attendance_corrections;
create policy field_attendance_corrections_select
  on public.field_attendance_corrections for select to authenticated
  using (private.is_organization_member(organization_id) and private.can_access_project(project_id));

drop policy if exists field_attendance_corrections_insert on public.field_attendance_corrections;
create policy field_attendance_corrections_insert
  on public.field_attendance_corrections for insert to authenticated
  with check (
    private.can_manage_organization(organization_id)
    and private.can_access_project(project_id)
    and corrected_by = auth.uid()
  );

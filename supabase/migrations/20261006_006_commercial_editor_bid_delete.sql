-- Commercial editors may delete a bid they created while it is still a bid (lets "New bid" undo a
-- half-made bid when a step fails). Contract projects are never affected.
drop policy if exists projects_delete_commercial_bid on public.projects;
create policy projects_delete_commercial_bid on public.projects for delete to authenticated
  using (stage = 'bid' and created_by = auth.uid() and private.is_commercial_editor(organization_id));

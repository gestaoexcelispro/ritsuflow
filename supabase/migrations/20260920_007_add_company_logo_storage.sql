-- Company logo storage for tenant branding
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read is intentional: organization logos are branding assets.
drop policy if exists "company_assets_public_read" on storage.objects;
create policy "company_assets_public_read"
on storage.objects for select
using (bucket_id = 'company-assets');

-- Files are stored as <organization_id>/logo.<ext>.
drop policy if exists "company_assets_admin_insert" on storage.objects;
create policy "company_assets_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin')
  )
);

drop policy if exists "company_assets_admin_update" on storage.objects;
create policy "company_assets_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin')
  )
)
with check (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin')
  )
);

drop policy if exists "company_assets_admin_delete" on storage.objects;
create policy "company_assets_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin')
  )
);

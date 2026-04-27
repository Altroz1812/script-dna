-- Public bucket for organization white-label logos
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Public read access (logos are shown in admin UI and white-label headers)
create policy "Public read org-logos"
  on storage.objects for select
  using (bucket_id = 'org-logos');

-- Authenticated users (Admin/SuperAdmin enforced in app) may upload
create policy "Authenticated upload org-logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'org-logos');

-- Authenticated users may replace/delete logos they uploaded; SuperAdmins
-- handle moderation through the existing admin tooling.
create policy "Authenticated update org-logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'org-logos');

create policy "Authenticated delete org-logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'org-logos');

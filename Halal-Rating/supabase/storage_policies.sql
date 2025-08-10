-- Create a storage bucket for event photos
insert into storage.buckets (id, name, public) values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

-- RLS policies for the bucket
create policy "Public read event photos"
on storage.objects for select
using (bucket_id = 'event-photos');

create policy "Admins upload event photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-photos' and public.is_admin());

-- Avatars bucket: allow any authenticated user to upload their own profile photo (no admin)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read avatars
create policy "Public read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

-- Any authenticated can upload to avatars
create policy "Authenticated upload avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars');

-- Owners can update/delete their own avatar files
create policy "Owner update avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and owner = auth.uid())
with check (bucket_id = 'avatars' and owner = auth.uid());

create policy "Owner delete avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and owner = auth.uid());



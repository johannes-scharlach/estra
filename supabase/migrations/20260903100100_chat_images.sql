-- Photos sent to the cook (ADR 9): a private bucket, objects named
-- <list_id>/<uuid>.<ext>. Members of the list upload and read; the message
-- part carries a signed URL that the API downloads for the model.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

create policy "members can upload chat images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and public.is_list_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members can read chat images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and public.is_list_member(((storage.foldername(name))[1])::uuid)
  );

-- Profile photos storage bucket.
--
-- V1 upload path: client compresses each image to ~200KB before upload. We
-- keep a 5MB ceiling as headroom for quality choices.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'photos',
    'photos',
    true,
    5242880, -- 5 MB
    array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS ----------------------------------------------------------------
-- Public read (CDN-backed). Writes scoped to folders named after the caller's
-- wallet address, e.g. `<wallet>/<uuid>.webp`.

drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read
    on storage.objects for select
    using (bucket_id = 'photos');

drop policy if exists photos_owner_insert on storage.objects;
create policy photos_owner_insert
    on storage.objects for insert
    with check (
        bucket_id = 'photos'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet_address')
    );

drop policy if exists photos_owner_update on storage.objects;
create policy photos_owner_update
    on storage.objects for update
    using (
        bucket_id = 'photos'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet_address')
    );

drop policy if exists photos_owner_delete on storage.objects;
create policy photos_owner_delete
    on storage.objects for delete
    using (
        bucket_id = 'photos'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet_address')
    );

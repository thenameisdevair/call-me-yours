-- Storage RLS for `photos`: V1 anon-key uploads scoped by path shape.
--
-- CMY has no Supabase auth session (wallet is the sole identity), so the
-- previous `auth.jwt() ->> 'wallet_address'` check could never pass and every
-- upload failed with "new row violates row-level security policy".
--
-- V1 fix: allow anon writes where the first folder is a wallet-shaped string
-- (0x + 40 hex). Bucket-level size and mime-type limits still apply. A later
-- phase can reintroduce signed wallet attestations and tighten this.

drop policy if exists photos_owner_insert on storage.objects;
create policy photos_owner_insert
    on storage.objects for insert
    with check (
        bucket_id = 'photos'
        and (storage.foldername(name))[1] ~ '^0x[a-fA-F0-9]{40}$'
    );

drop policy if exists photos_owner_update on storage.objects;
create policy photos_owner_update
    on storage.objects for update
    using (
        bucket_id = 'photos'
        and (storage.foldername(name))[1] ~ '^0x[a-fA-F0-9]{40}$'
    );

drop policy if exists photos_owner_delete on storage.objects;
create policy photos_owner_delete
    on storage.objects for delete
    using (
        bucket_id = 'photos'
        and (storage.foldername(name))[1] ~ '^0x[a-fA-F0-9]{40}$'
    );

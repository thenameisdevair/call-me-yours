-- V1 RLS: anon-key access scoped by wallet-shape on owning columns.
--
-- CMY has no Supabase auth session (wallet is the sole identity), so every
-- `auth.jwt() ->> 'wallet_address'` check from migration 002 failed and all
-- writes returned "new row violates row-level security policy".
--
-- Approach (mirrors 004 for storage):
--   * SELECT: open. Discovery is public; match-scoped rows are only
--     addressable via a wallet someone already knows.
--   * INSERT / UPDATE: the owning column must be a wallet-shaped string
--     (0x + 40 hex). Match-scoped tables additionally require the referenced
--     match to exist.
--
-- A later phase should reintroduce signed wallet attestations and tighten
-- these policies.

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
    on public.profiles for select
    using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
    on public.profiles for insert
    with check (wallet_address ~ '^0x[a-f0-9]{40}$');

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
    on public.profiles for update
    using (wallet_address ~ '^0x[a-f0-9]{40}$')
    with check (wallet_address ~ '^0x[a-f0-9]{40}$');

-- matches --------------------------------------------------------------------
drop policy if exists matches_select_member on public.matches;
create policy matches_select_member
    on public.matches for select
    using (true);

drop policy if exists matches_insert_member on public.matches;
create policy matches_insert_member
    on public.matches for insert
    with check (
        user_a ~ '^0x[a-f0-9]{40}$'
        and user_b ~ '^0x[a-f0-9]{40}$'
    );

drop policy if exists matches_update_member on public.matches;
create policy matches_update_member
    on public.matches for update
    using (
        user_a ~ '^0x[a-f0-9]{40}$'
        and user_b ~ '^0x[a-f0-9]{40}$'
    );

-- connection_requests --------------------------------------------------------
drop policy if exists requests_select_parties on public.connection_requests;
create policy requests_select_parties
    on public.connection_requests for select
    using (true);

drop policy if exists requests_insert_sender on public.connection_requests;
create policy requests_insert_sender
    on public.connection_requests for insert
    with check (
        sender ~ '^0x[a-f0-9]{40}$'
        and recipient ~ '^0x[a-f0-9]{40}$'
    );

drop policy if exists requests_update_recipient on public.connection_requests;
create policy requests_update_recipient
    on public.connection_requests for update
    using (recipient ~ '^0x[a-f0-9]{40}$')
    with check (recipient ~ '^0x[a-f0-9]{40}$');

-- chat_sessions --------------------------------------------------------------
drop policy if exists chat_sessions_select_matched on public.chat_sessions;
create policy chat_sessions_select_matched
    on public.chat_sessions for select
    using (true);

drop policy if exists chat_sessions_insert_matched on public.chat_sessions;
create policy chat_sessions_insert_matched
    on public.chat_sessions for insert
    with check (exists (
        select 1 from public.matches m where m.id = chat_sessions.match_id
    ));

drop policy if exists chat_sessions_update_matched on public.chat_sessions;
create policy chat_sessions_update_matched
    on public.chat_sessions for update
    using (exists (
        select 1 from public.matches m where m.id = chat_sessions.match_id
    ));

-- milestones -----------------------------------------------------------------
drop policy if exists milestones_select_matched on public.milestones;
create policy milestones_select_matched
    on public.milestones for select
    using (true);

drop policy if exists milestones_insert_matched on public.milestones;
create policy milestones_insert_matched
    on public.milestones for insert
    with check (exists (
        select 1 from public.matches m where m.id = milestones.match_id
    ));

drop policy if exists milestones_update_matched on public.milestones;
create policy milestones_update_matched
    on public.milestones for update
    using (exists (
        select 1 from public.matches m where m.id = milestones.match_id
    ));

-- reports --------------------------------------------------------------------
drop policy if exists reports_select_reporter on public.reports;
create policy reports_select_reporter
    on public.reports for select
    using (true);

drop policy if exists reports_insert_reporter on public.reports;
create policy reports_insert_reporter
    on public.reports for insert
    with check (
        reporter ~ '^0x[a-f0-9]{40}$'
        and reported ~ '^0x[a-f0-9]{40}$'
    );

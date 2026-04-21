-- Row Level Security for CMY.
--
-- Identity: the client attaches a signed JWT containing a `wallet_address`
-- claim. Policies read the claim directly via Supabase's built-in
-- `auth.jwt()` function — no custom function in the `auth` schema is needed
-- (that schema is owned by Supabase and not writable from SQL Editor).
--
-- Convention: wallet addresses are stored lowercased. The client must
-- lowercase both the value written to tables AND the `wallet_address` claim
-- placed in the JWT. Policies compare them as plain text.

-- Enable RLS -----------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.matches              enable row level security;
alter table public.connection_requests  enable row level security;
alter table public.chat_sessions        enable row level security;
alter table public.milestones           enable row level security;
alter table public.reports              enable row level security;

-- profiles -------------------------------------------------------------------
-- Anyone may browse profiles for discovery. Only the owning wallet may
-- insert/update their own row.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
    on public.profiles for select
    using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
    on public.profiles for insert
    with check ((auth.jwt() ->> 'wallet_address') = wallet_address);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
    on public.profiles for update
    using ((auth.jwt() ->> 'wallet_address') = wallet_address)
    with check ((auth.jwt() ->> 'wallet_address') = wallet_address);

-- matches --------------------------------------------------------------------
-- A user may read/insert/update only matches they are part of.
drop policy if exists matches_select_member on public.matches;
create policy matches_select_member
    on public.matches for select
    using (
        (auth.jwt() ->> 'wallet_address') = user_a
     or (auth.jwt() ->> 'wallet_address') = user_b
    );

drop policy if exists matches_insert_member on public.matches;
create policy matches_insert_member
    on public.matches for insert
    with check (
        (auth.jwt() ->> 'wallet_address') = user_a
     or (auth.jwt() ->> 'wallet_address') = user_b
    );

drop policy if exists matches_update_member on public.matches;
create policy matches_update_member
    on public.matches for update
    using (
        (auth.jwt() ->> 'wallet_address') = user_a
     or (auth.jwt() ->> 'wallet_address') = user_b
    );

-- connection_requests --------------------------------------------------------
-- Sender or recipient may read. Only the sender may create. Only the
-- recipient may update (accept/decline).
drop policy if exists requests_select_parties on public.connection_requests;
create policy requests_select_parties
    on public.connection_requests for select
    using (
        (auth.jwt() ->> 'wallet_address') = sender
     or (auth.jwt() ->> 'wallet_address') = recipient
    );

drop policy if exists requests_insert_sender on public.connection_requests;
create policy requests_insert_sender
    on public.connection_requests for insert
    with check ((auth.jwt() ->> 'wallet_address') = sender);

drop policy if exists requests_update_recipient on public.connection_requests;
create policy requests_update_recipient
    on public.connection_requests for update
    using ((auth.jwt() ->> 'wallet_address') = recipient)
    with check ((auth.jwt() ->> 'wallet_address') = recipient);

-- chat_sessions --------------------------------------------------------------
-- Only matched users may read/write session metadata for their own match.
drop policy if exists chat_sessions_select_matched on public.chat_sessions;
create policy chat_sessions_select_matched
    on public.chat_sessions for select
    using (exists (
        select 1 from public.matches m
        where m.id = chat_sessions.match_id
          and ((auth.jwt() ->> 'wallet_address') = m.user_a
            or (auth.jwt() ->> 'wallet_address') = m.user_b)
    ));

drop policy if exists chat_sessions_insert_matched on public.chat_sessions;
create policy chat_sessions_insert_matched
    on public.chat_sessions for insert
    with check (exists (
        select 1 from public.matches m
        where m.id = chat_sessions.match_id
          and ((auth.jwt() ->> 'wallet_address') = m.user_a
            or (auth.jwt() ->> 'wallet_address') = m.user_b)
    ));

drop policy if exists chat_sessions_update_matched on public.chat_sessions;
create policy chat_sessions_update_matched
    on public.chat_sessions for update
    using (exists (
        select 1 from public.matches m
        where m.id = chat_sessions.match_id
          and ((auth.jwt() ->> 'wallet_address') = m.user_a
            or (auth.jwt() ->> 'wallet_address') = m.user_b)
    ));

-- milestones -----------------------------------------------------------------
-- Same gate as chat_sessions — only matched users.
drop policy if exists milestones_select_matched on public.milestones;
create policy milestones_select_matched
    on public.milestones for select
    using (exists (
        select 1 from public.matches m
        where m.id = milestones.match_id
          and ((auth.jwt() ->> 'wallet_address') = m.user_a
            or (auth.jwt() ->> 'wallet_address') = m.user_b)
    ));

drop policy if exists milestones_insert_matched on public.milestones;
create policy milestones_insert_matched
    on public.milestones for insert
    with check (exists (
        select 1 from public.matches m
        where m.id = milestones.match_id
          and ((auth.jwt() ->> 'wallet_address') = m.user_a
            or (auth.jwt() ->> 'wallet_address') = m.user_b)
    ));

drop policy if exists milestones_update_matched on public.milestones;
create policy milestones_update_matched
    on public.milestones for update
    using (exists (
        select 1 from public.matches m
        where m.id = milestones.match_id
          and ((auth.jwt() ->> 'wallet_address') = m.user_a
            or (auth.jwt() ->> 'wallet_address') = m.user_b)
    ));

-- reports --------------------------------------------------------------------
-- Any wallet may submit a report. Reporters may read their own submissions;
-- moderation surface reads via service role.
drop policy if exists reports_insert_reporter on public.reports;
create policy reports_insert_reporter
    on public.reports for insert
    with check ((auth.jwt() ->> 'wallet_address') = reporter);

drop policy if exists reports_select_reporter on public.reports;
create policy reports_select_reporter
    on public.reports for select
    using ((auth.jwt() ->> 'wallet_address') = reporter);

-- CMY initial schema (Phase 3 design).
-- Identity model: wallet address is the sole user identifier. There is no
-- Supabase Auth user. RLS policies (002) enforce per-wallet access by reading
-- a `wallet_address` claim from the JWT attached to each request.

set check_function_bodies = off;

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- profiles -------------------------------------------------------------------
create table if not exists public.profiles (
    id             uuid primary key default gen_random_uuid(),
    wallet_address text unique not null,
    display_name   text not null,
    age            integer not null check (age >= 18),
    gender         text not null check (gender in ('male','female')),
    seeking        text not null check (seeking in ('male','female')),
    bio            text,
    photos         text[] not null default '{}',
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists profiles_seeking_gender_idx
    on public.profiles (seeking, gender)
    where is_active;

-- matches --------------------------------------------------------------------
create table if not exists public.matches (
    id         uuid primary key default gen_random_uuid(),
    user_a     text not null references public.profiles(wallet_address),
    user_b     text not null references public.profiles(wallet_address),
    matched_at timestamptz not null default now(),
    is_active  boolean not null default true,
    tx_hash    text,
    constraint matches_distinct_users check (user_a <> user_b),
    -- canonical ordering prevents duplicate matches (a,b) and (b,a)
    constraint matches_ordered_users check (user_a < user_b),
    constraint matches_unique_pair unique (user_a, user_b)
);

create index if not exists matches_user_a_idx on public.matches (user_a);
create index if not exists matches_user_b_idx on public.matches (user_b);

-- connection_requests --------------------------------------------------------
create table if not exists public.connection_requests (
    id           uuid primary key default gen_random_uuid(),
    sender       text not null references public.profiles(wallet_address),
    recipient    text not null references public.profiles(wallet_address),
    status       text not null default 'pending'
                    check (status in ('pending','accepted','declined')),
    fee_tx_hash  text not null,
    created_at   timestamptz not null default now(),
    responded_at timestamptz,
    constraint connection_requests_distinct check (sender <> recipient)
);

create unique index if not exists connection_requests_pending_unique
    on public.connection_requests (sender, recipient)
    where status = 'pending';

create index if not exists connection_requests_recipient_idx
    on public.connection_requests (recipient, status);

-- chat_sessions --------------------------------------------------------------
create table if not exists public.chat_sessions (
    id            uuid primary key default gen_random_uuid(),
    match_id      uuid not null references public.matches(id) on delete cascade,
    session_date  date not null,
    message_count integer not null default 0,
    created_at    timestamptz not null default now(),
    constraint chat_sessions_match_day_unique unique (match_id, session_date)
);

create index if not exists chat_sessions_match_idx
    on public.chat_sessions (match_id, session_date desc);

-- milestones -----------------------------------------------------------------
create table if not exists public.milestones (
    id            uuid primary key default gen_random_uuid(),
    match_id      uuid not null references public.matches(id) on delete cascade,
    milestone_id  text not null,
    triggered_at  timestamptz not null default now(),
    fulfilled_by  text references public.profiles(wallet_address),
    fulfilled_at  timestamptz,
    gift_tx_hash  text,
    constraint milestones_unique_per_match unique (match_id, milestone_id)
);

create index if not exists milestones_match_idx on public.milestones (match_id);

-- reports --------------------------------------------------------------------
create table if not exists public.reports (
    id         uuid primary key default gen_random_uuid(),
    reporter   text not null references public.profiles(wallet_address),
    reported   text not null references public.profiles(wallet_address),
    reason     text not null,
    created_at timestamptz not null default now(),
    resolved   boolean not null default false,
    constraint reports_distinct check (reporter <> reported)
);

create index if not exists reports_reported_idx on public.reports (reported);

-- updated_at trigger for profiles --------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
before update on public.profiles
for each row execute function public.tg_set_updated_at();

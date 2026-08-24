-- Vireli database schema (Stage 2)
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run

-- === users ===
create table if not exists users (
    id              bigserial primary key,
    telegram_id     bigint not null unique,
    username        text,
    credits_balance integer not null default 5,
    created_at      timestamptz not null default now(),
    settings        jsonb not null default '{}'::jsonb
);

create index if not exists idx_users_telegram_id on users (telegram_id);


-- === credits_transactions ===
-- Every credit change (grant on signup, spend on generation, future top-ups)
-- is logged here instead of just mutating users.credits_balance blindly.
-- This gives us a full audit trail and makes future promo codes / refunds safe.
create table if not exists credits_transactions (
    id          bigserial primary key,
    user_id     bigint not null references users (id) on delete cascade,
    amount      integer not null,       -- positive = credit, negative = debit
    reason      text not null,          -- e.g. 'signup_bonus', 'generation:enhance', 'refund'
    created_at  timestamptz not null default now()
);

create index if not exists idx_credits_tx_user_id on credits_transactions (user_id);


-- === generations ===
create type generation_status as enum ('pending', 'processing', 'completed', 'failed');
create type generation_type as enum ('enhance', 'remove_bg', 'style', 'caption');

create table if not exists generations (
    id              bigserial primary key,
    user_id         bigint not null references users (id) on delete cascade,
    type            generation_type not null,
    status          generation_status not null default 'pending',
    input_file_url  text,
    output_file_url text,
    credits_spent   integer not null default 0,
    error_message   text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_generations_user_id on generations (user_id);
create index if not exists idx_generations_status on generations (status);

-- Keep updated_at fresh automatically on every row change
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generations_updated_at on generations;
create trigger trg_generations_updated_at
    before update on generations
    for each row
    execute function set_updated_at();

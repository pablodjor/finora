-- Finora — Telegram bot (vínculo cuenta ↔ chat)
-- Ejecutar en SQL Editor de Supabase DESPUÉS de schema.sql

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint,
  telegram_username text,
  pending_draft jsonb,
  pending_flow jsonb,
  linked_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint telegram_links_chat_unique unique (telegram_chat_id),
  constraint telegram_links_user_unique unique (user_id)
);

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint telegram_link_codes_code_unique unique (code)
);

create index if not exists telegram_links_user_idx on public.telegram_links (user_id);
create index if not exists telegram_link_codes_user_idx on public.telegram_link_codes (user_id);
create index if not exists telegram_link_codes_code_idx on public.telegram_link_codes (code)
  where used_at is null;

drop trigger if exists telegram_links_set_updated_at on public.telegram_links;
create trigger telegram_links_set_updated_at
  before update on public.telegram_links
  for each row execute function public.set_updated_at();

alter table public.telegram_links enable row level security;
alter table public.telegram_link_codes enable row level security;

drop policy if exists telegram_links_select on public.telegram_links;
create policy telegram_links_select on public.telegram_links
  for select to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists telegram_links_delete on public.telegram_links;
create policy telegram_links_delete on public.telegram_links
  for delete to authenticated
  using (public.current_profile_active() and user_id = auth.uid());

drop policy if exists telegram_link_codes_select on public.telegram_link_codes;
create policy telegram_link_codes_select on public.telegram_link_codes
  for select to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists telegram_link_codes_insert on public.telegram_link_codes;
create policy telegram_link_codes_insert on public.telegram_link_codes
  for insert to authenticated
  with check (public.current_profile_active() and user_id = auth.uid());

drop policy if exists telegram_link_codes_delete on public.telegram_link_codes;
create policy telegram_link_codes_delete on public.telegram_link_codes
  for delete to authenticated
  using (public.current_profile_active() and user_id = auth.uid());

grant select, delete on public.telegram_links to authenticated;
grant select, insert, delete on public.telegram_link_codes to authenticated;

-- Genera un código de un solo uso (válido 15 min)
create or replace function public.create_telegram_link_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_expires timestamptz := timezone('utc', now()) + interval '15 minutes';
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not public.current_profile_active() then
    raise exception 'Perfil inactivo';
  end if;

  -- invalidar códigos previos sin usar
  update public.telegram_link_codes
  set used_at = timezone('utc', now())
  where user_id = v_uid
    and used_at is null;

  v_code := 'FINORA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.telegram_link_codes (user_id, code, expires_at)
  values (v_uid, v_code, v_expires);

  return query select v_code, v_expires;
end;
$$;

revoke all on function public.create_telegram_link_code() from public;
grant execute on function public.create_telegram_link_code() to authenticated;

-- Desvincular Telegram (borra el link del usuario)
create or replace function public.unlink_telegram()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  delete from public.telegram_links where user_id = v_uid;
  return true;
end;
$$;

revoke all on function public.unlink_telegram() from public;
grant execute on function public.unlink_telegram() to authenticated;

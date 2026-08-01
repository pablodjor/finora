-- Finora — Juntadas / división de gastos entre amigos
-- Ejecutar en SQL Editor de Supabase DESPUÉS de schema.sql

create table if not exists public.juntadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  notes text,
  currency text not null default 'ARS',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.juntada_members (
  id uuid primary key default gen_random_uuid(),
  juntada_id uuid not null references public.juntadas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  is_me boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.juntada_expenses (
  id uuid primary key default gen_random_uuid(),
  juntada_id uuid not null references public.juntadas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_by_member_id uuid not null references public.juntada_members (id) on delete restrict,
  expense_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.juntada_expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.juntada_expenses (id) on delete cascade,
  member_id uuid not null references public.juntada_members (id) on delete cascade,
  share_amount numeric(14, 2) not null check (share_amount >= 0),
  unique (expense_id, member_id)
);

create index if not exists juntadas_user_idx on public.juntadas (user_id) where deleted_at is null;
create index if not exists juntada_members_juntada_idx on public.juntada_members (juntada_id);
create index if not exists juntada_expenses_juntada_idx on public.juntada_expenses (juntada_id) where deleted_at is null;
create index if not exists juntada_shares_expense_idx on public.juntada_expense_shares (expense_id);

drop trigger if exists juntadas_set_updated_at on public.juntadas;
create trigger juntadas_set_updated_at
  before update on public.juntadas
  for each row execute function public.set_updated_at();

drop trigger if exists juntada_expenses_set_updated_at on public.juntada_expenses;
create trigger juntada_expenses_set_updated_at
  before update on public.juntada_expenses
  for each row execute function public.set_updated_at();

alter table public.juntadas enable row level security;
alter table public.juntada_members enable row level security;
alter table public.juntada_expenses enable row level security;
alter table public.juntada_expense_shares enable row level security;

drop policy if exists juntadas_all on public.juntadas;
create policy juntadas_all on public.juntadas
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

drop policy if exists juntada_members_all on public.juntada_members;
create policy juntada_members_all on public.juntada_members
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

drop policy if exists juntada_expenses_all on public.juntada_expenses;
create policy juntada_expenses_all on public.juntada_expenses
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

drop policy if exists juntada_shares_all on public.juntada_expense_shares;
create policy juntada_shares_all on public.juntada_expense_shares
  for all to authenticated
  using (
    public.current_profile_active()
    and exists (
      select 1
      from public.juntada_expenses e
      where e.id = expense_id
        and (e.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    public.current_profile_active()
    and exists (
      select 1
      from public.juntada_expenses e
      where e.id = expense_id
        and e.user_id = auth.uid()
    )
  );

grant all on public.juntadas to authenticated;
grant all on public.juntada_members to authenticated;
grant all on public.juntada_expenses to authenticated;
grant all on public.juntada_expense_shares to authenticated;

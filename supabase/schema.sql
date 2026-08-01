-- Finora — Schema completo (PostgreSQL / Supabase)
-- Ejecutar en el SQL Editor de Supabase

create extension if not exists "pgcrypto";

-- =============================================================================
-- Helpers
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- =============================================================================
-- Roles (catálogo)
-- =============================================================================

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('admin', 'user', 'emmita')),
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.roles (code, name, description)
values
  ('admin', 'Administrador', 'Acceso completo a la plataforma'),
  ('user', 'Usuario', 'Administra únicamente sus propios datos'),
  ('emmita', 'Emmita', 'Usuario con bienvenida especial al ingresar')
on conflict (code) do nothing;

-- =============================================================================
-- Profiles
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user', 'emmita')),
  currency text not null default 'ARS',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  locale text not null default 'es-AR',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Helpers que dependen de profiles (deben crearse DESPUÉS de la tabla)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function public.current_profile_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

-- =============================================================================
-- Categories & subcategories
-- =============================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income')),
  color text not null default '#059669',
  icon text not null default 'Circle',
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint categories_owner_check check (
    (is_system = true and user_id is null) or (is_system = false and user_id is not null)
  )
);

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists categories_type_idx on public.categories (type);
create index if not exists categories_system_idx on public.categories (is_system);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists subcategories_category_id_idx on public.subcategories (category_id);
create index if not exists subcategories_user_id_idx on public.subcategories (user_id);

create trigger subcategories_set_updated_at
before update on public.subcategories
for each row execute function public.set_updated_at();

-- =============================================================================
-- Payment methods
-- =============================================================================

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null default 'other' check (
    type in ('cash', 'transfer', 'mercadopago', 'debit', 'credit', 'bank', 'other')
  ),
  color text not null default '#334e68',
  icon text not null default 'Wallet',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists payment_methods_user_id_idx on public.payment_methods (user_id);

create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

-- =============================================================================
-- Credit cards
-- =============================================================================

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  bank text,
  card_type text not null default 'visa' check (card_type in ('visa', 'amex', 'mastercard', 'other')),
  last_four text check (last_four ~ '^[0-9]{4}$'),
  closing_day integer not null check (closing_day between 1 and 28),
  due_day integer not null check (due_day between 1 and 28),
  total_limit numeric(14, 2) not null default 0,
  available_limit numeric(14, 2) not null default 0,
  color text not null default '#102a43',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists credit_cards_user_id_idx on public.credit_cards (user_id);

create trigger credit_cards_set_updated_at
before update on public.credit_cards
for each row execute function public.set_updated_at();

create table if not exists public.credit_card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  description text not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  installments_count integer not null default 1 check (installments_count >= 1),
  purchase_date date not null,
  category_id uuid references public.categories (id),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists credit_card_purchases_user_id_idx on public.credit_card_purchases (user_id);
create index if not exists credit_card_purchases_card_id_idx on public.credit_card_purchases (credit_card_id);

create trigger credit_card_purchases_set_updated_at
before update on public.credit_card_purchases
for each row execute function public.set_updated_at();

create table if not exists public.credit_card_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purchase_id uuid not null references public.credit_card_purchases (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  installment_number integer not null check (installment_number >= 1),
  amount numeric(14, 2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'pending' check (
    status in ('paid', 'pending', 'overdue', 'scheduled', 'cancelled')
  ),
  transaction_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (purchase_id, installment_number)
);

create index if not exists credit_card_installments_user_id_idx on public.credit_card_installments (user_id);
create index if not exists credit_card_installments_due_date_idx on public.credit_card_installments (due_date);

create trigger credit_card_installments_set_updated_at
before update on public.credit_card_installments
for each row execute function public.set_updated_at();

-- =============================================================================
-- Recurring expenses / income
-- =============================================================================

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  estimated_amount numeric(14, 2) not null default 0 check (estimated_amount >= 0),
  due_day integer not null default 1 check (due_day between 1 and 28),
  category_id uuid references public.categories (id),
  payment_method_id uuid references public.payment_methods (id),
  frequency text not null default 'monthly' check (
    frequency in ('monthly', 'weekly', 'biweekly', 'yearly')
  ),
  start_date date not null default current_date,
  end_date date,
  reminder_days integer not null default 3,
  auto_renew boolean not null default true,
  is_active boolean not null default false,
  is_template boolean not null default false,
  template_key text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists recurring_expenses_user_id_idx on public.recurring_expenses (user_id);
create index if not exists recurring_expenses_active_idx on public.recurring_expenses (is_active);

create trigger recurring_expenses_set_updated_at
before update on public.recurring_expenses
for each row execute function public.set_updated_at();

create table if not exists public.recurring_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  estimated_amount numeric(14, 2) not null default 0 check (estimated_amount >= 0),
  receive_day integer not null default 1 check (receive_day between 1 and 28),
  category_id uuid references public.categories (id),
  payment_method_id uuid references public.payment_methods (id),
  frequency text not null default 'monthly' check (
    frequency in ('monthly', 'weekly', 'biweekly', 'yearly')
  ),
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists recurring_income_user_id_idx on public.recurring_income (user_id);

create trigger recurring_income_set_updated_at
before update on public.recurring_income
for each row execute function public.set_updated_at();

-- =============================================================================
-- Transactions
-- =============================================================================

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  date date not null default current_date,
  category_id uuid references public.categories (id),
  subcategory_id uuid references public.subcategories (id),
  payment_method_id uuid references public.payment_methods (id),
  expense_type text check (
    expense_type is null or expense_type in (
      'one_time', 'fixed', 'installment', 'subscription', 'variable'
    )
  ),
  status text not null default 'paid' check (
    status in ('paid', 'pending', 'overdue', 'scheduled', 'cancelled')
  ),
  notes text,
  receipt_url text,
  installments_count integer default 1 check (installments_count is null or installments_count >= 1),
  current_installment integer default 1 check (current_installment is null or current_installment >= 1),
  is_recurring boolean not null default false,
  recurring_expense_id uuid references public.recurring_expenses (id) on delete set null,
  recurring_income_id uuid references public.recurring_income (id) on delete set null,
  credit_card_id uuid references public.credit_cards (id) on delete set null,
  period_year integer,
  period_month integer check (period_month is null or period_month between 1 and 12),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_date_idx on public.transactions (date);
create index if not exists transactions_type_idx on public.transactions (type);
create index if not exists transactions_category_id_idx on public.transactions (category_id);
create index if not exists transactions_status_idx on public.transactions (status);
create index if not exists transactions_period_idx on public.transactions (user_id, period_year, period_month);
create index if not exists transactions_recurring_expense_idx on public.transactions (recurring_expense_id);

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

alter table public.credit_card_installments
  drop constraint if exists credit_card_installments_transaction_id_fkey;

alter table public.credit_card_installments
  add constraint credit_card_installments_transaction_id_fkey
  foreign key (transaction_id) references public.transactions (id) on delete set null;

-- =============================================================================
-- Budgets
-- =============================================================================

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  year integer not null,
  month integer not null check (month between 1 and 12),
  amount numeric(14, 2) not null check (amount >= 0),
  alert_80 boolean not null default true,
  alert_100 boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (user_id, category_id, year, month)
);

create index if not exists budgets_user_period_idx on public.budgets (user_id, year, month);

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

-- =============================================================================
-- Savings goals
-- =============================================================================

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  saved_amount numeric(14, 2) not null default 0 check (saved_amount >= 0),
  deadline date,
  suggested_monthly numeric(14, 2) default 0,
  color text not null default '#0ea5e9',
  icon text not null default 'Target',
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists savings_goals_user_id_idx on public.savings_goals (user_id);

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists savings_contributions_goal_id_idx on public.savings_contributions (goal_id);
create index if not exists savings_contributions_user_id_idx on public.savings_contributions (user_id);

create trigger savings_contributions_set_updated_at
before update on public.savings_contributions
for each row execute function public.set_updated_at();

-- =============================================================================
-- Notifications & activity logs
-- =============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'success', 'danger')),
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_is_read_idx on public.notifications (user_id, is_read);

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);

-- =============================================================================
-- Onboarding helpers
-- =============================================================================

create or replace function public.seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat_id uuid;
  v_name text;
  v_color text;
  v_icon text;
begin
  -- Payment methods
  insert into public.payment_methods (user_id, name, type, color, icon)
  values
    (p_user_id, 'Efectivo', 'cash', '#65a30d', 'Banknote'),
    (p_user_id, 'Transferencia', 'transfer', '#0284c7', 'ArrowLeftRight'),
    (p_user_id, 'Mercado Pago', 'mercadopago', '#009ee3', 'Smartphone'),
    (p_user_id, 'Tarjeta de débito', 'debit', '#4f46e5', 'CreditCard'),
    (p_user_id, 'Tarjeta de crédito', 'credit', '#102a43', 'CreditCard'),
    (p_user_id, 'Cuenta bancaria', 'bank', '#334e68', 'Landmark'),
    (p_user_id, 'Otros', 'other', '#64748b', 'MoreHorizontal');

  -- Income categories (personal)
  foreach v_name in array array[
    'Sueldo', 'Aguinaldo', 'Trabajo freelance', 'Venta',
    'Reembolso', 'Inversión', 'Regalo', 'Otros'
  ]
  loop
    insert into public.categories (user_id, name, type, color, icon, is_system)
    values (p_user_id, v_name, 'income', '#059669', 'TrendingUp', false);
  end loop;

  -- Clone system expense categories as personal inactive templates via recurring_expenses
  for v_cat_id, v_name, v_color, v_icon in
    select c.id, c.name, c.color, c.icon
    from public.categories c
    where c.is_system = true
      and c.type = 'expense'
      and c.deleted_at is null
  loop
    insert into public.categories (user_id, name, type, color, icon, is_system)
    values (p_user_id, v_name, 'expense', v_color, v_icon, false)
    returning id into v_cat_id;

    insert into public.recurring_expenses (
      user_id, name, estimated_amount, due_day, category_id,
      frequency, is_active, is_template, template_key
    )
    values (
      p_user_id, v_name, 0, 10, v_cat_id,
      'monthly', false, true, lower(replace(v_name, ' ', '_'))
    );
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  );

  perform public.seed_user_defaults(new.id);

  insert into public.activity_logs (user_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    new.id, new.id, 'user.registered', 'profile', new.id,
    jsonb_build_object('email', new.email)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =============================================================================
-- Generate recurring expense instances for a month
-- =============================================================================

create or replace function public.generate_recurring_expense_instances(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_date date;
  v_count integer := 0;
begin
  if auth.uid() is distinct from p_user_id and not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  for r in
    select *
    from public.recurring_expenses re
    where re.user_id = p_user_id
      and re.is_active = true
      and re.deleted_at is null
      and (re.end_date is null or re.end_date >= make_date(p_year, p_month, 1))
      and re.start_date <= (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
  loop
    v_date := make_date(p_year, p_month, least(r.due_day, 28));

    if not exists (
      select 1
      from public.transactions t
      where t.user_id = p_user_id
        and t.recurring_expense_id = r.id
        and t.period_year = p_year
        and t.period_month = p_month
        and t.deleted_at is null
    ) then
      insert into public.transactions (
        user_id, type, description, amount, date, category_id, payment_method_id,
        expense_type, status, is_recurring, recurring_expense_id, period_year, period_month
      )
      values (
        p_user_id, 'expense', r.name, r.estimated_amount, v_date, r.category_id, r.payment_method_id,
        'fixed', 'pending', true, r.id, p_year, p_month
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.credit_cards enable row level security;
alter table public.credit_card_purchases enable row level security;
alter table public.credit_card_installments enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.recurring_income enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

-- Roles: readable by authenticated
create policy roles_select on public.roles
  for select to authenticated
  using (true);

-- Profiles
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and role = (select p.role from public.profiles p where p.id = auth.uid())
      and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
    )
  );

-- Categories
create policy categories_select on public.categories
  for select to authenticated
  using (
    public.current_profile_active()
    and (is_system = true or user_id = auth.uid() or public.is_admin())
  );

create policy categories_insert on public.categories
  for insert to authenticated
  with check (
    public.current_profile_active()
    and (
      (is_system = false and user_id = auth.uid())
      or (is_system = true and public.is_admin())
    )
  );

create policy categories_update on public.categories
  for update to authenticated
  using (
    public.current_profile_active()
    and ((is_system = false and user_id = auth.uid()) or public.is_admin())
  )
  with check (
    (is_system = false and user_id = auth.uid()) or public.is_admin()
  );

create policy categories_delete on public.categories
  for delete to authenticated
  using (
    public.current_profile_active()
    and ((is_system = false and user_id = auth.uid()) or public.is_admin())
  );

-- Subcategories
create policy subcategories_select on public.subcategories
  for select to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()));

create policy subcategories_insert on public.subcategories
  for insert to authenticated
  with check (public.current_profile_active() and user_id = auth.uid());

create policy subcategories_update on public.subcategories
  for update to authenticated
  using (public.current_profile_active() and user_id = auth.uid())
  with check (user_id = auth.uid());

create policy subcategories_delete on public.subcategories
  for delete to authenticated
  using (public.current_profile_active() and user_id = auth.uid());

-- Generic owner policies helper pattern for user-owned tables
create policy payment_methods_all on public.payment_methods
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy credit_cards_all on public.credit_cards
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy credit_card_purchases_all on public.credit_card_purchases
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy credit_card_installments_all on public.credit_card_installments
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy recurring_expenses_all on public.recurring_expenses
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy recurring_income_all on public.recurring_income
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy transactions_all on public.transactions
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy budgets_all on public.budgets
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy savings_goals_all on public.savings_goals
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy savings_contributions_all on public.savings_contributions
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy notifications_all on public.notifications
  for all to authenticated
  using (public.current_profile_active() and (user_id = auth.uid() or public.is_admin()))
  with check (public.current_profile_active() and user_id = auth.uid());

create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or actor_id = auth.uid());

create policy activity_logs_insert on public.activity_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

-- =============================================================================
-- Grants
-- =============================================================================

grant usage on schema public to anon, authenticated;
grant select on public.roles to authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.categories to authenticated;
grant all on public.subcategories to authenticated;
grant all on public.payment_methods to authenticated;
grant all on public.credit_cards to authenticated;
grant all on public.credit_card_purchases to authenticated;
grant all on public.credit_card_installments to authenticated;
grant all on public.recurring_expenses to authenticated;
grant all on public.recurring_income to authenticated;
grant all on public.transactions to authenticated;
grant all on public.budgets to authenticated;
grant all on public.savings_goals to authenticated;
grant all on public.savings_contributions to authenticated;
grant all on public.notifications to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant execute on function public.generate_recurring_expense_instances(uuid, integer, integer) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_profile_active() to authenticated;

-- Storage de comprobantes: ver supabase/storage.sql (bucket receipts + policies)
-- Juntadas / división de gastos: ver supabase/juntadas.sql

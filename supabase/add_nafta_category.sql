-- Agrega categoría sistema Nafta y la copia a usuarios que no la tengan.
-- Ejecutar en SQL Editor de Supabase.

insert into public.categories (name, type, color, icon, is_system, sort_order)
values ('Nafta', 'expense', '#c2410c', 'Fuel', true, 19)
on conflict do nothing;

insert into public.categories (user_id, name, type, color, icon, is_system, is_active)
select p.id, 'Nafta', 'expense', '#c2410c', 'Fuel', false, true
from public.profiles p
where not exists (
  select 1
  from public.categories c
  where c.user_id = p.id
    and lower(c.name) = 'nafta'
    and c.deleted_at is null
);

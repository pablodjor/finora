-- Rol "emmita": mismo acceso que user, con bienvenida especial en la app.
-- Ejecutar en el SQL Editor de Supabase.

alter table public.roles drop constraint if exists roles_code_check;
alter table public.roles
  add constraint roles_code_check check (code in ('admin', 'user', 'emmita'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'user', 'emmita'));

insert into public.roles (code, name, description)
values (
  'emmita',
  'Emmita',
  'Usuario con bienvenida especial al ingresar'
)
on conflict (code) do nothing;

-- Asignar a un usuario (ejemplo):
-- update public.profiles set role = 'emmita' where email = 'alguien@email.com';

-- Finora — Seed de categorías sistema (gastos fijos predeterminados)
-- Ejecutar DESPUÉS de schema.sql

insert into public.categories (name, type, color, icon, is_system, sort_order)
values
  ('Tarjeta Visa', 'expense', '#1a365d', 'CreditCard', true, 1),
  ('Tarjeta American Express', 'expense', '#006fcf', 'CreditCard', true, 2),
  ('Mercado Pago', 'expense', '#009ee3', 'Smartphone', true, 3),
  ('Cochera', 'expense', '#475569', 'Car', true, 4),
  ('Expensas', 'expense', '#334e68', 'Building2', true, 5),
  ('Supermercado y comida', 'expense', '#059669', 'ShoppingCart', true, 6),
  ('Salidas', 'expense', '#db2777', 'PartyPopper', true, 7),
  ('Luz', 'expense', '#d97706', 'Zap', true, 8),
  ('ABL', 'expense', '#b45309', 'Landmark', true, 9),
  ('Agua', 'expense', '#0284c7', 'Droplets', true, 10),
  ('Gas', 'expense', '#ea580c', 'Flame', true, 11),
  ('Internet', 'expense', '#4f46e5', 'Wifi', true, 12),
  ('Teléfono', 'expense', '#6366f1', 'Phone', true, 13),
  ('Seguro del auto', 'expense', '#0f766e', 'Shield', true, 14),
  ('Suscripciones', 'expense', '#7c3aed', 'Repeat', true, 15),
  ('ChatGPT', 'expense', '#10a37f', 'Bot', true, 16),
  ('Streaming', 'expense', '#e11d48', 'Tv', true, 17),
  ('Transporte', 'expense', '#0891b2', 'Bus', true, 18),
  ('Nafta', 'expense', '#c2410c', 'Fuel', true, 19),
  ('Salud', 'expense', '#dc2626', 'HeartPulse', true, 20),
  ('Mascotas', 'expense', '#ca8a04', 'PawPrint', true, 21),
  ('Impuestos', 'expense', '#64748b', 'FileText', true, 22),
  ('Otros', 'expense', '#94a3b8', 'MoreHorizontal', true, 23)
on conflict do nothing;

-- Nota: los usuarios nuevos reciben copias personales vía seed_user_defaults()
-- Promover admin manualmente:
-- update public.profiles set role = 'admin' where email = 'tu@email.com';
-- Rol especial emmita (bienvenida festiva):
-- update public.profiles set role = 'emmita' where email = 'alguien@email.com';

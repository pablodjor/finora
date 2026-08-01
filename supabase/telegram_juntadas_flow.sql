-- Finora — estado multi-paso para juntadas por Telegram
-- Ejecutar DESPUÉS de telegram.sql

alter table public.telegram_links
  add column if not exists pending_flow jsonb;

comment on column public.telegram_links.pending_flow is
  'Wizard Telegram: { kind: "juntada", step: "name"|"members"|"expenses", juntada_id?, name? }';

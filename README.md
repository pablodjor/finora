# Finora

Aplicación web de finanzas personales: registrar, organizar y analizar ingresos y gastos, con énfasis en gastos mensuales recurrentes.

## Stack

- React + Vite (JavaScript)
- Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- React Router DOM
- React Hook Form + Zod
- Recharts
- Lucide React

## Instalación

```bash
npm install
cp .env.example .env
```

Completá en `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

También funciona `VITE_SUPABASE_ANON_KEY` (JWT legacy).

### Supabase

1. Creá un proyecto en [Supabase](https://supabase.com).
2. En Authentication → Providers, habilitá Email.
3. En SQL Editor, ejecutá en orden:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
4. Promové el primer admin:

```sql
update public.profiles set role = 'admin' where email = 'tu@email.com';
```

### Desarrollo

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

## Rutas etapa 1

**Públicas:** `/login`, `/registro`, `/recuperar-password`

**Usuario:** `/dashboard`, `/movimientos`, `/gastos-fijos`, `/ingresos`, `/categorias`, `/metodos-pago`, `/perfil`, `/configuracion`

**Admin:** `/admin`, `/admin/usuarios`, `/admin/categorias`, `/admin/estadisticas`, `/admin/actividad`

**Etapa 2:** `/tarjetas` (cuotas automáticas), `/presupuestos`, `/objetivos`, `/calendario`, `/reportes` (export CSV)

## Moneda y fechas

- Moneda inicial: ARS (`$ 1.500.000`)
- Fechas: `DD/MM/YYYY`
- Zona horaria: `America/Argentina/Buenos_Aires`

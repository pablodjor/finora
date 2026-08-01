# Bot de Telegram — Finora

Cargá gastos, ingresos y **juntadas** mandando un mensaje al bot (API oficial, gratis).

## 1. Crear el bot

1. En Telegram abrí [@BotFather](https://t.me/BotFather).
2. `/newbot` → nombre y username (ej. `Finora_finance_app_bot`).
3. Guardá el **token** (`123456:ABC...`).

## 2. SQL en Supabase

En SQL Editor ejecutá en orden:

```text
supabase/telegram.sql
supabase/telegram_juntadas_flow.sql   # si ya tenías telegram.sql sin pending_flow
supabase/juntadas.sql                 # requerido para /juntada
```

## 3. Secrets de la Edge Function

En Supabase → **Project Settings → Edge Functions → Secrets**:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC..."
supabase secrets set TELEGRAM_WEBHOOK_SECRET="un-string-largo-aleatorio"
supabase secrets set GEMINI_API_KEY="tu-key-de-ai-studio"
supabase secrets set GEMINI_MODEL="gemini-flash-latest"
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase en las functions.

> Nunca pongas el **service role** ni el token del bot en Netlify / `.env` del frontend.

## 4. Deploy de la function

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy telegram-bot
```

En [`supabase/config.toml`](config.toml) está `verify_jwt = false` para este webhook.

## 5. Registrar el webhook

PowerShell (recomendado):

```powershell
$token = "PEGAR_TOKEN"
$secret = "PEGAR_SECRET"
$body = @{
  url = "https://PROJECT_REF.supabase.co/functions/v1/telegram-bot"
  secret_token = $secret
  allowed_updates = @("message")
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json; charset=utf-8" -Body $body
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
```

Tiene que verse la `url` de Supabase en `getWebhookInfo`.

## 6. Frontend (Netlify / `.env`)

```env
VITE_TELEGRAM_BOT_USERNAME=Finora_finance_app_bot
```

Sin `@`. Después redeploy de Netlify.

## 7. Uso — gastos personales

1. Finora → **Perfil** → **Generar código de vínculo**.
2. Mandá al bot: `/start FINORA-XXXXXXXX`.
3. Escribí `Gasté 4500 en nafta`, `Cobré 80000 sueldo` o una foto del ticket.

## 8. Uso — juntadas

```text
/juntada
→ Nombre: Asado sábado
→ Personas: Pablo, Juan, Sofi
→ Gastos:
  Juan: carne 15000
  Sofi: bebida 8000
  Pablo: hielo 3000
/listo
```

El bot responde con:

- Resumen (quién le paga a quién + balances)
- PDF adjunto para compartir

También: `/juntada Asado sábado` salta directo a pedir nombres.  
`/cancelar` aborta la juntada en curso.

## Comandos

| Comando | Qué hace |
|---|---|
| `/juntada` | Wizard de juntada |
| `/listo` | Cierra la cuenta y manda PDF |
| `/cancelar` | Aborta la juntada |
| `/ultimo` | Último movimiento personal |
| `/desvincular` | Desconecta Telegram |
| `/ayuda` | Ayuda |

## Troubleshooting

| Problema | Qué chequear |
|---|---|
| Bot no responde | `getWebhookInfo`, logs Edge Function, secret_token |
| “Código inválido” | `telegram.sql`; código no expiró (15 min) |
| 401 Unauthorized | Secret distinto al del setWebhook |
| No lee fotos | `GEMINI_API_KEY` en secrets |
| `/juntada` falla al crear | Ejecutaste `juntadas.sql` + `telegram_juntadas_flow.sql` |
| No llega el PDF | Logs de la function; el texto resumen igual debería llegar |
| Link en Perfil | `VITE_TELEGRAM_BOT_USERNAME` + redeploy |

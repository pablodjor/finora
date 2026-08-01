import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, MessageCircle, Unlink } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { CURRENCIES, ROLE_LABELS, THEMES } from '../../lib/constants'
import { bindSelect } from '../../utils/formSelect'
import {
  buildTelegramStartLink,
  createTelegramLinkCode,
  getTelegramBotUsername,
  getTelegramLink,
  unlinkTelegram,
} from '../../services/telegram'
import { formatDate } from '../../utils/dates'

const schema = z.object({
  full_name: z.string().min(2, 'Ingresá tu nombre'),
  currency: z.string().min(1),
  theme: z.string().min(1),
})

export default function ProfilePage() {
  const { profile, updateProfile, signOut, isAdmin, isEmmita } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgLink, setTgLink] = useState(null)
  const [tgCode, setTgCode] = useState(null)
  const botUsername = getTelegramBotUsername()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      full_name: profile?.full_name || '',
      currency: profile?.currency || 'ARS',
      theme: profile?.theme || 'system',
    },
  })

  const loadTelegram = useCallback(async () => {
    try {
      setTgLink(await getTelegramLink())
    } catch (error) {
      console.warn(error)
    }
  }, [])

  useEffect(() => {
    loadTelegram()
  }, [loadTelegram])

  const onSubmit = async (values) => {
    setLoading(true)
    try {
      await updateProfile(values)
      toast.success('Perfil actualizado')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast.info('Sesión cerrada')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleCreateCode = async () => {
    setTgLoading(true)
    try {
      const result = await createTelegramLinkCode()
      setTgCode(result)
      toast.success('Código generado (válido 15 min)')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setTgLoading(false)
    }
  }

  const handleUnlink = async () => {
    setTgLoading(true)
    try {
      await unlinkTelegram()
      setTgLink(null)
      setTgCode(null)
      toast.success('Telegram desvinculado')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setTgLoading(false)
    }
  }

  const startLink = tgCode?.code ? buildTelegramStartLink(tgCode.code) : null

  return (
    <div>
      <PageHeader
        title="Perfil"
        description="Datos de tu cuenta y preferencias."
        actions={
          <Button variant="outline" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        }
      />

      <div className="card mb-5 max-w-2xl space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{profile?.email}</Badge>
          <Badge tone={isAdmin ? 'warning' : isEmmita ? 'danger' : 'success'}>
            {ROLE_LABELS[profile?.role] || (isAdmin ? 'Administrador' : 'Usuario')}
          </Badge>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Nombre completo"
            required
            error={errors.full_name?.message}
            {...register('full_name')}
          />
          <Select
            label="Moneda"
            options={CURRENCIES}
            {...bindSelect('currency', { watch, setValue, register })}
          />
          <Select
            label="Tema"
            options={THEMES}
            {...bindSelect('theme', { watch, setValue, register })}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={loading}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>

      <div className="card max-w-2xl space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Telegram</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Cargá gastos e ingresos mandando un mensaje al bot. Ej: “Gasté 4500 en nafta”.
            </p>
          </div>
        </div>

        {tgLink ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge tone="success">Vinculado</Badge>
                <p className="mt-2 text-sm">
                  {tgLink.telegram_username ? `@${tgLink.telegram_username}` : 'Chat de Telegram'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Desde {formatDate(tgLink.linked_at)}
                </p>
              </div>
              <Button variant="outline" loading={tgLoading} onClick={handleUnlink}>
                <Unlink className="h-4 w-4" />
                Desvincular
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!botUsername ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Falta configurar <code className="text-xs">VITE_TELEGRAM_BOT_USERNAME</code> en el
                entorno para el link directo. Igual podés generar el código y mandarlo al bot a mano.
              </p>
            ) : null}

            <Button onClick={handleCreateCode} loading={tgLoading}>
              Generar código de vínculo
            </Button>

            {tgCode ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Código (15 min)
                </p>
                <p className="mt-2 font-mono text-xl font-semibold tracking-wide">{tgCode.code}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  En Telegram abrí el bot y mandá:
                </p>
                <p className="mt-1 font-mono text-sm">/start {tgCode.code}</p>
                {startLink ? (
                  <a
                    href={startLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300"
                  >
                    Abrir bot en Telegram
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, UsersRound, Trash2, Share2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Input from '../../components/common/Input'
import Textarea from '../../components/common/Textarea'
import Badge from '../../components/common/Badge'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as juntadasService from '../../services/juntadas'
import { formatDate } from '../../utils/dates'
import { shareJuntadaWhatsApp } from '../../utils/exportFinora'

const schema = z.object({
  name: z.string().min(2, 'Poné un nombre a la juntada'),
  notes: z.string().optional(),
  friends: z
    .string()
    .min(1, 'Agregá al menos una persona')
    .refine(
      (v) =>
        String(v)
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean).length >= 1,
      'Agregá al menos una persona',
    ),
})

function CreateJuntadaForm({ onSubmit, onCancel, loading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', notes: '', friends: '' },
  })

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) =>
        onSubmit({
          name: values.name,
          notes: values.notes,
          members: String(values.friends || '')
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      )}
      noValidate
    >
      <Input
        label="Nombre de la juntada"
        required
        placeholder="Asado del sábado"
        error={errors.name?.message}
        {...register('name')}
      />
      <div>
        <Textarea
          label="Quiénes participan"
          required
          placeholder="Pablo, Juan, Sofi, Nico"
          error={errors.friends?.message}
          {...register('friends')}
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Cargá a todos los que cuentan, incluite vos si también participás. Separá por coma.
        </p>
      </div>
      <Textarea label="Notas" {...register('notes')} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Crear juntada
        </Button>
      </div>
    </form>
  )
}

export default function JuntadasPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [sharingId, setSharingId] = useState(null)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      setItems(await juntadasService.listJuntadas(user.id))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleCreate(values) {
    setBusy(true)
    try {
      await juntadasService.createJuntada(user.id, values)
      toast.success('Juntada creada')
      setModalOpen(false)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleShare(juntadaId) {
    setSharingId(juntadaId)
    try {
      const summary = await juntadasService.getJuntadaSummary(juntadaId)
      if (!summary?.expenses?.length) {
        toast.warning('Esta juntada todavía no tiene gastos para compartir')
        return
      }
      const result = await shareJuntadaWhatsApp({ summary, currency })
      if (result.method === 'share-file' || result.method === 'share-text') {
        toast.success('Elegí WhatsApp para mandar el comprobante')
      } else {
        toast.success('Abriendo WhatsApp con el comprobante…')
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      toast.error(error.message || 'No se pudo compartir')
    } finally {
      setSharingId(null)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await juntadasService.softDeleteJuntada(deleteId)
      toast.success('Juntada eliminada')
      setDeleteId(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Juntadas"
        description="Dividí gastos entre amigos y mirá quién le paga a quién."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva juntada
          </Button>
        }
      />

      {loading ? (
        <Loader fullPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Todavía no hay juntadas"
          description="Creá una para cargar lo que gastó cada uno y saldar cuentas."
          actionLabel="Nueva juntada"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/juntadas/${item.id}`}
                    className="text-lg font-semibold hover:text-primary-700 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDate(item.created_at)} · {(item.members || []).length} personas
                  </p>
                </div>
                <Badge tone={item.status === 'open' ? 'success' : 'neutral'}>
                  {item.status === 'open' ? 'Abierta' : 'Cerrada'}
                </Badge>
              </div>
              <p className="line-clamp-2 text-sm text-[var(--text-muted)]">
                {(item.members || []).map((m) => m.name).join(' · ') || 'Sin miembros'}
              </p>
              <div className="mt-auto flex gap-2">
                <Link
                  to={`/juntadas/${item.id}`}
                  className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium hover:bg-[var(--bg-muted)]"
                >
                  Abrir
                </Link>
                <Button
                  variant="outline"
                  size="icon"
                  title="Compartir por WhatsApp"
                  loading={sharingId === item.id}
                  onClick={() => handleShare(item.id)}
                >
                  {sharingId === item.id ? null : <Share2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Eliminar"
                  onClick={() => setDeleteId(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva juntada"
        size="md"
      >
        <CreateJuntadaForm
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
          loading={busy}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar juntada"
        message="¿Confirmás eliminar esta juntada y sus gastos?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  ArrowRightLeft,
  Download,
  FileSpreadsheet,
  ListPlus,
  Share2,
} from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import CurrencyInput from '../../components/common/CurrencyInput'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import * as juntadasService from '../../services/juntadas'
import { formatCurrency } from '../../utils/currency'
import { formatDate, toISODate, nowInArgentina } from '../../utils/dates'
import {
  exportJuntadaExcel,
  exportJuntadaPdf,
  shareJuntadaWhatsApp,
} from '../../utils/exportFinora'

function emptyLine() {
  return { id: Math.random().toString(36).slice(2), description: '', amount: '' }
}

/** Carga rápida: elegís quién pagó y sumás varios ítems (hielo 3000, papa 2000…). */
function QuickPersonExpensesForm({
  members,
  onSubmit,
  onCancel,
  loading,
  initialMemberId,
  currency = 'ARS',
}) {
  const [paidBy, setPaidBy] = useState(initialMemberId || members[0]?.id || '')
  const [date, setDate] = useState(toISODate(nowInArgentina()))
  const [lines, setLines] = useState([emptyLine(), emptyLine()])
  const [selected, setSelected] = useState(() => new Set(members.map((m) => m.id)))

  const total = lines.reduce((acc, l) => acc + (Number(l.amount) > 0 ? Number(l.amount) : 0), 0)
  const validLines = lines.filter(
    (l) => String(l.description || '').trim().length >= 2 && Number(l.amount) > 0,
  )

  function toggleMember(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateLine(id, patch) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!paidBy) return
    if (!validLines.length) return
    if (!selected.size) return
    onSubmit({
      paid_by_member_id: paidBy,
      expense_date: date,
      participant_member_ids: [...selected],
      items: validLines.map((l) => ({
        description: l.description.trim(),
        amount: Number(l.amount),
      })),
    })
  }

  const payerName = members.find((m) => m.id === paidBy)?.name || 'esta persona'

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Select
        label="Quién pagó / compró"
        placeholder={null}
        options={members.map((m) => ({ value: m.id, label: m.name }))}
        value={paidBy}
        onChange={(e) => setPaidBy(e.target.value)}
      />
      <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Qué compró {payerName}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            <Plus className="h-4 w-4" />
            Ítem
          </Button>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Ej: hielo 3000, papa 2000, faso 10000…
        </p>
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={line.id} className="grid grid-cols-[1fr_7.5rem_auto] items-end gap-2">
              <Input
                label={index === 0 ? 'En qué' : undefined}
                placeholder="Hielo, uber, birras…"
                value={line.description}
                onChange={(e) => updateLine(line.id, { description: e.target.value })}
              />
              <CurrencyInput
                label={index === 0 ? 'Importe' : undefined}
                value={line.amount}
                onChange={(v) => updateLine(line.id, { amount: v })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5"
                disabled={lines.length <= 1}
                onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                aria-label="Quitar ítem"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Subtotal de {payerName}:{' '}
          <span className="font-amount font-semibold text-[var(--text)]">
            {formatCurrency(total, currency)}
          </span>
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Quiénes participan (partes iguales)</p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = selected.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMember(m.id)}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                    : 'border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text)] hover:border-primary-400'
                }`}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} disabled={!validLines.length || !selected.size}>
          Guardar {validLines.length || ''} gasto(s)
        </Button>
      </div>
    </form>
  )
}

export default function JuntadaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const toast = useToast()
  const currency = profile?.currency || 'ARS'

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [quickMemberId, setQuickMemberId] = useState('')
  const [memberOpen, setMemberOpen] = useState(false)
  const [friendName, setFriendName] = useState('')
  const [deleteExpenseId, setDeleteExpenseId] = useState(null)
  const [deleteMember, setDeleteMember] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sharing, setSharing] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const data = await juntadasService.getJuntadaSummary(id)
      if (!data) {
        toast.error('Juntada no encontrada')
        setSummary(null)
        return
      }
      setSummary(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const members = summary?.juntada?.members || []

  const expensesByPerson = useMemo(() => {
    if (!summary) return []
    return members.map((m) => {
      const list = summary.expenses.filter((e) => e.paid_by_member_id === m.id)
      const total = list.reduce((acc, e) => acc + Number(e.amount || 0), 0)
      return { member: m, expenses: list, total }
    })
  }, [members, summary])

  async function handleQuickAdd(values) {
    setBusy(true)
    try {
      const payloads = values.items.map((item) => ({
        juntada_id: id,
        description: item.description,
        amount: item.amount,
        paid_by_member_id: values.paid_by_member_id,
        expense_date: values.expense_date,
        participant_member_ids: values.participant_member_ids,
      }))
      await juntadasService.createManyJuntadaExpenses(user.id, payloads)
      toast.success(`Se agregaron ${payloads.length} gasto(s)`)
      setExpenseOpen(false)
      setQuickMemberId('')
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddMember() {
    if (!friendName.trim()) return
    setBusy(true)
    try {
      await juntadasService.addMember(user.id, id, friendName.trim())
      toast.success('Persona agregada')
      setFriendName('')
      setMemberOpen(false)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteExpense() {
    setBusy(true)
    try {
      await juntadasService.softDeleteJuntadaExpense(deleteExpenseId)
      toast.success('Gasto eliminado')
      setDeleteExpenseId(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMember() {
    if (!deleteMember) return
    setBusy(true)
    try {
      await juntadasService.removeMember(deleteMember.id)
      toast.success(`${deleteMember.name} fue sacado de la juntada`)
      setDeleteMember(null)
      load()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleExportPdf() {
    if (!summary?.expenses?.length) {
      toast.warning('No hay gastos para exportar')
      return
    }
    setExporting(true)
    try {
      await exportJuntadaPdf({ summary, currency })
      toast.success('PDF descargado')
    } catch (error) {
      toast.error(error.message || 'No se pudo generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  function handleExportExcel() {
    if (!summary?.expenses?.length) {
      toast.warning('No hay gastos para exportar')
      return
    }
    try {
      exportJuntadaExcel({ summary, currency })
      toast.success('Excel descargado')
    } catch (error) {
      toast.error(error.message || 'No se pudo generar el Excel')
    }
  }

  async function handleShareWhatsApp() {
    if (!summary?.expenses?.length) {
      toast.warning('Cargá al menos un gasto para compartir la cuenta')
      return
    }
    setSharing(true)
    try {
      const result = await shareJuntadaWhatsApp({ summary, currency })
      if (result.method === 'share-file') {
        toast.success('Elegí WhatsApp para mandar el comprobante')
      } else if (result.method === 'share-text') {
        toast.success(
          result.insecure
            ? 'Elegí WhatsApp. (Para adjuntar el PDF hace falta abrir Finora con HTTPS)'
            : 'Elegí WhatsApp para mandar el comprobante',
        )
      } else {
        toast.success('Abriendo WhatsApp con el comprobante…')
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      toast.error(error.message || 'No se pudo compartir')
    } finally {
      setSharing(false)
    }
  }

  if (loading) return <Loader fullPage />
  if (!summary) {
    return (
      <EmptyState
        icon={ArrowRightLeft}
        title="Juntada no encontrada"
        description="Volvé al listado e intentá de nuevo."
        actionLabel="Ver juntadas"
        onAction={() => navigate('/juntadas')}
      />
    )
  }

  const { juntada, expenses, balances, transfers, totalSpent } = summary

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/juntadas"
          className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Juntadas
        </Link>
      </div>

      <PageHeader
        title={juntada.name}
        description={juntada.notes || 'Cargá qué compró cada uno y mirá cómo saldar.'}
        actions={
          <>
            <Button variant="outline" onClick={handleExportPdf} loading={exporting}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" onClick={() => setMemberOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Persona
            </Button>
            <Button
              onClick={() => {
                setQuickMemberId('')
                setExpenseOpen(true)
              }}
            >
              <ListPlus className="h-4 w-4" />
              Cargar gastos
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-[var(--text-muted)]">Total gastado</p>
          <p className="mt-1 font-amount text-2xl font-semibold">
            {formatCurrency(totalSpent, currency)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-muted)]">Personas</p>
          <p className="mt-1 text-2xl font-semibold">{members.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-muted)]">Gastos</p>
          <p className="mt-1 text-2xl font-semibold">{expenses.length}</p>
        </div>
      </div>

      <section className="card mb-5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="h-4 w-4" />
            Quién le paga a quién
          </h2>
          {expenses.length > 0 ? (
            <Button onClick={handleShareWhatsApp} loading={sharing} size="sm">
              <Share2 className="h-4 w-4" />
              Compartir por WhatsApp
            </Button>
          ) : null}
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {expenses.length
              ? 'Están a mano: no hay deudas pendientes.'
              : 'Todavía no hay gastos cargados.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {transfers.map((t) => (
              <li
                key={`${t.fromMemberId}-${t.toMemberId}-${t.amount}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-muted)] px-3 py-2.5 text-sm"
              >
                <span>
                  <strong>{t.fromName}</strong> le paga a <strong>{t.toName}</strong>
                </span>
                <span className="font-amount font-semibold text-primary-700 dark:text-primary-300">
                  {formatCurrency(t.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {expenses.length > 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Manda el comprobante al grupo: gastos, total y quién le paga a quién.
          </p>
        ) : null}
      </section>

      <section className="card mb-5 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Qué gastó cada uno</h2>
        </div>
        <div className="space-y-4">
          {expensesByPerson.map(({ member, expenses: list, total }) => (
            <div key={member.id} className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{member.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-amount text-sm font-semibold">
                    {formatCurrency(total, currency)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuickMemberId(member.id)
                      setExpenseOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Sumar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    title={`Sacar a ${member.name}`}
                    onClick={() => setDeleteMember(member)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Todavía no cargó gastos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {e.description}{' '}
                        <span className="text-xs text-[var(--text-muted)]">
                          · {formatDate(e.expense_date)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="font-amount font-medium">
                          {formatCurrency(e.amount, currency)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Eliminar"
                          onClick={() => setDeleteExpenseId(e.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-5 p-4">
        <h2 className="mb-3 text-base font-semibold">Balance por persona</h2>
        <div className="space-y-2">
          {balances.map((b) => (
            <div
              key={b.memberId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0"
            >
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Pagó {formatCurrency(b.paid, currency)} · le toca{' '}
                  {formatCurrency(b.owed, currency)}
                </p>
              </div>
              <p
                className={`font-amount font-semibold ${
                  b.net > 0.009
                    ? 'text-emerald-600'
                    : b.net < -0.009
                      ? 'text-red-600'
                      : 'text-[var(--text-muted)]'
                }`}
              >
                {b.net > 0.009
                  ? `Le deben ${formatCurrency(b.net, currency)}`
                  : b.net < -0.009
                    ? `Debe ${formatCurrency(Math.abs(b.net), currency)}`
                    : 'A mano'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={expenseOpen}
        onClose={() => {
          setExpenseOpen(false)
          setQuickMemberId('')
        }}
        title="Cargar gastos de alguien"
        size="lg"
      >
        {members.length ? (
          <QuickPersonExpensesForm
            key={`${members.map((m) => m.id).join('-')}-${quickMemberId}`}
            members={members}
            initialMemberId={quickMemberId}
            currency={currency}
            onSubmit={handleQuickAdd}
            onCancel={() => {
              setExpenseOpen(false)
              setQuickMemberId('')
            }}
            loading={busy}
          />
        ) : null}
      </Modal>

      <Modal open={memberOpen} onClose={() => setMemberOpen(false)} title="Agregar persona" size="sm">
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="Emma"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMemberOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddMember} loading={busy} disabled={!friendName.trim()}>
              Agregar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteExpenseId)}
        onClose={() => setDeleteExpenseId(null)}
        onConfirm={handleDeleteExpense}
        title="Eliminar gasto"
        message="¿Confirmás quitar este gasto de la juntada?"
        confirmLabel="Eliminar"
        danger
        loading={busy}
      />

      <ConfirmDialog
        open={Boolean(deleteMember)}
        onClose={() => setDeleteMember(null)}
        onConfirm={handleDeleteMember}
        title="Sacar de la juntada"
        message={`¿Sacar a ${deleteMember?.name || 'esta persona'}? Solo se puede si no tiene gastos asociados.`}
        confirmLabel="Sacar"
        danger
        loading={busy}
      />
    </div>
  )
}

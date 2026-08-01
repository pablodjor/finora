import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Input from '../common/Input'
import { parseArAmount, saveBankBalance } from '../../utils/bankBalance'
import { useToast } from '../../contexts/ToastContext'

export default function BankBalanceModal({
  open,
  onClose,
  userId,
  initial,
  onSaved,
}) {
  const toast = useToast()
  const [account, setAccount] = useState('Cuenta sueldo')
  const [amountText, setAmountText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAccount(initial?.account || 'Cuenta sueldo')
    setAmountText(
      initial?.amount != null
        ? Number(initial.amount).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '',
    )
  }, [open, initial])

  function handleSave() {
    const parsed = parseArAmount(amountText)

    if (!Number.isFinite(parsed)) {
      toast.error('Ingresá un saldo válido. Ej: 685.634,13')
      return
    }

    setSaving(true)
    try {
      saveBankBalance(userId, {
        amount: parsed,
        account: account.trim() || 'Cuenta sueldo',
        source: 'manual',
      })
      toast.success('Saldo de cuenta actualizado')
      onSaved?.()
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Saldo de cuenta"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          Cargá el saldo real de tu cuenta sueldo. Es independiente del resultado del período
          (ingresos − gastos).
        </p>
        <Input
          label="Nombre de la cuenta"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="Cuenta sueldo"
        />
        <Input
          label="Saldo actual"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          placeholder="685.634,13"
          hint="Acepta 685.634,13 o 685634.13"
        />
      </div>
    </Modal>
  )
}

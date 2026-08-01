import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Loader from '../common/Loader'
import TransactionForm from './TransactionForm'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTransactionModal } from '../../contexts/TransactionModalContext'
import * as transactionsService from '../../services/transactions'
import * as categoriesService from '../../services/categories'
import * as paymentMethodsService from '../../services/paymentMethods'
import { listCreditCards } from '../../services/creditCards'
import { deleteReceiptByUrl, uploadReceipt } from '../../services/storage'
import { applyMovementPaymentEffects, CREDIT_TYPES } from '../../utils/paymentEffects'

export default function TransactionModal() {
  const { user } = useAuth()
  const toast = useToast()
  const { open, transactionId, preset, isEdit, close, notifySaved } = useTransactionModal()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [defaults, setDefaults] = useState(null)
  const [existingTx, setExistingTx] = useState(null)
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [receiptFile, setReceiptFile] = useState(undefined)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (!open || !user) return undefined

    let cancelled = false

    async function load() {
      setLoading(true)
      setReceiptFile(undefined)
      try {
        const [cats, methods, cards, tx] = await Promise.all([
          categoriesService.ensureDefaultExpenseCategories(user.id),
          paymentMethodsService.listPaymentMethods(user.id),
          listCreditCards(user.id),
          isEdit ? transactionsService.getTransaction(transactionId) : Promise.resolve(null),
        ])
        if (cancelled) return

        const activeMethods = methods.filter((m) => m.is_active)
        setCategories(cats)
        setPaymentMethods(activeMethods)
        setCreditCards(cards.filter((c) => c.is_active !== false))

        if (isEdit) {
          if (!tx) {
            toast.error('Movimiento no encontrado')
            close()
            return
          }
          setExistingTx(tx)
          setReceiptUrl(tx.receipt_url || null)
          setDefaults({
            type: tx.type,
            description: tx.description,
            amount: Number(tx.amount),
            date: tx.date,
            category_id: tx.category_id || '',
            payment_method_id: tx.payment_method_id || '',
            credit_card_id: tx.credit_card_id || '',
            expense_type: tx.expense_type || 'one_time',
            status: tx.status,
            notes: tx.notes || '',
            installments_count: tx.installments_count || 1,
            current_installment: tx.current_installment || 1,
            is_recurring: tx.is_recurring,
          })
        } else {
          setExistingTx(null)
          const {
            openCamera: _openCamera,
            receiptFile: presetReceiptFile,
            receiptUrl: presetReceiptUrl,
            ...formPreset
          } = preset || {}
          if (presetReceiptFile instanceof File) {
            setReceiptFile(presetReceiptFile)
            setReceiptUrl(URL.createObjectURL(presetReceiptFile))
          } else {
            setReceiptFile(undefined)
            setReceiptUrl(presetReceiptUrl || null)
          }
          setDefaults({ type: 'expense', ...formPreset })
        }
        setFormKey((k) => k + 1)
      } catch (error) {
        toast.error(error.message)
        close()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, user?.id, transactionId, isEdit, preset, toast, close])

  async function handleSubmit(values) {
    setSaving(true)
    try {
      let nextReceiptUrl = receiptUrl

      if (receiptFile === null) {
        if (receiptUrl) await deleteReceiptByUrl(receiptUrl)
        nextReceiptUrl = null
      } else if (receiptFile instanceof File) {
        nextReceiptUrl = await uploadReceipt(user.id, receiptFile)
        if (receiptUrl && receiptUrl !== nextReceiptUrl) {
          await deleteReceiptByUrl(receiptUrl)
        }
      }

      const method = paymentMethods.find((m) => m.id === values.payment_method_id)
      const isCredit = values.type === 'expense' && CREDIT_TYPES.has(method?.type)
      const creditCardId = isCredit ? values.credit_card_id || creditCards[0]?.id || null : null

      if (isCredit && !creditCardId) {
        throw new Error('Seleccioná una tarjeta para este gasto')
      }

      const payload = {
        user_id: user.id,
        type: values.type,
        description: values.description,
        amount: Number(values.amount),
        date: values.date,
        category_id: values.category_id || null,
        payment_method_id: values.payment_method_id || null,
        credit_card_id: creditCardId,
        expense_type: values.type === 'expense' ? values.expense_type || 'one_time' : null,
        status: values.status,
        notes: values.notes || null,
        receipt_url: nextReceiptUrl,
        installments_count: Number(values.installments_count) || 1,
        current_installment: Number(values.current_installment) || 1,
        is_recurring: Boolean(values.is_recurring),
        period_year: Number(values.date.slice(0, 4)),
        period_month: Number(values.date.slice(5, 7)),
      }

      if (isEdit) {
        await transactionsService.updateTransaction(transactionId, payload)
        await applyMovementPaymentEffects({
          userId: user.id,
          previous: existingTx,
          next: payload,
          paymentMethods,
          options: { createCardPurchase: false },
        })
        toast.success('Movimiento actualizado')
      } else {
        await transactionsService.createTransaction(payload)
        const effects = await applyMovementPaymentEffects({
          userId: user.id,
          previous: null,
          next: payload,
          paymentMethods,
          options: { createCardPurchase: isCredit },
        })
        if (effects.bankAdjusted) {
          toast.success('Movimiento creado · saldo de cuenta actualizado')
        } else if (effects.cardPurchase) {
          toast.success('Movimiento creado · cargado en la tarjeta')
        } else {
          toast.success('Movimiento creado')
        }
      }
      notifySaved()
      close()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Detalle del movimiento' : 'Nuevo movimiento'}
      size="lg"
    >
      {loading || !defaults ? (
        <Loader label="Cargando formulario..." />
      ) : (
        <TransactionForm
          key={formKey}
          defaultValues={defaults}
          categories={categories}
          paymentMethods={paymentMethods}
          creditCards={creditCards}
          receiptUrl={receiptFile === null ? null : receiptUrl}
          autoOpenCamera={Boolean(preset?.openCamera) && !isEdit}
          onReceiptFileChange={setReceiptFile}
          onSubmit={handleSubmit}
          onCancel={close}
          loading={saving}
          submitLabel={isEdit ? 'Guardar cambios' : 'Crear movimiento'}
        />
      )}
    </Modal>
  )
}

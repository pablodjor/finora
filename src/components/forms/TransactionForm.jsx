import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import CurrencyInput from '../common/CurrencyInput'
import Button from '../common/Button'
import ReceiptPhotoField from './ReceiptPhotoField'
import {
  EXPENSE_TYPES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '../../lib/constants'
import { toISODate, nowInArgentina } from '../../utils/dates'
import { bindSelect } from '../../utils/formSelect'
import { CREDIT_TYPES } from '../../utils/paymentEffects'

const schema = z.object({
  type: z.enum(['expense', 'income']),
  description: z.string().min(2, 'Ingresá una descripción'),
  amount: z.coerce.number().positive('El importe debe ser mayor a 0'),
  date: z.string().min(1, 'Seleccioná una fecha'),
  category_id: z.string().optional(),
  payment_method_id: z.string().optional(),
  credit_card_id: z.string().optional(),
  expense_type: z.string().optional(),
  status: z.string().min(1),
  notes: z.string().optional(),
  installments_count: z.coerce.number().int().min(1).optional(),
  current_installment: z.coerce.number().int().min(1).optional(),
  is_recurring: z.boolean().optional(),
})

export default function TransactionForm({
  defaultValues,
  categories = [],
  paymentMethods = [],
  creditCards = [],
  receiptUrl = null,
  autoOpenCamera = false,
  onReceiptFileChange,
  onSubmit,
  onCancel,
  loading = false,
  submitLabel = 'Guardar',
}) {
  const [aiInsight, setAiInsight] = useState('')
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      description: '',
      amount: '',
      date: toISODate(nowInArgentina()),
      category_id: '',
      payment_method_id: '',
      credit_card_id: '',
      expense_type: 'one_time',
      status: 'paid',
      notes: '',
      installments_count: 1,
      current_installment: 1,
      is_recurring: false,
      ...defaultValues,
    },
  })

  const type = watch('type')
  const amount = watch('amount')
  const paymentMethodId = watch('payment_method_id')
  const filteredCategories = categories.filter((c) => c.type === type)
  const selectedMethod = useMemo(
    () => paymentMethods.find((m) => m.id === paymentMethodId),
    [paymentMethods, paymentMethodId],
  )
  const needsCreditCard =
    type === 'expense' && CREDIT_TYPES.has(selectedMethod?.type) && creditCards.length > 0

  function applySuggestion(suggestion) {
    if (!suggestion) return

    if (suggestion.categoryId) {
      setValue('type', 'expense', { shouldValidate: true })
      setValue('category_id', suggestion.categoryId, { shouldValidate: true })
    }

    if (suggestion.paymentMethodId) {
      setValue('payment_method_id', suggestion.paymentMethodId, { shouldValidate: true })
      if (CREDIT_TYPES.has(suggestion.paymentMethodType) && creditCards[0]) {
        setValue('credit_card_id', creditCards[0].id, { shouldValidate: true })
      }
    }

    const currentAmount = getValues('amount')
    if (suggestion.amount && (!currentAmount || Number(currentAmount) <= 0)) {
      setValue('amount', suggestion.amount, { shouldValidate: true })
    }

    const desc = suggestion.description || suggestion.whatSpent
    const currentDesc = String(getValues('description') || '').trim()
    if (desc && (!currentDesc || currentDesc.length < 3 || suggestion.source === 'gemini')) {
      setValue('description', String(desc).slice(0, 120), { shouldValidate: true })
    }

    if (suggestion.summary) {
      setAiInsight(suggestion.summary)
    } else {
      const spent = suggestion.whatSpent || suggestion.description || suggestion.categoryName
      setAiInsight(
        spent
          ? `Gastaste en ${spent}${
              suggestion.categoryName ? ` → ${suggestion.categoryName}` : ''
            }${
              suggestion.paymentMethodName ? ` · ${suggestion.paymentMethodName}` : ''
            }${
              suggestion.amount
                ? ` por $${Number(suggestion.amount).toLocaleString('es-AR')}`
                : ''
            }.`
          : '',
      )
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <ReceiptPhotoField
        receiptUrl={receiptUrl}
        categories={filteredCategories.length ? filteredCategories : categories}
        paymentMethods={paymentMethods}
        autoOpenCamera={autoOpenCamera}
        onFileChange={(file) => {
          if (file === null) setAiInsight('')
          onReceiptFileChange?.(file)
        }}
        onSuggestion={applySuggestion}
        disabled={loading}
      />
      {aiInsight ? (
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-100">
          <p className="font-medium">Qué detectó la IA</p>
          <p className="mt-0.5">{aiInsight}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipo"
          required
          options={TRANSACTION_TYPES}
          error={errors.type?.message}
          {...bindSelect('type', { watch, setValue, register })}
        />
        <CurrencyInput
          label="Importe"
          required
          value={amount}
          onChange={(value) => setValue('amount', value, { shouldValidate: true })}
          error={errors.amount?.message}
        />
        <Input
          label="Descripción"
          required
          className="sm:col-span-2"
          error={errors.description?.message}
          {...register('description')}
        />
        <Input label="Fecha" type="date" required error={errors.date?.message} {...register('date')} />
        <Select
          label="Estado"
          required
          options={TRANSACTION_STATUSES.map(({ value, label }) => ({ value, label }))}
          error={errors.status?.message}
          {...bindSelect('status', { watch, setValue, register })}
        />
        <Select
          label="Categoría"
          options={filteredCategories.map((c) => ({ value: c.id, label: c.name }))}
          error={errors.category_id?.message}
          {...bindSelect('category_id', { watch, setValue, register })}
        />
        <Select
          label="Método de pago"
          options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
          error={errors.payment_method_id?.message}
          {...bindSelect('payment_method_id', { watch, setValue, register })}
        />
        {needsCreditCard ? (
          <Select
            label="Tarjeta"
            required
            options={creditCards.map((c) => ({
              value: c.id,
              label: `${c.name}${c.last_four ? ` ·••• ${c.last_four}` : ''}`,
            }))}
            error={errors.credit_card_id?.message}
            {...bindSelect('credit_card_id', { watch, setValue, register })}
          />
        ) : null}
        {type === 'expense' ? (
          <Select
            label="Tipo de gasto"
            options={EXPENSE_TYPES}
            error={errors.expense_type?.message}
            {...bindSelect('expense_type', { watch, setValue, register })}
          />
        ) : null}
        <Input
          label="Cuotas"
          type="number"
          min="1"
          error={errors.installments_count?.message}
          {...register('installments_count')}
        />
        <Input
          label="Cuota actual"
          type="number"
          min="1"
          error={errors.current_installment?.message}
          {...register('current_installment')}
        />
      </div>
      {selectedMethod && ['debit', 'bank', 'transfer', 'mercadopago'].includes(selectedMethod.type) ? (
        <p className="text-xs text-[var(--text-muted)]">
          Este método descuenta (o suma si es ingreso) el saldo de tu cuenta sueldo en el dashboard.
        </p>
      ) : null}
      {needsCreditCard ? (
        <p className="text-xs text-[var(--text-muted)]">
          Este gasto se registra también en la tarjeta (descuenta el límite disponible).
        </p>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded" {...register('is_recurring')} />
        Es recurrente / gasto fijo
      </label>
      <Textarea label="Observaciones" {...register('notes')} />
      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

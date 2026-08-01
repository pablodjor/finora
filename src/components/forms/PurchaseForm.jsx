import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import CurrencyInput from '../common/CurrencyInput'
import Button from '../common/Button'
import { toISODate, nowInArgentina } from '../../utils/dates'
import { bindSelect } from '../../utils/formSelect'

const schema = z.object({
  credit_card_id: z.string().min(1, 'Seleccioná una tarjeta'),
  description: z.string().min(2, 'Ingresá una descripción'),
  total_amount: z.coerce.number().positive('Importe inválido'),
  installments_count: z.coerce.number().int().min(1).max(60),
  purchase_date: z.string().min(1),
  category_id: z.string().optional(),
  notes: z.string().optional(),
})

export default function PurchaseForm({
  cards = [],
  categories = [],
  onSubmit,
  onCancel,
  loading,
  defaultCardId,
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      credit_card_id: defaultCardId || '',
      description: '',
      total_amount: '',
      installments_count: 1,
      purchase_date: toISODate(nowInArgentina()),
      category_id: '',
      notes: '',
    },
  })

  const amount = watch('total_amount')
  const count = Number(watch('installments_count') || 1)
  const perInstallment = amount && count ? Number(amount) / count : 0

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Select
        label="Tarjeta"
        required
        options={cards.map((c) => ({ value: c.id, label: c.name }))}
        error={errors.credit_card_id?.message}
        {...bindSelect('credit_card_id', { watch, setValue, register })}
      />
      <Input
        label="Descripción"
        required
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Importe total"
          required
          value={amount}
          onChange={(v) => setValue('total_amount', v, { shouldValidate: true })}
          error={errors.total_amount?.message}
        />
        <Input
          label="Cuotas"
          type="number"
          min="1"
          max="60"
          required
          error={errors.installments_count?.message}
          {...register('installments_count')}
        />
        <Input label="Fecha de compra" type="date" {...register('purchase_date')} />
        <Select
          label="Categoría"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          {...bindSelect('category_id', { watch, setValue, register })}
        />
      </div>
      {perInstallment > 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Se generarán {count} cuota(s) de aproximadamente{' '}
          <span className="font-amount font-medium text-[var(--text)]">
            {perInstallment.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </span>
        </p>
      ) : null}
      <Textarea label="Notas" {...register('notes')} />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" loading={loading}>
          Guardar compra
        </Button>
      </div>
    </form>
  )
}

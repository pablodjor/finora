import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import CurrencyInput from '../common/CurrencyInput'
import Button from '../common/Button'
import { FREQUENCIES } from '../../lib/constants'
import { toISODate, nowInArgentina } from '../../utils/dates'
import { bindSelect } from '../../utils/formSelect'

const schema = z.object({
  name: z.string().min(2, 'Ingresá un nombre'),
  estimated_amount: z.coerce.number().min(0),
  due_day: z.coerce.number().int().min(1).max(28),
  category_id: z.string().optional(),
  payment_method_id: z.string().optional(),
  frequency: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().optional().nullable(),
  reminder_days: z.coerce.number().int().min(0).max(30),
  auto_renew: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
})

export default function RecurringExpenseForm({
  defaultValues,
  categories = [],
  paymentMethods = [],
  onSubmit,
  onCancel,
  loading = false,
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
      name: '',
      estimated_amount: 0,
      due_day: 10,
      category_id: '',
      payment_method_id: '',
      frequency: 'monthly',
      start_date: toISODate(nowInArgentina()),
      end_date: '',
      reminder_days: 3,
      auto_renew: true,
      is_active: true,
      notes: '',
      ...defaultValues,
    },
  })

  const amount = watch('estimated_amount')

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Nombre" required error={errors.name?.message} {...register('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Importe estimado"
          value={amount}
          onChange={(value) => setValue('estimated_amount', value, { shouldValidate: true })}
          error={errors.estimated_amount?.message}
        />
        <Input
          label="Día de vencimiento"
          type="number"
          min="1"
          max="28"
          error={errors.due_day?.message}
          {...register('due_day')}
        />
        <Select
          label="Categoría"
          options={categories.filter((c) => c.type === 'expense').map((c) => ({ value: c.id, label: c.name }))}
          {...bindSelect('category_id', { watch, setValue, register })}
        />
        <Select
          label="Método de pago"
          options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
          {...bindSelect('payment_method_id', { watch, setValue, register })}
        />
        <Select
          label="Frecuencia"
          options={FREQUENCIES}
          {...bindSelect('frequency', { watch, setValue, register })}
        />
        <Input
          label="Recordatorio (días antes)"
          type="number"
          min="0"
          {...register('reminder_days')}
        />
        <Input label="Fecha de inicio" type="date" {...register('start_date')} />
        <Input label="Fecha de finalización" type="date" {...register('end_date')} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded" {...register('auto_renew')} />
          Renovación automática
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded" {...register('is_active')} />
          Activo
        </label>
      </div>
      <Textarea label="Notas" {...register('notes')} />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" loading={loading}>
          Guardar
        </Button>
      </div>
    </form>
  )
}

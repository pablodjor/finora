import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../common/Input'
import Select from '../common/Select'
import CurrencyInput from '../common/CurrencyInput'
import Button from '../common/Button'
import { bindSelect } from '../../utils/formSelect'

const CARD_TYPES = [
  { value: 'visa', label: 'Visa' },
  { value: 'amex', label: 'American Express' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'other', label: 'Otra' },
]

const schema = z.object({
  name: z.string().min(2, 'Ingresá un nombre'),
  bank: z.string().optional(),
  card_type: z.string().min(1),
  last_four: z
    .string()
    .regex(/^\d{4}$/, 'Ingresá 4 dígitos')
    .optional()
    .or(z.literal('')),
  closing_day: z.coerce.number().int().min(1).max(28),
  due_day: z.coerce.number().int().min(1).max(28),
  total_limit: z.coerce.number().min(0),
  available_limit: z.coerce.number().min(0),
  color: z.string().min(1),
  is_active: z.boolean().optional(),
})

export default function CreditCardForm({ defaultValues, onSubmit, onCancel, loading }) {
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
      bank: '',
      card_type: 'visa',
      last_four: '',
      closing_day: 5,
      due_day: 15,
      total_limit: 0,
      available_limit: 0,
      color: '#102a43',
      is_active: true,
      ...defaultValues,
    },
  })

  const totalLimit = watch('total_limit')
  const availableLimit = watch('available_limit')

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" required error={errors.name?.message} {...register('name')} />
        <Input label="Banco" {...register('bank')} />
        <Select
          label="Tipo"
          options={CARD_TYPES}
          {...bindSelect('card_type', { watch, setValue, register })}
        />
        <Input
          label="Últimos 4 dígitos"
          maxLength={4}
          error={errors.last_four?.message}
          {...register('last_four')}
        />
        <Input
          label="Día de cierre"
          type="number"
          min="1"
          max="28"
          error={errors.closing_day?.message}
          {...register('closing_day')}
        />
        <Input
          label="Día de vencimiento"
          type="number"
          min="1"
          max="28"
          error={errors.due_day?.message}
          {...register('due_day')}
        />
        <CurrencyInput
          label="Límite total"
          value={totalLimit}
          onChange={(v) => setValue('total_limit', v, { shouldValidate: true })}
          error={errors.total_limit?.message}
        />
        <CurrencyInput
          label="Límite disponible"
          value={availableLimit}
          onChange={(v) => setValue('available_limit', v, { shouldValidate: true })}
          error={errors.available_limit?.message}
        />
        <Input label="Color" type="color" {...register('color')} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded" {...register('is_active')} />
        Activa
      </label>
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

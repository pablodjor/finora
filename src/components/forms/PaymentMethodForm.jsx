import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { bindSelect } from '../../utils/formSelect'

const TYPES = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'debit', label: 'Tarjeta de débito' },
  { value: 'credit', label: 'Tarjeta de crédito' },
  { value: 'bank', label: 'Cuenta bancaria' },
  { value: 'other', label: 'Otros' },
]

const schema = z.object({
  name: z.string().min(2, 'Ingresá un nombre'),
  type: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
  is_active: z.boolean().optional(),
})

export default function PaymentMethodForm({
  defaultValues,
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
      type: 'other',
      color: '#334e68',
      icon: 'Wallet',
      is_active: true,
      ...defaultValues,
    },
  })

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Nombre" required error={errors.name?.message} {...register('name')} />
      <Select label="Tipo" options={TYPES} {...bindSelect('type', { watch, setValue, register })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Color" type="color" {...register('color')} />
        <Input label="Icono" {...register('icon')} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded" {...register('is_active')} />
        Activo
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

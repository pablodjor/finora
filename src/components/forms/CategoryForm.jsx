import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { CATEGORY_COLORS, CATEGORY_TYPES } from '../../lib/constants'
import { bindSelect } from '../../utils/formSelect'

const schema = z.object({
  name: z.string().min(2, 'Ingresá un nombre'),
  type: z.enum(['expense', 'income']),
  color: z.string().min(1),
  icon: z.string().min(1),
})

export default function CategoryForm({
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
      type: 'expense',
      color: CATEGORY_COLORS[0],
      icon: 'Circle',
      ...defaultValues,
    },
  })

  const color = watch('color')

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Nombre" required error={errors.name?.message} {...register('name')} />
      <Select
        label="Tipo"
        required
        options={CATEGORY_TYPES}
        {...bindSelect('type', { watch, setValue, register })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Color"
          options={CATEGORY_COLORS.map((c) => ({ value: c, label: c }))}
          {...bindSelect('color', { watch, setValue, register })}
        />
        <Input label="Icono (Lucide)" {...register('icon')} hint="Ej: ShoppingCart, Wifi" />
      </div>
      <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
        <span className="h-6 w-6 rounded-full border" style={{ background: color }} />
        Vista previa del color
      </div>
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

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageHeader from '../../components/common/PageHeader'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { CURRENCIES, THEMES } from '../../lib/constants'
import { bindSelect } from '../../utils/formSelect'

const schema = z.object({
  full_name: z.string().min(2, 'Ingresá tu nombre'),
  currency: z.string().min(1),
  theme: z.string().min(1),
})

export default function ProfilePage() {
  const { profile, updateProfile, signOut, isAdmin } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      full_name: profile?.full_name || '',
      currency: profile?.currency || 'ARS',
      theme: profile?.theme || 'system',
    },
  })

  const onSubmit = async (values) => {
    setLoading(true)
    try {
      await updateProfile(values)
      toast.success('Perfil actualizado')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast.info('Sesión cerrada')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Perfil"
        description="Datos de tu cuenta y preferencias."
        actions={
          <Button variant="outline" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        }
      />

      <div className="card max-w-2xl space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{profile?.email}</Badge>
          <Badge tone={isAdmin ? 'warning' : 'success'}>
            {isAdmin ? 'Administrador' : 'Usuario'}
          </Badge>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Nombre completo"
            required
            error={errors.full_name?.message}
            {...register('full_name')}
          />
          <Select
            label="Moneda"
            options={CURRENCIES}
            {...bindSelect('currency', { watch, setValue, register })}
          />
          <Select
            label="Tema"
            options={THEMES}
            {...bindSelect('theme', { watch, setValue, register })}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={loading}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

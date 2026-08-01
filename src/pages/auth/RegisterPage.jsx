import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const schema = z
  .object({
    fullName: z.string().min(2, 'Ingresá tu nombre'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export default function RegisterPage() {
  const { signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setLoading(true)
    try {
      const result = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      })
      if (result.session) {
        toast.success('Cuenta creada correctamente')
        navigate('/dashboard')
      } else {
        toast.info('Revisá tu email para confirmar la cuenta')
        navigate('/login')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <h2 className="text-xl font-semibold">Crear cuenta</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Empezá a organizar tus finanzas</p>
      </div>
      <Input label="Nombre completo" required error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
      <Input
        label="Contraseña"
        type="password"
        passwordToggle
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        passwordToggle
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" className="w-full" loading={loading}>
        Registrarme
      </Button>
      <p className="text-center text-sm text-[var(--text-muted)]">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-primary-700 hover:underline dark:text-primary-300">
          Iniciá sesión
        </Link>
      </p>
    </form>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

export default function LoginPage() {
  const { signIn } = useAuth()
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
      await signIn(values)
      toast.success('Sesión iniciada')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <h2 className="text-xl font-semibold">Iniciar sesión</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Accedé a tu cuenta Finora</p>
      </div>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Contraseña"
        type="password"
        passwordToggle
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="flex justify-end">
        <Link to="/recuperar-password" className="text-sm text-primary-700 hover:underline dark:text-primary-300">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={loading}>
        Entrar
      </Button>
      <p className="text-center text-sm text-[var(--text-muted)]">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-medium text-primary-700 hover:underline dark:text-primary-300">
          Registrate
        </Link>
      </p>
    </form>
  )
}

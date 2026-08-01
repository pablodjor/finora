import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setLoading(true)
    try {
      await resetPassword(values.email)
      setSent(true)
      toast.success('Te enviamos un email para recuperar tu contraseña')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <h2 className="text-xl font-semibold">Recuperar contraseña</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Te enviaremos un enlace para restablecerla.
        </p>
      </div>
      {sent ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
          Revisá tu bandeja de entrada y seguí las instrucciones.
        </div>
      ) : (
        <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
      )}
      {!sent ? (
        <Button type="submit" className="w-full" loading={loading}>
          Enviar enlace
        </Button>
      ) : null}
      <p className="text-center text-sm">
        <Link to="/login" className="font-medium text-primary-700 hover:underline dark:text-primary-300">
          Volver al login
        </Link>
      </p>
    </form>
  )
}

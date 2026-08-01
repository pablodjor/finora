import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../utils/cn'

export default function Input({
  label,
  error,
  hint,
  className,
  id,
  required,
  type = 'text',
  passwordToggle = false,
  ...props
}) {
  const inputId = id || props.name
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password' || passwordToggle
  const inputType = isPassword && passwordToggle ? (showPassword ? 'text' : 'password') : type

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-[var(--text)]">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          className={cn(
            'input-base',
            passwordToggle && 'pr-11',
            error && 'border-red-500',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {passwordToggle ? (
          <button
            type="button"
            tabIndex={0}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
    </label>
  )
}

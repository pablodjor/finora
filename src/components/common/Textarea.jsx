import { cn } from '../../utils/cn'

export default function Textarea({ label, error, className, required, id, ...props }) {
  const textareaId = id || props.name

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-[var(--text)]">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
      ) : null}
      <textarea
        id={textareaId}
        className={cn('input-base min-h-24 resize-y', error && 'border-red-500', className)}
        {...props}
      />
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </label>
  )
}

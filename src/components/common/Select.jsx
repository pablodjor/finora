import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../utils/cn'

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toEvent(name, nextValue, type = 'change') {
  return {
    type,
    target: { name, value: nextValue },
    currentTarget: { name, value: nextValue },
  }
}

const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    options = [],
    placeholder = 'Seleccionar...',
    className,
    id,
    required,
    name,
    value,
    defaultValue = '',
    onChange,
    onBlur,
    disabled,
    searchable = true,
  },
  ref,
) {
  const reactId = useId()
  const selectId = id || name || reactId
  const containerRef = useRef(null)
  const searchRef = useRef(null)
  const hiddenRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(() =>
    String(value ?? defaultValue ?? ''),
  )

  const selectedValue = String(isControlled ? value ?? '' : internalValue ?? '')

  useEffect(() => {
    if (isControlled) setInternalValue(String(value ?? ''))
  }, [isControlled, value])

  // Sincroniza UI con valores iniciales de React Hook Form (register)
  useEffect(() => {
    if (isControlled) return undefined
    const syncFromHidden = () => {
      if (hiddenRef.current) {
        setInternalValue(String(hiddenRef.current.value ?? ''))
      }
    }
    syncFromHidden()
    const timer = window.setTimeout(syncFromHidden, 0)
    return () => window.clearTimeout(timer)
  }, [isControlled, options])

  // Mantener sincronizado el select oculto
  useEffect(() => {
    if (hiddenRef.current && hiddenRef.current.value !== selectedValue) {
      hiddenRef.current.value = selectedValue
    }
  }, [selectedValue])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [open])

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === selectedValue),
    [options, selectedValue],
  )

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = normalize(query)
    return options.filter(
      (option) =>
        normalize(option.label).includes(q) || normalize(String(option.value)).includes(q),
    )
  }, [options, query, searchable])

  function setRefs(node) {
    hiddenRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  function handleSelect(optionValue) {
    const nextValue = String(optionValue)
    if (!isControlled) setInternalValue(nextValue)
    if (hiddenRef.current) hiddenRef.current.value = nextValue
    onChange?.(toEvent(name, nextValue, 'change'))
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <label htmlFor={selectId} className="font-medium text-[var(--text)]">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}

      <div className="relative" ref={containerRef}>
        <button
          id={selectId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          onBlur={(event) => {
            if (containerRef.current?.contains(event.relatedTarget)) return
            onBlur?.(toEvent(name, selectedValue, 'blur'))
          }}
          className={cn(
            'input-base flex items-center justify-between gap-2 text-left',
            error && 'border-red-500',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
        >
          <span className={cn('truncate', !selectedOption && 'text-[var(--text-muted)]')}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--text-muted)] transition',
              open && 'rotate-180',
            )}
          />
        </button>

        {/* Select nativo oculto: mantiene compatibilidad con register() de RHF */}
        <select
          ref={setRefs}
          name={name}
          disabled={disabled}
          defaultValue={isControlled ? undefined : selectedValue}
          value={isControlled ? selectedValue : undefined}
          onChange={(event) => {
            if (!isControlled) setInternalValue(event.target.value)
            onChange?.(event)
          }}
          onBlur={onBlur}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>

        {open ? (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg">
            {searchable ? (
              <div className="border-b border-[var(--border)] p-2">
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar..."
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 pr-3 text-sm text-[var(--text)] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    style={{ paddingLeft: '2.75rem' }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              </div>
            ) : null}

            <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
              {placeholder ? (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedValue === ''}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-[var(--bg-muted)]',
                      selectedValue === '' &&
                        'bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200',
                    )}
                    onClick={() => handleSelect('')}
                  >
                    <span className="text-[var(--text-muted)]">{placeholder}</span>
                    {selectedValue === '' ? (
                      <Check className="h-4 w-4 text-primary-600" />
                    ) : null}
                  </button>
                </li>
              ) : null}

              {filteredOptions.length === 0 ? (
                <li className="px-3 py-3 text-sm text-[var(--text-muted)]">Sin resultados</li>
              ) : (
                filteredOptions.map((option) => {
                  const selected = selectedValue === String(option.value)
                  return (
                    <li key={String(option.value)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-[var(--bg-muted)]',
                          selected &&
                            'bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200',
                        )}
                        onClick={() => handleSelect(option.value)}
                      >
                        <span className="truncate">{option.label}</span>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-primary-600" />
                        ) : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? <span className="text-xs text-red-500">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
    </div>
  )
})

export default Select

import Input from './Input'

export default function CurrencyInput({ value, onChange, ...props }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value === '' ? '' : Number(event.target.value))}
      className="font-amount"
      {...props}
    />
  )
}

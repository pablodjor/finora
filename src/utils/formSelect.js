/** Conecta el Select con buscador a React Hook Form. */
export function bindSelect(name, { watch, setValue, register }) {
  const registration = register(name)
  return {
    name: registration.name,
    ref: registration.ref,
    value: watch(name) ?? '',
    onBlur: registration.onBlur,
    onChange: (event) => {
      setValue(name, event.target.value, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      })
    },
  }
}

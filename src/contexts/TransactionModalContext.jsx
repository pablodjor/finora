import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const TransactionModalContext = createContext(null)

export function TransactionModalProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [transactionId, setTransactionId] = useState(null)
  const [preset, setPreset] = useState(null)
  const [version, setVersion] = useState(0)

  const openCreate = useCallback((defaults = null) => {
    setTransactionId(null)
    setPreset(defaults)
    setOpen(true)
  }, [])

  const openEdit = useCallback((id) => {
    setTransactionId(id)
    setPreset(null)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setTransactionId(null)
    setPreset(null)
  }, [])

  const notifySaved = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  const value = useMemo(
    () => ({
      open,
      transactionId,
      preset,
      version,
      openCreate,
      openEdit,
      close,
      notifySaved,
      isEdit: Boolean(transactionId),
    }),
    [open, transactionId, preset, version, openCreate, openEdit, close, notifySaved],
  )

  return (
    <TransactionModalContext.Provider value={value}>
      {children}
    </TransactionModalContext.Provider>
  )
}

export function useTransactionModal() {
  const ctx = useContext(TransactionModalContext)
  if (!ctx) {
    throw new Error('useTransactionModal debe usarse dentro de TransactionModalProvider')
  }
  return ctx
}

import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useTransactionModal } from '../../contexts/TransactionModalContext'

/** Mantiene las rutas /movimientos/nuevo y /movimientos/:id abriendo el modal. */
export default function TransactionRouteRedirect() {
  const { id } = useParams()
  const { openCreate, openEdit } = useTransactionModal()

  useEffect(() => {
    if (id) openEdit(id)
    else openCreate()
  }, [id, openCreate, openEdit])

  return <Navigate to="/movimientos" replace />
}

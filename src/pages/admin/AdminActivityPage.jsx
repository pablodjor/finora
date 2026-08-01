import { useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader'
import Loader from '../../components/common/Loader'
import EmptyState from '../../components/common/EmptyState'
import { Activity } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { supabase, getSupabaseErrorMessage } from '../../lib/supabase'
import { formatDate } from '../../utils/dates'

export default function AdminActivityPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) throw new Error(getSupabaseErrorMessage(error))
        setItems(data || [])
      } catch (error) {
        toast.error(error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  return (
    <div>
      <PageHeader title="Actividad" description="Últimos eventos importantes del sistema." />
      {loading ? (
        <Loader fullPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Sin actividad"
          description="Cuando los usuarios se registren o realicen acciones clave, aparecerán aquí."
        />
      ) : (
        <div className="card divide-y divide-[var(--border)]">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{item.action}</p>
                <p className="text-xs text-[var(--text-muted)]">{formatDate(item.created_at, 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {item.entity_type || 'evento'} {item.entity_id ? `· ${item.entity_id}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

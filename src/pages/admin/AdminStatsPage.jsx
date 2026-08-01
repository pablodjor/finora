import { useEffect, useState } from 'react'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/dashboard/StatCard'
import Loader from '../../components/common/Loader'
import { Users, Tags, ArrowLeftRight, Activity } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { getSupabaseErrorMessage } from '../../lib/supabase'

export default function AdminStatsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    users: 0,
    categories: 0,
    transactions: 0,
    logs: 0,
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [users, categories, transactions, logs] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_system', true),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }),
        ])

        for (const result of [users, categories, transactions, logs]) {
          if (result.error) throw new Error(getSupabaseErrorMessage(result.error))
        }

        setStats({
          users: users.count || 0,
          categories: categories.count || 0,
          transactions: transactions.count || 0,
          logs: logs.count || 0,
        })
      } catch (error) {
        toast.error(error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  if (loading) return <Loader fullPage />

  return (
    <div>
      <PageHeader title="Estadísticas" description="Vista general de la plataforma." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Usuarios" value={String(stats.users)} icon={Users} />
        <StatCard title="Categorías sistema" value={String(stats.categories)} icon={Tags} />
        <StatCard title="Movimientos" value={String(stats.transactions)} icon={ArrowLeftRight} />
        <StatCard title="Logs de actividad" value={String(stats.logs)} icon={Activity} />
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Users, Tags, BarChart3, Activity } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'

const cards = [
  { to: '/admin/usuarios', title: 'Usuarios', description: 'Activar o desactivar cuentas', icon: Users },
  { to: '/admin/categorias', title: 'Categorías', description: 'Categorías predeterminadas del sistema', icon: Tags },
  { to: '/admin/estadisticas', title: 'Estadísticas', description: 'Métricas generales de la plataforma', icon: BarChart3 },
  { to: '/admin/actividad', title: 'Actividad', description: 'Registros importantes del sistema', icon: Activity },
]

export default function AdminHomePage() {
  return (
    <div>
      <PageHeader
        title="Administración"
        description="Gestión global de Finora."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.to} to={card.to} className="card block p-5 transition hover:border-primary-400">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-800 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{card.title}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{card.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

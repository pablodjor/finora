import { Construction } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import EmptyState from '../../components/common/EmptyState'

export default function PlaceholderPage({ title, description }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Construction}
        title="Próximamente"
        description="Esta sección está preparada en la base de datos y se implementará en la siguiente etapa."
      />
    </div>
  )
}

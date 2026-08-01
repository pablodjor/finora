export const APP_NAME = 'Finora'

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  EMMITA: 'emmita',
}

export const ROLE_OPTIONS = [
  { value: 'user', label: 'Usuario' },
  { value: 'emmita', label: 'Emmita' },
  { value: 'admin', label: 'Administrador' },
]

export const ROLE_LABELS = {
  admin: 'Administrador',
  user: 'Usuario',
  emmita: 'Emmita',
}

export const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
]

export const EXPENSE_TYPES = [
  { value: 'one_time', label: 'Gasto único' },
  { value: 'fixed', label: 'Gasto fijo' },
  { value: 'installment', label: 'Compra en cuotas' },
  { value: 'subscription', label: 'Suscripción' },
  { value: 'variable', label: 'Gasto variable' },
]

export const TRANSACTION_STATUSES = [
  { value: 'paid', label: 'Pagado', tone: 'success' },
  { value: 'pending', label: 'Pendiente', tone: 'warning' },
  { value: 'overdue', label: 'Vencido', tone: 'danger' },
  { value: 'scheduled', label: 'Programado', tone: 'info' },
  { value: 'cancelled', label: 'Cancelado', tone: 'neutral' },
]

export const FREQUENCIES = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'yearly', label: 'Anual' },
]

export const CATEGORY_TYPES = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
]

export const CURRENCIES = [
  { value: 'ARS', label: 'Peso argentino (ARS)' },
  { value: 'USD', label: 'Dólar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]

export const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
]

export const DEFAULT_PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Mercado Pago',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'Cuenta bancaria',
  'Otros',
]

export const INCOME_CATEGORIES = [
  'Sueldo',
  'Aguinaldo',
  'Trabajo freelance',
  'Venta',
  'Reembolso',
  'Inversión',
  'Regalo',
  'Otros',
]

export const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

export const YEAR_FROM = 2026
export const YEAR_TO = 2030

export const YEARS = Array.from({ length: YEAR_TO - YEAR_FROM + 1 }, (_, i) => {
  const year = YEAR_FROM + i
  return { value: year, label: String(year) }
})

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { to: '/movimientos', label: 'Movimientos', icon: 'ArrowLeftRight' },
  { to: '/gastos-fijos', label: 'Gastos fijos', icon: 'Repeat' },
  { to: '/ingresos', label: 'Ingresos', icon: 'TrendingUp' },
  { to: '/tarjetas', label: 'Tarjetas', icon: 'CreditCard' },
  { to: '/presupuestos', label: 'Presupuestos', icon: 'Wallet' },
  { to: '/juntadas', label: 'Juntadas', icon: 'UsersRound' },
  { to: '/objetivos', label: 'Objetivos', icon: 'Target' },
  { to: '/calendario', label: 'Calendario', icon: 'Calendar' },
  { to: '/reportes', label: 'Reportes', icon: 'BarChart3' },
  { to: '/categorias', label: 'Categorías', icon: 'Tags' },
  { to: '/metodos-pago', label: 'Métodos de pago', icon: 'Banknote' },
  { to: '/perfil', label: 'Perfil', icon: 'User' },
  { to: '/configuracion', label: 'Configuración', icon: 'Settings' },
]

export const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Panel', icon: 'Shield' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: 'Users' },
  { to: '/admin/categorias', label: 'Categorías', icon: 'Tags' },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: 'BarChart3' },
  { to: '/admin/actividad', label: 'Actividad', icon: 'Activity' },
]

export const CATEGORY_COLORS = [
  '#059669',
  '#0ea5e9',
  '#6366f1',
  '#d97706',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#475569',
]

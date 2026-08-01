import { Navigate, Route, Routes } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import AppLayout from '../layouts/AppLayout'
import AdminLayout from '../layouts/AdminLayout'
import PrivateRoute from './PrivateRoute'
import AdminRoute from './AdminRoute'

import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import TransactionsPage from '../pages/transactions/TransactionsPage'
import TransactionRouteRedirect from '../pages/transactions/TransactionRouteRedirect'
import RecurringExpensesPage from '../pages/recurringExpenses/RecurringExpensesPage'
import CategoriesPage from '../pages/categories/CategoriesPage'
import PaymentMethodsPage from '../pages/paymentMethods/PaymentMethodsPage'
import ProfilePage from '../pages/profile/ProfilePage'
import SettingsPage from '../pages/settings/SettingsPage'
import CreditCardsPage from '../pages/cards/CreditCardsPage'
import BudgetsPage from '../pages/budgets/BudgetsPage'
import SavingsGoalsPage from '../pages/savings/SavingsGoalsPage'
import ReportsPage from '../pages/reports/ReportsPage'
import CalendarPage from '../pages/calendar/CalendarPage'
import JuntadasPage from '../pages/juntadas/JuntadasPage'
import JuntadaDetailPage from '../pages/juntadas/JuntadaDetailPage'
import AdminHomePage from '../pages/admin/AdminHomePage'
import AdminUsersPage from '../pages/admin/AdminUsersPage'
import AdminCategoriesPage from '../pages/admin/AdminCategoriesPage'
import AdminStatsPage from '../pages/admin/AdminStatsPage'
import AdminActivityPage from '../pages/admin/AdminActivityPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/movimientos" element={<TransactionsPage />} />
          <Route path="/movimientos/nuevo" element={<TransactionRouteRedirect />} />
          <Route path="/movimientos/:id" element={<TransactionRouteRedirect />} />
          <Route path="/ingresos" element={<TransactionsPage typeFilter="income" />} />
          <Route path="/gastos-fijos" element={<RecurringExpensesPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/metodos-pago" element={<PaymentMethodsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracion" element={<SettingsPage />} />

          <Route path="/tarjetas" element={<CreditCardsPage />} />
          <Route path="/presupuestos" element={<BudgetsPage />} />
          <Route path="/juntadas" element={<JuntadasPage />} />
          <Route path="/juntadas/:id" element={<JuntadaDetailPage />} />
          <Route path="/objetivos" element={<SavingsGoalsPage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/reportes" element={<ReportsPage />} />

          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminHomePage />} />
              <Route path="/admin/usuarios" element={<AdminUsersPage />} />
              <Route path="/admin/categorias" element={<AdminCategoriesPage />} />
              <Route path="/admin/estadisticas" element={<AdminStatsPage />} />
              <Route path="/admin/actividad" element={<AdminActivityPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

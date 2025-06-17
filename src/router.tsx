

import { createBrowserRouter, Outlet } from "react-router-dom"; // Corrected import
import { MainLayout } from '@/components/layout/MainLayout'; // Corrected path
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout'; // Corrected path
import { HomePage } from '@/pages/HomePage'; // Corrected path
import { AuthPage } from '@/pages/AuthPage'; // Corrected path
import { DashboardPage } from '@/pages/DashboardPage'; // Corrected path
import ProductsPage from '@/pages/ProductsPage'; // Corrected path
import { ProductCreatePage } from '@/pages/ProductCreatePage'; // Corrected path
import { ProductEditPage } from '@/pages/ProductEditPage'; // Corrected path
import { CheckoutPage } from '@/pages/CheckoutPage'; // Corrected path
import { ThankYouPage } from '@/pages/ThankYouPage'; // Corrected path
import { VendasPage } from '@/pages/VendasPage'; // Corrected path
import { ClientesPage } from '@/pages/ClientesPage'; // Corrected path
import { CarrinhosAbandonadosPage } from '@/pages/CarrinhosAbandonadosPage'; // Corrected path
import { IntegracoesPage } from '@/pages/IntegracoesPage'; // Corrected path
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage'; // Corrected path

// Super Admin Pages
import { SuperAdminDashboardPage } from '@/pages/superadmin/SuperAdminDashboardPage'; // Corrected path
import { PlatformSettingsPage } from '@/pages/superadmin/PlatformSettingsPage'; // Corrected path
import { SuperAdminUsersPage } from '@/pages/superadmin/SuperAdminUsersPage'; // Corrected path
import { SuperAdminSalesPage } from '@/pages/superadmin/SuperAdminSalesPage'; // Corrected path
import { SuperAdminAuditLogPage } from '@/pages/superadmin/SuperAdminAuditLogPage'; // Corrected path
import { SuperAdminAllProductsPage } from '@/pages/superadmin/SuperAdminAllProductsPage'; // Corrected path

import { ProtectedRoute, SuperAdminProtectedRoute } from '@/App'; // Corrected path
import { ErrorBoundary } from '@/ErrorBoundary'; // Corrected path

const RootLayout = () => {
  return (
    <>
      <Outlet />
    </>
  );
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorBoundary />, 
    children: [
      { path: "/auth", element: <AuthPage /> },
      { path: "/", element: <HomePage /> },
      { path: "/checkout/:slug", element: <CheckoutPage /> },
      { path: "/thank-you/:orderId", element: <ThankYouPage /> },
      
      { path: "/dashboard", element: <ProtectedRoute><MainLayout><DashboardPage /></MainLayout></ProtectedRoute> },
      { path: "/produtos", element: <ProtectedRoute><MainLayout><ProductsPage /></MainLayout></ProtectedRoute> },
      { path: "/produtos/novo", element: <ProtectedRoute><MainLayout><ProductCreatePage /></MainLayout></ProtectedRoute> },
      { path: "/produtos/editar/:productId", element: <ProtectedRoute><MainLayout><ProductEditPage /></MainLayout></ProtectedRoute> },
      { path: "/vendas", element: <ProtectedRoute><MainLayout><VendasPage /></MainLayout></ProtectedRoute> },
      { path: "/clientes", element: <ProtectedRoute><MainLayout><ClientesPage /></MainLayout></ProtectedRoute> },
      { path: "/carrinhos-abandonados", element: <ProtectedRoute><MainLayout><CarrinhosAbandonadosPage /></MainLayout></ProtectedRoute> },
      { path: "/integracoes", element: <ProtectedRoute><MainLayout><IntegracoesPage /></MainLayout></ProtectedRoute> },
      { path: "/configuracoes", element: <ProtectedRoute><MainLayout><ConfiguracoesPage /></MainLayout></ProtectedRoute> },
      
      { path: "/superadmin/dashboard", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminDashboardPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/configuracoes-plataforma", element: <SuperAdminProtectedRoute><SuperAdminLayout><PlatformSettingsPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/usuarios", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminUsersPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/vendas-gerais", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminSalesPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/audit-log", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminAuditLogPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/todos-produtos", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminAllProductsPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
    ]
  }
]);
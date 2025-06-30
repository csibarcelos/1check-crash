

import React, { Suspense } from "react"; 
import { Outlet, createBrowserRouter } from "react-router-dom";
import { MainLayout } from './components/layout/MainLayout';
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ProtectedRoute, SuperAdminProtectedRoute } from './App';
import { ErrorBoundary } from './ErrorBoundary';

const RouteLoadingFallback = () => ( <div className="flex justify-center items-center h-screen bg-bg-main"> <LoadingSpinner size="lg" /> <p className="ml-3 text-text-muted text-lg">Carregando página...</p> </div> );

const HomePage = React.lazy(() => import('./pages/HomePage'));
const AuthPage = React.lazy(() => import('./pages/AuthPage').then(module => ({ default: module.default })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
// const LiveViewPage = React.lazy(() => import('./pages/LiveViewPage')); // TEMPORARILY HIDDEN
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const ProductCreatePage = React.lazy(() => import('./pages/ProductCreatePage'));
const ProductEditPage = React.lazy(() => import('./pages/ProductEditPage'));
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage'));
const ThankYouPage = React.lazy(() => import('./pages/ThankYouPage'));
const VendasPage = React.lazy(() => import('./pages/VendasPage'));
const ClientesPage = React.lazy(() => import('./pages/ClientesPage'));
const CarrinhosAbandonadosPage = React.lazy(() => import('./pages/CarrinhosAbandonadosPage'));
const EmailAutomationPage = React.lazy(() => import('./pages/EmailAutomationPage')); // New
const IntegracoesPage = React.lazy(() => import('./pages/IntegracoesPage'));
const ConfiguracoesPage = React.lazy(() => import('./pages/ConfiguracoesPage'));
const MinhaContaPage = React.lazy(() => import('./pages/MinhaContaPage')); 

// Super Admin Pages
const SuperAdminDashboardPage = React.lazy(() => import('./pages/superadmin/SuperAdminDashboardPage'));
const PlatformSettingsPage = React.lazy(() => import('./pages/superadmin/PlatformSettingsPage'));
const SuperAdminUsersPage = React.lazy(() => import('./pages/superadmin/SuperAdminUsersPage'));
const SuperAdminSalesPage = React.lazy(() => import('./pages/superadmin/SuperAdminSalesPage'));
const SuperAdminAuditLogPage = React.lazy(() => import('./pages/superadmin/SuperAdminAuditLogPage'));
const SuperAdminAllProductsPage = React.lazy(() => import('./pages/superadmin/SuperAdminAllProductsPage'));


const RootLayout = () => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Outlet />
    </Suspense>
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
      // { path: "/live-view", element: <ProtectedRoute><MainLayout><LiveViewPage /></MainLayout></ProtectedRoute> }, // TEMPORARILY HIDDEN
      { path: "/produtos", element: <ProtectedRoute><MainLayout><ProductsPage /></MainLayout></ProtectedRoute> },
      { path: "/produtos/novo", element: <ProtectedRoute><MainLayout><ProductCreatePage /></MainLayout></ProtectedRoute> },
      { path: "/produtos/editar/:productId", element: <ProtectedRoute><MainLayout><ProductEditPage /></MainLayout></ProtectedRoute> },
      { path: "/vendas", element: <ProtectedRoute><MainLayout><VendasPage /></MainLayout></ProtectedRoute> },
      { path: "/clientes", element: <ProtectedRoute><MainLayout><ClientesPage /></MainLayout></ProtectedRoute> },
      { path: "/carrinhos-abandonados", element: <ProtectedRoute><MainLayout><CarrinhosAbandonadosPage /></MainLayout></ProtectedRoute> },
      { path: "/automacao-email", element: <ProtectedRoute><MainLayout><EmailAutomationPage /></MainLayout></ProtectedRoute> }, // New
      { path: "/integracoes", element: <ProtectedRoute><MainLayout><IntegracoesPage /></MainLayout></ProtectedRoute> },
      { path: "/configuracoes", element: <ProtectedRoute><MainLayout><ConfiguracoesPage /></MainLayout></ProtectedRoute> },
      { path: "/minha-conta", element: <ProtectedRoute><MainLayout><MinhaContaPage /></MainLayout></ProtectedRoute> }, 
      
      { path: "/superadmin/dashboard", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminDashboardPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/configuracoes-plataforma", element: <SuperAdminProtectedRoute><SuperAdminLayout><PlatformSettingsPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/usuarios", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminUsersPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/vendas-gerais", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminSalesPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/audit-log", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminAuditLogPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
      { path: "/superadmin/todos-produtos", element: <SuperAdminProtectedRoute><SuperAdminLayout><SuperAdminAllProductsPage /></SuperAdminLayout></SuperAdminProtectedRoute> },
    ]
  }
]);
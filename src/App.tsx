

import React, { useEffect, useState } from 'react'; 
import { Navigate } from "react-router-dom"; 
import { useAuth } from './contexts/AuthContext'; 
import { LoadingSpinner } from './components/ui/LoadingSpinner'; 

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContextValue = useAuth();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  if (authContextValue === undefined) {
    console.error('CRITICAL ERROR in ProtectedRoute: useAuth() returned undefined.');
    if (!hasMounted) return null;
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-neutral-900 text-neutral-100">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-lg text-red-400">Erro Crítico: Contexto de Autenticação indisponível.</p>
      </div>
    );
  }

  const { isAuthenticated, isLoading } = authContextValue;

  if (!hasMounted) {
    return null; 
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-neutral-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};

export const SuperAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContextValue = useAuth();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (authContextValue === undefined) {
     console.error('CRITICAL ERROR in SuperAdminProtectedRoute: useAuth() returned undefined.');
     if (!hasMounted) return null;
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-neutral-900 text-neutral-100">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-lg text-red-400">Erro Crítico: Contexto de Autenticação (Super Admin) indisponível.</p>
      </div>
    );
  }
  const { isAuthenticated, isSuperAdmin, isLoading } = authContextValue;

  if (!hasMounted) {
    return null; 
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-neutral-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return <Navigate to={isAuthenticated ? "/dashboard" : "/auth"} replace />;
  }
  return <>{children}</>;
};

// --- App.tsx specific code (sound effect) ---

import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import './global.css';
import { router } from './router';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './contexts/ToastContext';
import { Toaster } from './components/ui/Toast';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <DataProvider>
          <RouterProvider router={router} />
          <Toaster />
          <audio id="cash-register-sound" preload="auto">
            <source src="/assets/sounds/cash-register.mp3" type="audio/mpeg" />
          </audio>
        </DataProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;

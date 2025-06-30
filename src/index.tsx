
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import './global.css';
import { router } from './router';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './contexts/ToastContext';
import { Toaster } from './components/ui/Toast';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <DataProvider>
          <RouterProvider router={router} />
        </DataProvider>
        <Toaster />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
